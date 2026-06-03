import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { Role, CallStatus, RequestStatus } from '@mentamind/shared';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../middleware/error-handler.js';
import { createAuditLog } from '../middleware/audit.js';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticateToken);
router.use(requireRole(Role.VOLUNTEER, Role.ADMIN));

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

const callStatusValues = Object.values(CallStatus) as [string, ...string[]];

const logCallSchema = z.object({
  donorId: z.string().uuid(),
  callStatus: z.enum(callStatusValues),
  callAttempt: z.number().int().min(1).default(1),
  notes: z.string().max(1000).optional(),
});

// GET /dashboard — Active blood requests for volunteer panel
router.get(
  '/dashboard',
  asyncHandler(async (req: Request, res: Response) => {
    const activeStatuses = [
      RequestStatus.PENDING_VERIFICATION,
      RequestStatus.VERIFIED,
      RequestStatus.MATCHING,
      RequestStatus.MATCHED,
      RequestStatus.IN_PROGRESS,
    ];

    const requests = await prisma.bloodRequest.findMany({
      where: { status: { in: activeStatuses } },
      include: {
        patient: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        hospital: {
          select: {
            id: true,
            hospitalName: true,
            address: true,
            department: true,
            phone: true,
            latitude: true,
            longitude: true,
          },
        },
        callLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            donor: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ priorityLevel: 'asc' }, { urgency: 'asc' }, { createdAt: 'asc' }],
    });

    res.status(200).json({ requests, total: requests.length });
  }),
);

// GET /performance — Volunteer performance metrics
router.get(
  '/performance',
  asyncHandler(async (req: Request, res: Response) => {
    const volunteerId = req.user!.userId;

    const [totalCalls, successfulConversions, recentCalls] = await Promise.all([
      prisma.donorCallLog.count({ where: { volunteerId } }),
      prisma.donorCallLog.count({
        where: { volunteerId, callStatus: { in: [CallStatus.INTERESTED, CallStatus.DONATED] } },
      }),
      prisma.donorCallLog.findMany({
        where: { volunteerId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          donor: { include: { user: { select: { id: true, name: true } } } },
          bloodRequest: {
            select: { id: true, bloodGroup: true, urgency: true, status: true },
          },
        },
      }),
    ]);

    const conversionRate = totalCalls > 0 ? (successfulConversions / totalCalls) * 100 : 0;

    res.status(200).json({
      metrics: {
        totalCalls,
        successfulConversions,
        conversionRate: Math.round(conversionRate * 100) / 100,
      },
      recentCalls,
    });
  }),
);

// POST /blood-requests/:id/call-logs — Log a donor call attempt
router.post(
  '/blood-requests/:id/call-logs',
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const parsed = logCallSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        `Validation failed: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        400,
        'VALIDATION_ERROR',
      );
    }

    const volunteerId = req.user!.userId;
    const { donorId, callStatus, callAttempt, notes } = parsed.data;

    const [bloodRequest, donor] = await Promise.all([
      prisma.bloodRequest.findUnique({ where: { id } }),
      prisma.donor.findUnique({ where: { id: donorId } }),
    ]);

    if (!bloodRequest) throw new AppError('Blood request not found', 404, 'REQUEST_NOT_FOUND');
    if (!donor) throw new AppError('Donor not found', 404, 'DONOR_NOT_FOUND');

    const callLog = await prisma.donorCallLog.create({
      data: {
        bloodRequestId: id,
        donorId,
        volunteerId,
        callStatus: callStatus as CallStatus,
        callAttempt,
        notes: notes ?? null,
      },
      include: {
        donor: { include: { user: { select: { id: true, name: true } } } },
        volunteer: { select: { id: true, name: true } },
      },
    });

    // Update donor responseScore based on call outcome
    if (callStatus === CallStatus.DONATED || callStatus === CallStatus.INTERESTED) {
      await prisma.donor.update({
        where: { id: donorId },
        data: { responseScore: { increment: callStatus === CallStatus.DONATED ? 2 : 1 } },
      });
      if (callStatus === CallStatus.DONATED) {
        await prisma.donor.update({
          where: { id: donorId },
          data: {
            totalDonations: { increment: 1 },
            lastDonationDate: new Date(),
          },
        });
      }
    } else if (callStatus === CallStatus.REJECTED) {
      await prisma.donor.update({
        where: { id: donorId },
        data: { responseScore: { decrement: 0.5 } },
      });
    }

    void createAuditLog(
      volunteerId,
      {
        action: 'DONOR_CALL_LOGGED',
        entityType: 'DonorCallLog',
        entityId: callLog.id,
        newValue: { bloodRequestId: id, donorId, callStatus, callAttempt },
      },
      req,
    );

    res.status(201).json({ callLog });
  }),
);

// GET /blood-requests/:id/call-logs — Get call history for a request
router.get(
  '/blood-requests/:id/call-logs',
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const bloodRequest = await prisma.bloodRequest.findUnique({ where: { id } });
    if (!bloodRequest) throw new AppError('Blood request not found', 404, 'REQUEST_NOT_FOUND');

    const callLogs = await prisma.donorCallLog.findMany({
      where: { bloodRequestId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        donor: {
          include: { user: { select: { id: true, name: true } } },
        },
        volunteer: { select: { id: true, name: true } },
      },
    });

    // Summarise call status counts
    const summary = callLogs.reduce(
      (acc, log) => {
        acc[log.callStatus] = (acc[log.callStatus] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    res.status(200).json({ callLogs, summary, total: callLogs.length });
  }),
);

export { router as volunteerRoutes };
