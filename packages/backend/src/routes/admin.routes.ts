import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { Role } from '@mentamind/shared';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../middleware/error-handler.js';
import { createAuditLog } from '../middleware/audit.js';
import { ServiceContainer } from '../services/service-container.js';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticateToken);
router.use(requireRole(Role.ADMIN));

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

// ─── GET /stats — Platform overview statistics ──────────────────────────────

router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [
      totalUsers,
      usersByRole,
      verifiedUsers,
      totalBloodRequests,
      bloodRequestsByStatus,
      totalMedicineRequests,
      medicineRequestsByStatus,
      totalDonors,
      availableDonors,
      recentAuditCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['role'], _count: true }),
      prisma.user.count({ where: { identityVerified: true } }),
      prisma.bloodRequest.count(),
      prisma.bloodRequest.groupBy({ by: ['status'], _count: true }),
      prisma.medicineRequest.count(),
      prisma.medicineRequest.groupBy({ by: ['status'], _count: true }),
      prisma.donor.count(),
      prisma.donor.count({ where: { isAvailable: true } }),
      prisma.auditLog.count({
        where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);

    res.status(200).json({
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        byRole: Object.fromEntries(usersByRole.map((r) => [r.role, r._count])),
      },
      bloodRequests: {
        total: totalBloodRequests,
        byStatus: Object.fromEntries(bloodRequestsByStatus.map((r) => [r.status, r._count])),
      },
      medicineRequests: {
        total: totalMedicineRequests,
        byStatus: Object.fromEntries(medicineRequestsByStatus.map((r) => [r.status, r._count])),
      },
      donors: {
        total: totalDonors,
        available: availableDonors,
      },
      audit: {
        last24h: recentAuditCount,
      },
    });
  }),
);

// ─── GET /analytics — Demand analysis via AnalysisEngine ────────────────────

const analyticsSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

router.get(
  '/analytics',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = analyticsSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError('Invalid query params', 400, 'VALIDATION_ERROR');
    }

    const services = getServices(req);
    const { days } = parsed.data;

    const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : new Date();
    const startDate = parsed.data.startDate
      ? new Date(parsed.data.startDate)
      : new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new AppError('Invalid date format for startDate or endDate', 400, 'VALIDATION_ERROR');
    }

    const daysBack = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    const [demand, shortages] = await Promise.all([
      services.analysisEngine.analyzeDemand({ startDate, endDate }),
      services.analysisEngine.predictShortages({ daysAhead: 14 }),
    ]);

    res.status(200).json({ demand, shortages, period: { startDate, endDate, daysBack } });
  }),
);

// ─── GET /users — List all users ────────────────────────────────────────────

const roleValues = Object.values(Role) as [string, ...string[]];

const listUsersSchema = z.object({
  role: z.enum(roleValues).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get(
  '/users',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = listUsersSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError('Invalid query params', 400, 'VALIDATION_ERROR');
    }

    const { role, search, page, limit } = parsed.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          identityVerified: true,
          isActive: true,
          createdAt: true,
          _count: { select: { auditLogs: true, notifications: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.status(200).json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),
);

// ─── PATCH /users/:id — Toggle user active/inactive ────────────────────────

const toggleUserSchema = z.object({
  isActive: z.boolean(),
});

router.patch(
  '/users/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const parsed = toggleUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid body', 400, 'VALIDATION_ERROR');
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: parsed.data.isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    void createAuditLog(
      req.user!.userId,
      {
        action: parsed.data.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entityType: 'User',
        entityId: id,
        oldValue: { isActive: user.isActive },
        newValue: { isActive: parsed.data.isActive },
      },
      req,
    );

    res.status(200).json({ user: updated });
  }),
);

// ─── GET /audit — Query audit logs ──────────────────────────────────────────

const auditQuerySchema = z.object({
  action: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

router.get(
  '/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError('Invalid query params', 400, 'VALIDATION_ERROR');
    }

    const { action, entityType, userId, startDate, endDate, page, limit } = parsed.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (entityType) where.entityType = entityType;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { name: true, email: true, role: true } },
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.status(200).json({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);

// ─── GET /notifications — List notifications for current user ───────────────
// (Available to all authenticated users, not just admin)

export const notificationRoutes = Router();
notificationRoutes.use(authenticateToken);

notificationRoutes.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const unreadOnly = req.query.unread === 'true';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId };
    if (unreadOnly) where.read = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    });

    res.status(200).json({ notifications, unreadCount });
  }),
);

notificationRoutes.patch(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new AppError('Notification not found', 404, 'NOT_FOUND');
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.status(200).json({ notification: updated });
  }),
);

notificationRoutes.patch(
  '/mark-all-read',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    res.status(200).json({ success: true });
  }),
);

export { router as adminRoutes };
