import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  Role,
  MedicineRequestStatus,
  assertValidMedicineTransition,
} from '@mentamind/shared';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../middleware/error-handler.js';
import { createAuditLog } from '../middleware/audit.js';
import { ServiceContainer } from '../services/service-container.js';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticateToken);

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const statusValues = Object.values(MedicineRequestStatus) as [string, ...string[]];

const fileUploadSchema = z.object({
  base64: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().regex(/^image\/(png|jpeg|jpg|webp)|application\/pdf$/),
});

const createMedicineRequestSchema = z.object({
  notes: z.string().max(1000).optional(),
  // Prescription (required)
  prescriptionBase64: z.string().min(1, 'Prescription file is required'),
  fileName: z.string().min(1, 'File name is required'),
  mimeType: z.string().regex(/^image\/(png|jpeg|jpg|webp)|application\/pdf$/, 'Must be an image or PDF'),
  // Additional supporting documents (optional)
  incomeCertificate: fileUploadSchema.optional(),
  diseaseProof: fileUploadSchema.optional(),
  doctorRecommendation: fileUploadSchema.optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(statusValues),
});

const reviewSchema = z.object({
  medicines: z.array(
    z.object({
      name: z.string().min(1),
      dosage: z.string().min(1),
      quantity: z.number().int().min(1),
      frequency: z.string().optional(),
    }),
  ).min(1, 'At least one medicine is required'),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

function getServices(req: Request): ServiceContainer {
  return req.app.get('services') as ServiceContainer;
}

// ─── POST / — Create medicine request ───────────────────────────────────────

router.post(
  '/',
  requireRole(Role.PATIENT),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createMedicineRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        `Validation failed: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        400,
        'VALIDATION_ERROR',
      );
    }

    const userId = req.user!.userId;

    // Check identity verification
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { identityVerified: true, patient: { select: { id: true } } },
    });

    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    if (!user.identityVerified) {
      throw new AppError('Identity verification required', 403, 'IDENTITY_NOT_VERIFIED');
    }
    if (!user.patient) throw new AppError('Patient profile not found', 404, 'PATIENT_NOT_FOUND');

    const { notes, prescriptionBase64, fileName, mimeType, incomeCertificate, diseaseProof, doctorRecommendation } = parsed.data;

    const services = getServices(req);
    const ts = Date.now();

    // Upload prescription (required)
    const buffer = Buffer.from(prescriptionBase64, 'base64');
    const ext = fileName.split('.').pop() || 'png';
    const prescriptionFileKey = `prescriptions/${userId}/${ts}.${ext}`;
    await services.fileStorage.upload(prescriptionFileKey, buffer, mimeType);

    // Upload optional supporting documents
    let incomeCertificateFileKey: string | undefined;
    if (incomeCertificate) {
      const buf = Buffer.from(incomeCertificate.base64, 'base64');
      const e = incomeCertificate.fileName.split('.').pop() || 'pdf';
      incomeCertificateFileKey = `income-certs/${userId}/${ts}.${e}`;
      await services.fileStorage.upload(incomeCertificateFileKey, buf, incomeCertificate.mimeType);
    }

    let diseaseProofFileKey: string | undefined;
    if (diseaseProof) {
      const buf = Buffer.from(diseaseProof.base64, 'base64');
      const e = diseaseProof.fileName.split('.').pop() || 'pdf';
      diseaseProofFileKey = `disease-proofs/${userId}/${ts}.${e}`;
      await services.fileStorage.upload(diseaseProofFileKey, buf, diseaseProof.mimeType);
    }

    let doctorRecommendationFileKey: string | undefined;
    if (doctorRecommendation) {
      const buf = Buffer.from(doctorRecommendation.base64, 'base64');
      const e = doctorRecommendation.fileName.split('.').pop() || 'pdf';
      doctorRecommendationFileKey = `doctor-recs/${userId}/${ts}.${e}`;
      await services.fileStorage.upload(doctorRecommendationFileKey, buf, doctorRecommendation.mimeType);
    }

    const request = await prisma.medicineRequest.create({
      data: {
        patientId: user.patient.id,
        prescriptionFileKey,
        incomeCertificateFileKey: incomeCertificateFileKey ?? null,
        diseaseProofFileKey: diseaseProofFileKey ?? null,
        doctorRecommendationFileKey: doctorRecommendationFileKey ?? null,
        status: MedicineRequestStatus.PENDING_OCR,
        notes,
      },
    });

    void createAuditLog(
      userId,
      {
        action: 'MEDICINE_REQUEST_CREATED',
        entityType: 'MedicineRequest',
        entityId: request.id,
        newValue: { prescriptionFileKey, status: MedicineRequestStatus.PENDING_OCR },
      },
      req,
    );

    res.status(201).json({ request });
  }),
);

// ─── GET / — List medicine requests ─────────────────────────────────────────

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const role = req.user!.role as Role;
    const statusFilter = req.query.status as string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!patient) throw new AppError('Patient profile not found', 404, 'PATIENT_NOT_FOUND');
      where.patientId = patient.id;
    }

    if (statusFilter) where.status = statusFilter;

    const requests = await prisma.medicineRequest.findMany({
      where,
      include: {
        patient: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ requests });
  }),
);

// ─── GET /:id — Get medicine request detail ─────────────────────────────────

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const role = req.user!.role as Role;

    const request = await prisma.medicineRequest.findUnique({
      where: { id },
      include: {
        patient: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    if (!request) throw new AppError('Medicine request not found', 404, 'REQUEST_NOT_FOUND');

    // Patients can only view their own
    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({ where: { userId }, select: { id: true } });
      if (request.patientId !== patient?.id) throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    const services = getServices(req);

    async function signedUrl(key: string | null): Promise<string | null> {
      if (!key) return null;
      try {
        return await services.fileStorage.getSignedUrl(key, 3600);
      } catch {
        return null;
      }
    }

    const [prescriptionUrl, incomeCertificateUrl, diseaseProofUrl, doctorRecommendationUrl] =
      await Promise.all([
        signedUrl(request.prescriptionFileKey),
        signedUrl((request as any).incomeCertificateFileKey),
        signedUrl((request as any).diseaseProofFileKey),
        signedUrl((request as any).doctorRecommendationFileKey),
      ]);

    res.status(200).json({
      request,
      prescriptionUrl,
      incomeCertificateUrl,
      diseaseProofUrl,
      doctorRecommendationUrl,
    });
  }),
);

// ─── POST /:id/ocr — Trigger OCR extraction ────────────────────────────────

router.post(
  '/:id/ocr',
  requireRole(Role.ADMIN, Role.VOLUNTEER),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const request = await prisma.medicineRequest.findUnique({ where: { id } });
    if (!request) throw new AppError('Medicine request not found', 404, 'REQUEST_NOT_FOUND');

    if (request.status !== MedicineRequestStatus.PENDING_OCR) {
      throw new AppError(
        `Cannot run OCR on a request in "${request.status}" status. Must be in "PENDING_OCR".`,
        400,
        'INVALID_STATUS_FOR_OCR',
      );
    }

    if (!request.prescriptionFileKey) {
      throw new AppError('No prescription file uploaded', 400, 'NO_FILE');
    }

    const services = getServices(req);

    // Download file from storage
    const fileBuffer = await services.fileStorage.download(request.prescriptionFileKey);
    const mimeType = request.prescriptionFileKey.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';

    // Run OCR
    const ocrResult = await services.ocrService.extractPrescription(fileBuffer, mimeType);

    // Store results and transition status
    const updatedRequest = await prisma.medicineRequest.update({
      where: { id },
      data: {
        ocrSuggestions: JSON.parse(JSON.stringify(ocrResult)),
        status: MedicineRequestStatus.OCR_COMPLETE,
      },
    });

    void createAuditLog(
      req.user!.userId,
      {
        action: 'MEDICINE_OCR_COMPLETED',
        entityType: 'MedicineRequest',
        entityId: id,
        newValue: {
          medicinesFound: ocrResult.medicines.length,
          overallConfidence: ocrResult.overallConfidence,
        },
      },
      req,
    );

    res.status(200).json({
      request: updatedRequest,
      ocrResult,
    });
  }),
);

// ─── PUT /:id/review — Submit admin review ──────────────────────────────────

router.put(
  '/:id/review',
  requireRole(Role.ADMIN, Role.VOLUNTEER),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        `Validation failed: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        400,
        'VALIDATION_ERROR',
      );
    }

    const request = await prisma.medicineRequest.findUnique({ where: { id } });
    if (!request) throw new AppError('Medicine request not found', 404, 'REQUEST_NOT_FOUND');

    // Must be in OCR_COMPLETE to submit review
    if (request.status !== MedicineRequestStatus.OCR_COMPLETE) {
      throw new AppError(
        `Cannot submit review for a request in "${request.status}" status. Must be in "OCR_COMPLETE".`,
        400,
        'INVALID_STATUS_FOR_REVIEW',
      );
    }

    const updatedRequest = await prisma.medicineRequest.update({
      where: { id },
      data: {
        adminReviewedData: JSON.parse(JSON.stringify(parsed.data.medicines)),
        reviewedBy: req.user!.userId,
        reviewedAt: new Date(),
        status: MedicineRequestStatus.PENDING_REVIEW,
      },
    });

    void createAuditLog(
      req.user!.userId,
      {
        action: 'MEDICINE_REVIEW_SUBMITTED',
        entityType: 'MedicineRequest',
        entityId: id,
        newValue: {
          medicineCount: parsed.data.medicines.length,
          reviewedBy: req.user!.userId,
        },
      },
      req,
    );

    res.status(200).json({ request: updatedRequest });
  }),
);

// ─── PATCH /:id/status — Update status ──────────────────────────────────────

router.patch(
  '/:id/status',
  requireRole(Role.ADMIN, Role.VOLUNTEER),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        `Validation failed: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        400,
        'VALIDATION_ERROR',
      );
    }

    const newStatus = parsed.data.status as MedicineRequestStatus;
    const request = await prisma.medicineRequest.findUnique({ where: { id } });
    if (!request) throw new AppError('Medicine request not found', 404, 'REQUEST_NOT_FOUND');

    try {
      assertValidMedicineTransition(request.status as MedicineRequestStatus, newStatus);
    } catch (err) {
      throw new AppError(
        err instanceof Error ? err.message : 'Invalid status transition',
        400,
        'INVALID_TRANSITION',
      );
    }

    const oldStatus = request.status;

    const updatedRequest = await prisma.medicineRequest.update({
      where: { id },
      data: { status: newStatus },
    });

    // Notify patient on key status changes
    const services = getServices(req);
    if ([MedicineRequestStatus.APPROVED, MedicineRequestStatus.DISPATCHED, MedicineRequestStatus.DELIVERED].includes(newStatus)) {
      const patient = await prisma.patient.findUnique({
        where: { id: request.patientId },
        select: { userId: true },
      });
      if (patient) {
        void services.notifier.send({
          userId: patient.userId,
          type: `MEDICINE_${newStatus}`,
          title: `Medicine Request ${newStatus.charAt(0) + newStatus.slice(1).toLowerCase()}`,
          message: `Your medicine request has been ${newStatus.toLowerCase()}.`,
          channel: 'IN_APP',
        });
      }
    }

    void createAuditLog(
      req.user!.userId,
      {
        action: 'MEDICINE_REQUEST_STATUS_CHANGED',
        entityType: 'MedicineRequest',
        entityId: id,
        oldValue: { status: oldStatus },
        newValue: { status: newStatus },
      },
      req,
    );

    res.status(200).json({ request: updatedRequest });
  }),
);

export { router as medicineRequestRoutes };
