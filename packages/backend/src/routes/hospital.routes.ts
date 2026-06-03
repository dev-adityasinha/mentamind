import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { Role } from '@mentamind/shared';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../middleware/error-handler.js';
import { createAuditLog } from '../middleware/audit.js';

const prisma = new PrismaClient();
const router = Router();

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

const updateHospitalSchema = z.object({
  hospitalName: z.string().max(255).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  department: z.string().max(255).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

// GET / — Public list of verified hospitals (for blood request hospital picker)
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const hospitals = await prisma.hospital.findMany({
      where: { isVerified: true, isActive: true },
      select: {
        id: true,
        hospitalName: true,
        address: true,
        department: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { hospitalName: 'asc' },
    });

    res.status(200).json({ hospitals });
  }),
);

// GET /me — Hospital gets own profile (requires HOSPITAL role)
router.get(
  '/me',
  authenticateToken,
  requireRole(Role.HOSPITAL),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const hospital = await prisma.hospital.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, email: true, name: true, identityVerified: true, isActive: true },
        },
      },
    });

    if (!hospital) throw new AppError('Hospital profile not found', 404, 'HOSPITAL_NOT_FOUND');

    res.status(200).json({ hospital });
  }),
);

// PUT /me — Hospital updates own profile
router.put(
  '/me',
  authenticateToken,
  requireRole(Role.HOSPITAL),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateHospitalSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        `Validation failed: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        400,
        'VALIDATION_ERROR',
      );
    }

    const userId = req.user!.userId;
    const data = parsed.data;

    const hospital = await prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) throw new AppError('Hospital profile not found', 404, 'HOSPITAL_NOT_FOUND');

    const updateData: Record<string, unknown> = {};
    if (data.hospitalName !== undefined) updateData.hospitalName = data.hospitalName;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No fields to update', 400, 'NO_UPDATE_DATA');
    }

    const updated = await prisma.hospital.update({ where: { userId }, data: updateData });

    void createAuditLog(
      userId,
      {
        action: 'HOSPITAL_PROFILE_UPDATED',
        entityType: 'Hospital',
        entityId: hospital.id,
        oldValue: {
          hospitalName: hospital.hospitalName,
          address: hospital.address,
          department: hospital.department,
        },
        newValue: updateData,
      },
      req,
    );

    res.status(200).json({ hospital: updated });
  }),
);

// PATCH /:id/verify — Admin verifies a hospital
router.patch(
  '/:id/verify',
  authenticateToken,
  requireRole(Role.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { isVerified } = z.object({ isVerified: z.boolean() }).parse(req.body);

    const hospital = await prisma.hospital.findUnique({ where: { id } });
    if (!hospital) throw new AppError('Hospital not found', 404, 'HOSPITAL_NOT_FOUND');

    const updated = await prisma.hospital.update({
      where: { id },
      data: { isVerified },
    });

    void createAuditLog(
      req.user!.userId,
      {
        action: isVerified ? 'HOSPITAL_VERIFIED' : 'HOSPITAL_UNVERIFIED',
        entityType: 'Hospital',
        entityId: id,
        oldValue: { isVerified: hospital.isVerified },
        newValue: { isVerified },
      },
      req,
    );

    res.status(200).json({ hospital: updated });
  }),
);

// GET /:id — Get hospital detail (admin/volunteer)
router.get(
  '/:id',
  authenticateToken,
  requireRole(Role.ADMIN, Role.VOLUNTEER),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const hospital = await prisma.hospital.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, name: true, identityVerified: true, isActive: true },
        },
        bloodRequests: {
          select: { id: true, bloodGroup: true, urgency: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!hospital) throw new AppError('Hospital not found', 404, 'HOSPITAL_NOT_FOUND');

    res.status(200).json({ hospital });
  }),
);

export { router as hospitalRoutes };
