import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { createAuditLog } from '../middleware/audit.js';
import { ServiceContainer } from '../services/service-container.js';

const prisma = new PrismaClient();
const router = Router();

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const sendOtpSchema = z.object({
  aadhaarNumber: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, '')) // strip spaces/dashes
    .pipe(
      z.string().regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
    ),
});

const verifyOtpSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  aadhaarNumber: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .pipe(
      z.string().regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
    ),
});

// ─── Async route wrapper ────────────────────────────────────────────────────

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

// ─── Helper: Get services from app ──────────────────────────────────────────

function getServices(req: Request): ServiceContainer {
  return req.app.get('services') as ServiceContainer;
}

// ─── POST /send-otp ─────────────────────────────────────────────────────────

router.post(
  '/send-otp',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = sendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        `Validation failed: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        400,
        'VALIDATION_ERROR',
      );
    }

    const { aadhaarNumber } = parsed.data;
    const userId = req.user!.userId;

    // Get user's phone for OTP sending
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, identityVerified: true },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Allow re-verification (idempotent)
    const services = getServices(req);
    const result = await services.identityVerifier.sendOtp(user.phone);

    // Audit log the attempt (fire-and-forget)
    void createAuditLog(
      userId,
      {
        action: 'IDENTITY_OTP_SENT',
        entityType: 'User',
        entityId: userId,
        newValue: {
          maskedAadhaar: services.identityVerifier.getMaskedReference(aadhaarNumber),
        },
      },
      req,
    );

    res.status(200).json({
      success: result.success,
      requestId: result.requestId,
    });
  }),
);

// ─── POST /verify-otp ───────────────────────────────────────────────────────

router.post(
  '/verify-otp',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        `Validation failed: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        400,
        'VALIDATION_ERROR',
      );
    }

    const { requestId, otp, aadhaarNumber } = parsed.data;
    const userId = req.user!.userId;

    const services = getServices(req);
    const result = await services.identityVerifier.verifyOtp(requestId, otp);

    if (!result.verified) {
      // Audit log failed attempt
      void createAuditLog(
        userId,
        {
          action: 'IDENTITY_VERIFICATION_FAILED',
          entityType: 'User',
          entityId: userId,
        },
        req,
      );

      res.status(200).json({
        verified: false,
        message: 'OTP verification failed. Please try again.',
      });
      return;
    }

    // Verification succeeded — compute masked reference and update user
    const maskedRef = services.identityVerifier.getMaskedReference(aadhaarNumber);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        identityVerified: true,
        maskedAadhaarRef: maskedRef,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        identityVerified: true,
        maskedAadhaarRef: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log success
    void createAuditLog(
      userId,
      {
        action: 'IDENTITY_VERIFIED',
        entityType: 'User',
        entityId: userId,
        newValue: {
          identityVerified: true,
          maskedAadhaarRef: maskedRef,
        },
      },
      req,
    );

    // Send in-app notification (fire-and-forget)
    void services.notifier.send({
      userId,
      type: 'IDENTITY_VERIFIED',
      title: 'Identity Verified',
      message: `Your identity has been successfully verified. Aadhaar reference: ${maskedRef}`,
      channel: 'IN_APP',
    });

    res.status(200).json({
      verified: true,
      user: updatedUser,
    });
  }),
);

export { router as identityRoutes };
