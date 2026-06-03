import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { Role, BloodGroup, decrypt } from '@mentamind/shared';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../middleware/error-handler.js';
import { createAuditLog } from '../middleware/audit.js';
import { config } from '../config/env.js';

const prisma = new PrismaClient();
const router = Router();

// All donor routes require authentication + DONOR role
router.use(authenticateToken);
router.use(requireRole(Role.DONOR));

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const updateDonorSchema = z.object({
  isAvailable: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  lastDonationDate: z.string().datetime().optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

// ─── GET /me ────────────────────────────────────────────────────────────────

router.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { donor: true },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (!user.donor) {
      throw new AppError('Donor profile not found', 404, 'DONOR_NOT_FOUND');
    }

    let phone: string;
    try {
      phone = decrypt(user.phone, config.ENCRYPTION_KEY);
    } catch {
      phone = user.phone;
    }

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone,
        role: user.role,
        identityVerified: user.identityVerified,
        maskedAadhaarRef: user.maskedAadhaarRef,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      donor: {
        id: user.donor.id,
        bloodGroup: user.donor.bloodGroup,
        lastDonationDate: user.donor.lastDonationDate,
        isAvailable: user.donor.isAvailable,
        latitude: user.donor.latitude,
        longitude: user.donor.longitude,
        totalDonations: user.donor.totalDonations,
        createdAt: user.donor.createdAt,
        updatedAt: user.donor.updatedAt,
      },
    });
  }),
);

// ─── PUT /me ────────────────────────────────────────────────────────────────

router.put(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateDonorSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        `Validation failed: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        400,
        'VALIDATION_ERROR',
      );
    }

    const userId = req.user!.userId;
    const data = parsed.data;

    const donor = await prisma.donor.findUnique({
      where: { userId },
    });

    if (!donor) {
      throw new AppError('Donor profile not found', 404, 'DONOR_NOT_FOUND');
    }

    const updateData: Record<string, unknown> = {};
    if (data.isAvailable !== undefined) updateData.isAvailable = data.isAvailable;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    if (data.lastDonationDate !== undefined) updateData.lastDonationDate = new Date(data.lastDonationDate);

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No fields to update', 400, 'NO_UPDATE_DATA');
    }

    const oldValue = {
      isAvailable: donor.isAvailable,
      latitude: donor.latitude,
      longitude: donor.longitude,
      lastDonationDate: donor.lastDonationDate,
    };

    const updatedDonor = await prisma.donor.update({
      where: { userId },
      data: updateData,
    });

    void createAuditLog(
      userId,
      {
        action: 'DONOR_PROFILE_UPDATED',
        entityType: 'Donor',
        entityId: donor.id,
        oldValue,
        newValue: updateData,
      },
      req,
    );

    res.status(200).json({
      donor: {
        id: updatedDonor.id,
        bloodGroup: updatedDonor.bloodGroup,
        lastDonationDate: updatedDonor.lastDonationDate,
        isAvailable: updatedDonor.isAvailable,
        latitude: updatedDonor.latitude,
        longitude: updatedDonor.longitude,
        totalDonations: updatedDonor.totalDonations,
        createdAt: updatedDonor.createdAt,
        updatedAt: updatedDonor.updatedAt,
      },
    });
  }),
);

export { router as donorRoutes };
