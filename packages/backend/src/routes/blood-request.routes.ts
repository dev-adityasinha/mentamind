import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  BloodGroup,
  Role,
  RequestStatus,
  UrgencyLevel,
  PriorityLevel,
  assertValidTransition,
  getCompatibleDonorGroups,
} from '@mentamind/shared';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../middleware/error-handler.js';
import { createAuditLog } from '../middleware/audit.js';
import { ServiceContainer } from '../services/service-container.js';

const prisma = new PrismaClient();
const router = Router();

// All blood request routes require authentication
router.use(authenticateToken);

// Zod Schemas 

const bloodGroupValues = Object.values(BloodGroup) as [string, ...string[]];
const urgencyValues = Object.values(UrgencyLevel) as [string, ...string[]];
const priorityValues = Object.values(PriorityLevel) as [string, ...string[]];
const statusValues = Object.values(RequestStatus) as [string, ...string[]];

const createRequestSchema = z.object({
  bloodGroup: z.enum(bloodGroupValues),
  unitsNeeded: z.number().int().min(1).max(20),
  urgency: z.enum(urgencyValues).default('NORMAL'),
  priorityLevel: z.enum(priorityValues).default('MEDIUM'),
  notes: z.string().max(1000).optional(),
  // Hospital details
  hospitalId: z.string().uuid().optional(),
  hospitalName: z.string().max(255).optional(),
  department: z.string().max(255).optional(),
  treatingDoctor: z.string().max(255).optional(),
  bedNumber: z.string().max(50).optional(),
  // Blood requisition document upload (base64)
  requisitionBase64: z.string().optional(),
  requisitionFileName: z.string().optional(),
  requisitionMimeType: z.string().regex(/^image\/(png|jpeg|jpg)|application\/pdf$/).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(statusValues),
});

// Helpers 

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

// Create blood request route

router.post(
  '/',
  requireRole(Role.PATIENT),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createRequestSchema.safeParse(req.body);
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

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (!user.identityVerified) {
      throw new AppError(
        'Identity verification required before creating a blood request',
        403,
        'IDENTITY_NOT_VERIFIED',
      );
    }

    if (!user.patient) {
      throw new AppError('Patient profile not found', 404, 'PATIENT_NOT_FOUND');
    }

    const {
      bloodGroup, unitsNeeded, urgency, priorityLevel, notes,
      hospitalId, hospitalName, department, treatingDoctor, bedNumber,
      requisitionBase64, requisitionFileName, requisitionMimeType,
    } = parsed.data;

    // Upload requisition document if provided
    let requisitionFileKey: string | undefined;
    if (requisitionBase64 && requisitionFileName && requisitionMimeType) {
      const services = getServices(req);
      const buffer = Buffer.from(requisitionBase64, 'base64');
      const ext = requisitionFileName.split('.').pop() || 'pdf';
      requisitionFileKey = `requisitions/${userId}/${Date.now()}.${ext}`;
      await services.fileStorage.upload(requisitionFileKey, buffer, requisitionMimeType);
    }

    const request = await prisma.bloodRequest.create({
      data: {
        patientId: user.patient.id,
        bloodGroup: bloodGroup as BloodGroup,
        unitsNeeded,
        urgency: urgency as UrgencyLevel,
        priorityLevel: priorityLevel as PriorityLevel,
        status: RequestStatus.DRAFT,
        notes,
        hospitalId: hospitalId ?? null,
        hospitalName: hospitalName ?? null,
        department: department ?? null,
        treatingDoctor: treatingDoctor ?? null,
        bedNumber: bedNumber ?? null,
        requisitionFileKey: requisitionFileKey ?? null,
      },
    });

    void createAuditLog(
      userId,
      {
        action: 'BLOOD_REQUEST_CREATED',
        entityType: 'BloodRequest',
        entityId: request.id,
        newValue: { bloodGroup, unitsNeeded, urgency, priorityLevel, hospitalName },
      },
      req,
    );

    res.status(201).json({ request });
  }),
);

// List blood requests route

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const role = req.user!.role as Role;
    const statusFilter = req.query.status as string | undefined;

    // Build where clause based on role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (role === Role.PATIENT) {
      // Patients only see their own requests
      const patient = await prisma.patient.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!patient) {
        throw new AppError('Patient profile not found', 404, 'PATIENT_NOT_FOUND');
      }
      where.patientId = patient.id;
    }
    // ADMIN and VOLUNTEER see all requests

    if (statusFilter) {
      where.status = statusFilter;
    }

    const requests = await prisma.bloodRequest.findMany({
      where,
      include: {
        patient: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
      orderBy: [
        { urgency: 'asc' }, // CRITICAL first (enum order)
        { createdAt: 'desc' },
      ],
    });

    res.status(200).json({ requests });
  }),
);

// Get blood request detail route

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const role = req.user!.role as Role;

    const request = await prisma.bloodRequest.findUnique({
      where: { id },
      include: {
        patient: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        hospital: true,
      },
    });

    if (!request) {
      throw new AppError('Blood request not found', 404, 'REQUEST_NOT_FOUND');
    }

    // Patients can only view their own requests
    if (role === Role.PATIENT) {
      const patient = await prisma.patient.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (request.patientId !== patient?.id) {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }
    }

    res.status(200).json({ request });
  }),
);

// ─── PATCH /:id/status — Update request status ─────────────────────────────

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

    const newStatus = parsed.data.status as RequestStatus;

    const request = await prisma.bloodRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new AppError('Blood request not found', 404, 'REQUEST_NOT_FOUND');
    }

    // Validate state machine transition
    try {
      assertValidTransition(request.status as RequestStatus, newStatus);
    } catch (err) {
      throw new AppError(
        err instanceof Error ? err.message : 'Invalid status transition',
        400,
        'INVALID_TRANSITION',
      );
    }

    const oldStatus = request.status;

    const updatedRequest = await prisma.bloodRequest.update({
      where: { id },
      data: { status: newStatus },
    });

    void createAuditLog(
      req.user!.userId,
      {
        action: 'BLOOD_REQUEST_STATUS_CHANGED',
        entityType: 'BloodRequest',
        entityId: id,
        oldValue: { status: oldStatus },
        newValue: { status: newStatus },
      },
      req,
    );

    res.status(200).json({ request: updatedRequest });
  }),
);

// ─── POST /:id/match — Trigger donor matching ──────────────────────────────

router.post(
  '/:id/match',
  requireRole(Role.ADMIN, Role.VOLUNTEER),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const request = await prisma.bloodRequest.findUnique({
      where: { id },
      include: { hospital: true },
    });

    if (!request) {
      throw new AppError('Blood request not found', 404, 'REQUEST_NOT_FOUND');
    }

    // Must be in VERIFIED status to trigger matching
    if (request.status !== RequestStatus.VERIFIED) {
      throw new AppError(
        `Cannot trigger matching for a request in "${request.status}" status. Request must be in "VERIFIED" status.`,
        400,
        'INVALID_STATUS_FOR_MATCHING',
      );
    }

    // Transition to MATCHING
    await prisma.bloodRequest.update({
      where: { id },
      data: { status: RequestStatus.MATCHING },
    });

    // Find compatible blood groups
    const compatibleGroups = getCompatibleDonorGroups(request.bloodGroup as BloodGroup);

    // Query eligible donors from database
    const eligibleDonorRecords = await prisma.donor.findMany({
      where: {
        isAvailable: true,
        bloodGroup: { in: compatibleGroups },
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Map to DonorProfile format expected by DonorRanker
    const donorProfiles = eligibleDonorRecords.map((d) => ({
      id: d.id,
      userId: d.userId,
      bloodGroup: d.bloodGroup as BloodGroup,
      lastDonationDate: d.lastDonationDate,
      latitude: d.latitude,
      longitude: d.longitude,
      totalDonations: d.totalDonations,
      isAvailable: d.isAvailable,
    }));

    // Rank donors via service interface
    const services = getServices(req);
    const rankedDonors = await services.donorRanker.rankDonors(donorProfiles, {
      bloodGroup: request.bloodGroup as BloodGroup,
      urgency: request.urgency as UrgencyLevel,
      hospitalLatitude: request.hospital?.latitude ?? undefined,
      hospitalLongitude: request.hospital?.longitude ?? undefined,
      unitsNeeded: request.unitsNeeded,
    });

    // Store ranked results and transition to MATCHED
    const updatedRequest = await prisma.bloodRequest.update({
      where: { id },
      data: {
        status: RequestStatus.MATCHED,
        matchedDonors: JSON.parse(JSON.stringify(rankedDonors)),
      },
    });

    // Notify top donors (up to 5)
    const topDonors = rankedDonors.slice(0, 5).filter((r) => r.score > 0);
    if (topDonors.length > 0) {
      const notifications = topDonors.map((ranked) => ({
        userId: ranked.donor.userId,
        type: 'DONOR_MATCH',
        title: 'Blood Donation Request',
        message: `A ${request.bloodGroup.replace('_', ' ').replace('POS', '+').replace('NEG', '-')} blood request needs your help! (${request.urgency} urgency, ${request.unitsNeeded} unit(s))`,
        channel: 'IN_APP' as const,
        metadata: { requestId: id, score: ranked.score },
      }));

      void services.notifier.sendBulk(notifications);
    }

    void createAuditLog(
      req.user!.userId,
      {
        action: 'BLOOD_REQUEST_DONORS_MATCHED',
        entityType: 'BloodRequest',
        entityId: id,
        newValue: {
          totalEligible: donorProfiles.length,
          totalRanked: rankedDonors.length,
          topDonorCount: topDonors.length,
        },
      },
      req,
    );

    res.status(200).json({
      request: updatedRequest,
      matching: {
        eligibleDonorsFound: donorProfiles.length,
        rankedDonors: rankedDonors.map((r) => ({
          donorId: r.donor.id,
          bloodGroup: r.donor.bloodGroup,
          score: r.score,
          reasons: r.reasons,
          donorName: eligibleDonorRecords.find((d) => d.id === r.donor.id)?.user.name,
        })),
      },
    });
  }),
);

// POST /:id/ocr — Extract data from blood requisition document

router.post(
  '/:id/ocr',
  requireRole(Role.ADMIN, Role.VOLUNTEER),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const request = await prisma.bloodRequest.findUnique({ where: { id } });
    if (!request) throw new AppError('Blood request not found', 404, 'REQUEST_NOT_FOUND');
    if (!request.requisitionFileKey) {
      throw new AppError('No requisition document uploaded', 400, 'NO_FILE');
    }

    const services = getServices(req);
    const fileBuffer = await services.fileStorage.download(request.requisitionFileKey);
    const mimeType = request.requisitionFileKey.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';

    const ocrResult = await services.ocrService.extractPrescription(fileBuffer, mimeType);

    const updatedRequest = await prisma.bloodRequest.update({
      where: { id },
      data: { ocrData: JSON.parse(JSON.stringify(ocrResult)) },
    });

    void createAuditLog(
      req.user!.userId,
      {
        action: 'BLOOD_REQUEST_OCR_COMPLETED',
        entityType: 'BloodRequest',
        entityId: id,
        newValue: { medicinesFound: ocrResult.medicines.length },
      },
      req,
    );

    res.status(200).json({ request: updatedRequest, ocrResult });
  }),
);

export { router as bloodRequestRoutes };
