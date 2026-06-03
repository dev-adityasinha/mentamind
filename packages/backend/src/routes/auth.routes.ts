import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role, BloodGroup, Gender, encrypt, decrypt } from '@mentamind/shared';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticateToken,
} from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { createAuditLog } from '../middleware/audit.js';
import { config } from '../config/env.js';

const prisma = new PrismaClient();
const router = Router();

const BCRYPT_ROUNDS = 12;

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const bloodGroupValues = Object.values(BloodGroup) as [string, ...string[]];
const genderValues = Object.values(Gender) as [string, ...string[]];
const roleValues = Object.values(Role) as [string, ...string[]];

const registerSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(1, 'Name is required').max(255),
    phone: z.string().min(7, 'Phone number is too short').max(20),
    role: z.enum(roleValues),
    // Shared
    bloodGroup: z.enum(bloodGroupValues).optional(),
    // Patient-specific
    age: z.number().int().min(0).max(150).optional(),
    gender: z.enum(genderValues).optional(),
    city: z.string().max(100).optional(),
    medicalNotes: z.string().max(2000).optional(),
    address: z.string().max(500).optional(),
    emergencyContact: z.string().max(20).optional(),
    // Donor-specific
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    // Hospital-specific
    hospitalName: z.string().max(255).optional(),
    hospitalAddress: z.string().max(500).optional(),
    hospitalPhone: z.string().max(20).optional(),
    department: z.string().max(255).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === Role.DONOR && !data.bloodGroup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Blood group is required for donors',
        path: ['bloodGroup'],
      });
    }
    if (data.role === Role.HOSPITAL) {
      if (!data.hospitalName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Hospital name is required',
          path: ['hospitalName'],
        });
      }
    }
  });

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ─── Helper: Sanitize user (remove passwordHash) ───────────────────────────

interface SanitizedUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  identityVerified: boolean;
  maskedAadhaarRef: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function sanitizeUser(
  user: {
    id: string;
    email: string;
    name: string;
    phone: string;
    role: string;
    identityVerified: boolean;
    maskedAadhaarRef: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  encryptionKey: string,
): SanitizedUser {
  let decryptedPhone: string;
  try {
    decryptedPhone = decrypt(user.phone, encryptionKey);
  } catch {
    // If decryption fails, the phone might be stored in plain text (legacy)
    decryptedPhone = user.phone;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: decryptedPhone,
    role: user.role,
    identityVerified: user.identityVerified,
    maskedAadhaarRef: user.maskedAadhaarRef,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// ─── Async route wrapper ────────────────────────────────────────────────────

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

// ─── POST /register ─────────────────────────────────────────────────────────

router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        `Validation failed: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        400,
        'VALIDATION_ERROR',
      );
    }

    const data = parsed.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    // Hash password and encrypt phone
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const encryptedPhone = encrypt(data.phone, config.ENCRYPTION_KEY);

    // Create user + role-specific profile in a transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          name: data.name,
          phone: encryptedPhone,
          role: data.role as Role,
        },
      });

      // Create role-specific profile
      switch (data.role) {
        case Role.PATIENT:
          await tx.patient.create({
            data: {
              userId: newUser.id,
              bloodGroup: (data.bloodGroup as BloodGroup) ?? null,
              age: data.age ?? null,
              gender: (data.gender as Gender) ?? null,
              city: data.city ?? null,
              medicalNotes: data.medicalNotes ?? null,
              address: data.address ?? null,
              emergencyContact: data.emergencyContact ?? null,
            },
          });
          break;

        case Role.DONOR:
          await tx.donor.create({
            data: {
              userId: newUser.id,
              bloodGroup: data.bloodGroup as BloodGroup,
              city: data.city ?? null,
              latitude: data.latitude ?? null,
              longitude: data.longitude ?? null,
            },
          });
          break;

        case Role.HOSPITAL:
          await tx.hospital.create({
            data: {
              userId: newUser.id,
              hospitalName: data.hospitalName!,
              address: data.hospitalAddress ?? data.address ?? '',
              phone: data.hospitalPhone ?? data.phone,
              department: data.department ?? null,
              latitude: data.latitude ?? null,
              longitude: data.longitude ?? null,
            },
          });
          break;

        // VOLUNTEER and ADMIN don't have role-specific profiles
        case Role.VOLUNTEER:
        case Role.ADMIN:
          break;
      }

      return newUser;
    });

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as Role,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Create audit log (fire-and-forget)
    void createAuditLog(
      user.id,
      {
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: user.id,
        newValue: { email: user.email, role: user.role },
      },
      req,
    );

    res.status(201).json({
      user: sanitizeUser(user, config.ENCRYPTION_KEY),
      accessToken,
      refreshToken,
    });
  }),
);

// ─── POST /login ────────────────────────────────────────────────────────────

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        `Validation failed: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        400,
        'VALIDATION_ERROR',
      );
    }

    const { email, password } = parsed.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403, 'ACCOUNT_INACTIVE');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as Role,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Create audit log (fire-and-forget)
    void createAuditLog(
      user.id,
      {
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: user.id,
      },
      req,
    );

    res.status(200).json({
      user: sanitizeUser(user, config.ENCRYPTION_KEY),
      accessToken,
      refreshToken,
    });
  }),
);

// ─── POST /refresh ──────────────────────────────────────────────────────────

router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        `Validation failed: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        400,
        'VALIDATION_ERROR',
      );
    }

    const { refreshToken } = parsed.data;

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(
        'Invalid or expired refresh token',
        401,
        'INVALID_REFRESH_TOKEN',
      );
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user || !user.isActive) {
      throw new AppError(
        'User not found or account deactivated',
        401,
        'USER_NOT_FOUND',
      );
    }

    // Generate new token pair
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as Role,
    };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  }),
);

// ─── POST /logout ───────────────────────────────────────────────────────────

router.post(
  '/logout',
  asyncHandler(async (_req: Request, res: Response) => {
    // In Phase 0, we don't maintain a token blacklist.
    // The client should discard the tokens on its side.
    // Real token blacklisting will be implemented later.
    res.status(200).json({
      message: 'Logged out successfully',
    });
  }),
);

// ─── GET /me ────────────────────────────────────────────────────────────────

router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        patient: true,
        donor: true,
        hospital: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const sanitized = sanitizeUser(user, config.ENCRYPTION_KEY);

    res.status(200).json({
      user: {
        ...sanitized,
        patient: user.patient ?? undefined,
        donor: user.donor ?? undefined,
        hospital: user.hospital ?? undefined,
      },
    });
  }),
);

export { router as authRoutes };
