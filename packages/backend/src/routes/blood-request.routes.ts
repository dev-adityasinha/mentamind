import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  BloodGroup,
  Role,
  RequestStatus,
  UrgencyLevel,
  PriorityLevel,
  DonorResponseStatus,
  assertValidTransition,
  getCompatibleDonorGroups,
  canDonate,
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
  appointmentDate: z.string().datetime().optional(),
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
      appointmentDate,
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
        appointmentDate: appointmentDate ? new Date(appointmentDate) : null,
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

// ─── GET /my-assignments — Donor sees their assigned blood requests ──────────
// NOTE: Must be declared BEFORE /:id to prevent Express matching it as an id

router.get(
  '/my-assignments',
  requireRole(Role.DONOR),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const donor = await prisma.donor.findUnique({ where: { userId } });
    if (!donor) throw new AppError('Donor profile not found', 404, 'DONOR_NOT_FOUND');

    const requests = await prisma.bloodRequest.findMany({
      where: {
        assignedDonorId: donor.id,
        status: { notIn: [RequestStatus.CANCELLED, RequestStatus.REJECTED, RequestStatus.FULFILLED] },
      },
      include: {
        patient: { include: { user: { select: { id: true, name: true } } } },
        hospital: { select: { hospitalName: true, address: true, latitude: true, longitude: true, phone: true } },
      },
      orderBy: [{ donorResponseStatus: 'asc' }, { appointmentDate: 'asc' }, { createdAt: 'desc' }],
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

// ─── Location helpers ──────────────────────────────────────────────────────

const SAME_LOCATION_MAX_KM = 25;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface LocationResult {
  isSame: boolean;
  reason: string;
  distanceKm?: number;
}

function checkSameLocation(
  patientCity: string | null,
  patientLat: number | null,
  patientLng: number | null,
  donorCity: string | null,
  donorLat: number | null,
  donorLng: number | null,
): LocationResult {
  // Primary: city name match (case-insensitive, trimmed)
  if (patientCity && donorCity) {
    if (patientCity.trim().toLowerCase() === donorCity.trim().toLowerCase()) {
      return { isSame: true, reason: `Same city: ${patientCity}` };
    }
  }

  // Secondary: coordinate-based proximity
  if (
    patientLat !== null && patientLng !== null &&
    donorLat   !== null && donorLng   !== null
  ) {
    const dist = haversineKm(patientLat, patientLng, donorLat, donorLng);
    if (dist <= SAME_LOCATION_MAX_KM) {
      return { isSame: true, reason: `${dist.toFixed(1)} km from patient`, distanceKm: dist };
    }
    return { isSame: false, reason: `${dist.toFixed(1)} km from patient (>${SAME_LOCATION_MAX_KM} km limit)`, distanceKm: dist };
  }

  // No usable location data
  if (!patientCity && patientLat === null) {
    return { isSame: false, reason: 'Patient location not set — update patient profile with city or coordinates' };
  }
  if (!donorCity && donorLat === null) {
    return { isSame: false, reason: 'Donor location not set' };
  }
  return { isSame: false, reason: `Different cities: patient in "${patientCity ?? 'unknown'}", donor in "${donorCity ?? 'unknown'}"` };
}

// ─── GET /:id/eligible-donors — Hospital views donors eligible to assign ─────

router.get(
  '/:id/eligible-donors',
  requireRole(Role.HOSPITAL, Role.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    // Load request with patient location
    const request = await prisma.bloodRequest.findUnique({
      where: { id },
      include: {
        patient: { select: { city: true, address: true, user: { select: { name: true } } } },
        hospital: { select: { latitude: true, longitude: true } },
      },
    });

    if (!request) throw new AppError('Blood request not found', 404, 'REQUEST_NOT_FOUND');

    // Fetch the patient's location fields from Patient model
    const patient = await prisma.patient.findUnique({
      where: { id: request.patientId },
      select: { city: true, address: true },
    });

    // Find all available donors with compatible blood groups
    const compatibleGroups = getCompatibleDonorGroups(request.bloodGroup as BloodGroup);

    const donors = await prisma.donor.findMany({
      where: {
        isAvailable: true,
        bloodGroup: { in: compatibleGroups },
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Score each donor: blood compatibility + location + eligibility
    const today = new Date();
    const eligible = donors.map((donor) => {
      const isExactMatch = donor.bloodGroup === request.bloodGroup;
      const compatibility = isExactMatch ? 'exact' : 'compatible';

      // Days since last donation
      const daysSinceDonation = donor.lastDonationDate
        ? Math.floor((today.getTime() - new Date(donor.lastDonationDate).getTime()) / 86400000)
        : null;
      const donationEligible = daysSinceDonation === null || daysSinceDonation >= 56;

      // Location check: patient city vs donor city
      const patientCity = patient?.city ?? null;
      // Use hospital lat/lng if patient has no coordinates (patient location via city only)
      const location = checkSameLocation(
        patientCity, null, null,
        donor.city, donor.latitude, donor.longitude,
      );

      return {
        donorId: donor.id,
        name: donor.user.name,
        bloodGroup: donor.bloodGroup,
        compatibility,
        city: donor.city,
        latitude: donor.latitude,
        longitude: donor.longitude,
        totalDonations: donor.totalDonations,
        responseScore: donor.responseScore,
        lastDonationDate: donor.lastDonationDate,
        daysSinceDonation,
        donationEligible,
        location,
        isEligible: location.isSame && donationEligible,
      };
    });

    // Sort: eligible first, then by responseScore desc
    eligible.sort((a, b) => {
      if (a.isEligible && !b.isEligible) return -1;
      if (!a.isEligible && b.isEligible) return 1;
      return b.responseScore - a.responseScore;
    });

    res.status(200).json({
      requestBloodGroup: request.bloodGroup,
      patientCity: patient?.city ?? null,
      donors: eligible,
      eligibleCount: eligible.filter((d) => d.isEligible).length,
    });
  }),
);

// ─── POST /:id/assign-donor — Hospital assigns a specific donor ───────────────

router.post(
  '/:id/assign-donor',
  requireRole(Role.HOSPITAL, Role.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const parsed = z.object({ donorId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('donorId (UUID) is required', 400, 'VALIDATION_ERROR');
    }

    const { donorId } = parsed.data;

    // Load request
    const request = await prisma.bloodRequest.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, city: true, userId: true, user: { select: { name: true } } } },
      },
    });
    if (!request) throw new AppError('Blood request not found', 404, 'REQUEST_NOT_FOUND');

    // Must not already be FULFILLED / CANCELLED / REJECTED
    if (['FULFILLED', 'CANCELLED', 'REJECTED'].includes(request.status)) {
      throw new AppError(
        `Cannot assign a donor to a ${request.status} request`,
        400,
        'INVALID_STATUS',
      );
    }

    // Load donor
    const donor = await prisma.donor.findUnique({
      where: { id: donorId },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!donor) throw new AppError('Donor not found', 404, 'DONOR_NOT_FOUND');

    // ── Guard 1: Blood group compatibility ──────────────────────────────────
    const compatible = canDonate(donor.bloodGroup as BloodGroup, request.bloodGroup as BloodGroup);
    if (!compatible) {
      throw new AppError(
        `Blood group mismatch: donor is ${donor.bloodGroup} but patient needs ${request.bloodGroup}-compatible blood`,
        422,
        'BLOOD_GROUP_INCOMPATIBLE',
      );
    }

    // ── Guard 2: Same location ───────────────────────────────────────────────
    const patient = await prisma.patient.findUnique({
      where: { id: request.patientId },
      select: { city: true },
    });

    const location = checkSameLocation(
      patient?.city ?? null, null, null,
      donor.city, donor.latitude, donor.longitude,
    );

    if (!location.isSame) {
      throw new AppError(
        `Location mismatch: ${location.reason}. Donor and patient must be in the same city or within ${SAME_LOCATION_MAX_KM} km.`,
        422,
        'LOCATION_MISMATCH',
      );
    }

    // ── Guard 3: Donation eligibility (56-day rule) ──────────────────────────
    if (donor.lastDonationDate) {
      const days = Math.floor(
        (Date.now() - new Date(donor.lastDonationDate).getTime()) / 86400000,
      );
      if (days < 56) {
        throw new AppError(
          `Donor last donated ${days} days ago. Minimum 56 days required between donations.`,
          422,
          'DONOR_NOT_ELIGIBLE',
        );
      }
    }

    // ── Assign ───────────────────────────────────────────────────────────────
    const updated = await prisma.bloodRequest.update({
      where: { id },
      data: {
        assignedDonorId: donorId,
        assignedAt: new Date(),
        // Advance status to IN_PROGRESS if it was MATCHED or earlier active states
        status: ['DRAFT','PENDING_VERIFICATION','VERIFIED','MATCHING','MATCHED'].includes(request.status)
          ? RequestStatus.IN_PROGRESS
          : request.status,
      },
      include: {
        assignedDonor: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    // Notify donor
    const services = getServices(req);
    void services.notifier.send({
      userId: donor.user.id,
      type: 'DONOR_ASSIGNED',
      title: 'You have been assigned for a blood donation',
      message: `You have been assigned to donate ${donor.bloodGroup.replace('_POS', '+').replace('_NEG', '−')} blood for a patient. Please contact the hospital immediately.`,
      channel: 'IN_APP',
    });

    // Notify patient
    void services.notifier.send({
      userId: request.patient.userId,
      type: 'DONOR_ASSIGNED_TO_REQUEST',
      title: 'A donor has been assigned to your blood request',
      message: `A compatible donor (${donor.bloodGroup.replace('_POS', '+').replace('_NEG', '−')}) has been assigned to your blood request by the hospital.`,
      channel: 'IN_APP',
    });

    void createAuditLog(
      req.user!.userId,
      {
        action: 'DONOR_ASSIGNED_BY_HOSPITAL',
        entityType: 'BloodRequest',
        entityId: id,
        oldValue: { assignedDonorId: request.assignedDonorId, status: request.status },
        newValue: { assignedDonorId: donorId, donorName: donor.user.name, location: location.reason, status: updated.status },
      },
      req,
    );

    res.status(200).json({
      request: updated,
      assignment: {
        donorName: donor.user.name,
        donorBloodGroup: donor.bloodGroup,
        locationReason: location.reason,
        distanceKm: location.distanceKm ?? null,
      },
    });
  }),
);

// ─── DELETE /:id/assign-donor — Hospital removes donor assignment ─────────────

router.delete(
  '/:id/assign-donor',
  requireRole(Role.HOSPITAL, Role.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const request = await prisma.bloodRequest.findUnique({ where: { id } });
    if (!request) throw new AppError('Blood request not found', 404, 'REQUEST_NOT_FOUND');

    if (!request.assignedDonorId) {
      throw new AppError('No donor is currently assigned to this request', 400, 'NO_ASSIGNMENT');
    }

    if (['FULFILLED', 'CANCELLED', 'REJECTED'].includes(request.status)) {
      throw new AppError(`Cannot remove assignment from a ${request.status} request`, 400, 'INVALID_STATUS');
    }

    const updated = await prisma.bloodRequest.update({
      where: { id },
      data: {
        assignedDonorId: null,
        assignedAt: null,
        // Revert to MATCHED if it was IN_PROGRESS due to assignment
        status: request.status === RequestStatus.IN_PROGRESS ? RequestStatus.MATCHED : request.status,
      },
    });

    void createAuditLog(
      req.user!.userId,
      {
        action: 'DONOR_ASSIGNMENT_REMOVED',
        entityType: 'BloodRequest',
        entityId: id,
        oldValue: { assignedDonorId: request.assignedDonorId },
        newValue: { assignedDonorId: null },
      },
      req,
    );

    res.status(200).json({ request: updated });
  }),
);

// ─── POST /:id/donor-response — Donor accepts or declines assignment ────────

router.post(
  '/:id/donor-response',
  requireRole(Role.DONOR),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const parsed = z.object({
      response: z.enum(['ACCEPTED', 'DECLINED']),
      declineReason: z.string().max(500).optional(),
    }).safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(
        `Validation failed: ${parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        400, 'VALIDATION_ERROR',
      );
    }

    const userId = req.user!.userId;
    const donor = await prisma.donor.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!donor) throw new AppError('Donor profile not found', 404, 'DONOR_NOT_FOUND');

    const request = await prisma.bloodRequest.findUnique({
      where: { id },
      include: {
        patient: { include: { user: { select: { id: true, name: true } } } },
        hospital: { select: { hospitalName: true, address: true } },
      },
    });

    if (!request) throw new AppError('Blood request not found', 404, 'REQUEST_NOT_FOUND');
    if (request.assignedDonorId !== donor.id) {
      throw new AppError('You are not assigned to this request', 403, 'NOT_ASSIGNED');
    }
    if (request.donorResponseStatus !== DonorResponseStatus.PENDING) {
      throw new AppError(
        `You have already ${request.donorResponseStatus.toLowerCase()} this request`,
        400, 'ALREADY_RESPONDED',
      );
    }

    const { response, declineReason } = parsed.data;
    const services = getServices(req);

    if (response === 'ACCEPTED') {
      // Update request: accepted + move to IN_PROGRESS
      const updated = await prisma.bloodRequest.update({
        where: { id },
        data: {
          donorResponseStatus: DonorResponseStatus.ACCEPTED,
          donorResponseAt: new Date(),
          status: RequestStatus.IN_PROGRESS,
        },
      });

      // Build rich patient notification
      const apptLine = request.appointmentDate
        ? `Appointment: ${new Date(request.appointmentDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
        : 'Appointment date to be confirmed by hospital.';
      const hospitalLine = request.hospital?.hospitalName ?? request.hospitalName ?? 'Hospital';
      const donorLocation = donor.city ? `Donor location: ${donor.city}` : '';

      void services.notifier.send({
        userId: request.patient.user.id,
        type: 'DONOR_ACCEPTED',
        title: '🎉 A donor has been confirmed for your request!',
        message: [
          `Donor ${donor.user.name} (${donor.bloodGroup.replace('_POS', '+').replace('_NEG', '−')}) has accepted your blood request.`,
          apptLine,
          `Hospital: ${hospitalLine}`,
          donorLocation,
        ].filter(Boolean).join('\n'),
        channel: 'IN_APP',
      });

      void createAuditLog(userId, {
        action: 'DONOR_ACCEPTED_REQUEST', entityType: 'BloodRequest', entityId: id,
        newValue: { donorId: donor.id, donorName: donor.user.name },
      }, req);

      res.status(200).json({ request: updated, message: 'You have accepted the request.' });

    } else {
      // DECLINED — remove assignment, reset donor response, mark donor unavailable
      const updated = await prisma.bloodRequest.update({
        where: { id },
        data: {
          donorResponseStatus: DonorResponseStatus.DECLINED,
          donorResponseAt: new Date(),
          donorDeclineReason: declineReason ?? null,
          assignedDonorId: null,
          assignedAt: null,
          // Revert to MATCHED so hospital can assign another donor
          status: request.status === RequestStatus.IN_PROGRESS ? RequestStatus.MATCHED : request.status,
        },
      });

      // Mark donor as unavailable so they don't get re-matched immediately
      await prisma.donor.update({
        where: { id: donor.id },
        data: { isAvailable: false },
      });

      // Notify patient
      void services.notifier.send({
        userId: request.patient.user.id,
        type: 'DONOR_DECLINED',
        title: '⚠ Donor is currently unavailable',
        message: `The assigned donor is not available at this time${declineReason ? `: "${declineReason}"` : '.'}  Your request is active — the hospital will assign another donor shortly.`,
        channel: 'IN_APP',
      });

      void createAuditLog(userId, {
        action: 'DONOR_DECLINED_REQUEST', entityType: 'BloodRequest', entityId: id,
        newValue: { donorId: donor.id, declineReason: declineReason ?? null },
      }, req);

      res.status(200).json({ request: updated, message: 'You have declined the request. Your availability has been set to unavailable.' });
    }
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
