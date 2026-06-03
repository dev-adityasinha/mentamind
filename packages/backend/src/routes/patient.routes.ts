import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { BloodGroup, Gender, decrypt } from '@mentamind/shared';
import { Role } from '@mentamind/shared';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../middleware/error-handler.js';
import { createAuditLog } from '../middleware/audit.js';
import { config } from '../config/env.js';

const prisma = new PrismaClient();
const router = Router();

// All patient routes require authentication + PATIENT role
router.use(authenticateToken);
router.use(requireRole(Role.PATIENT));

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const bloodGroupValues = Object.values(BloodGroup) as [string, ...string[]];
const genderValues = Object.values(Gender) as [string, ...string[]];

const updatePatientSchema = z.object({
  bloodGroup: z.enum(bloodGroupValues).optional(),
  age: z.number().int().min(0).max(150).optional(),
  gender: z.enum(genderValues).optional(),
  city: z.string().max(100).optional(),
  medicalNotes: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
  emergencyContact: z.string().max(20).optional(),
});

// ─── Async route wrapper ────────────────────────────────────────────────────

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
      include: {
        patient: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (!user.patient) {
      throw new AppError('Patient profile not found', 404, 'PATIENT_NOT_FOUND');
    }

    // Decrypt phone for display
    let phone: string;
    try {
      phone = decrypt(user.phone, config.ENCRYPTION_KEY);
    } catch {
      phone = user.phone; // fallback if not encrypted
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
      patient: {
        id: user.patient.id,
        bloodGroup: user.patient.bloodGroup,
        age: user.patient.age,
        gender: user.patient.gender,
        city: user.patient.city,
        medicalNotes: user.patient.medicalNotes,
        address: user.patient.address,
        emergencyContact: user.patient.emergencyContact,
        createdAt: user.patient.createdAt,
        updatedAt: user.patient.updatedAt,
      },
    });
  }),
);

// ─── PUT /me ────────────────────────────────────────────────────────────────

router.put(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updatePatientSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        `Validation failed: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
        400,
        'VALIDATION_ERROR',
      );
    }

    const userId = req.user!.userId;
    const data = parsed.data;

    // Ensure patient profile exists
    const patient = await prisma.patient.findUnique({
      where: { userId },
    });

    if (!patient) {
      throw new AppError('Patient profile not found', 404, 'PATIENT_NOT_FOUND');
    }

    const updateData: Record<string, unknown> = {};
    if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup;
    if (data.age !== undefined) updateData.age = data.age;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.medicalNotes !== undefined) updateData.medicalNotes = data.medicalNotes;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.emergencyContact !== undefined) updateData.emergencyContact = data.emergencyContact;

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No fields to update', 400, 'NO_UPDATE_DATA');
    }

    const oldValue = {
      bloodGroup: patient.bloodGroup,
      age: patient.age,
      gender: patient.gender,
      city: patient.city,
      medicalNotes: patient.medicalNotes,
      address: patient.address,
      emergencyContact: patient.emergencyContact,
    };

    const updatedPatient = await prisma.patient.update({
      where: { userId },
      data: updateData,
    });

    void createAuditLog(
      userId,
      {
        action: 'PATIENT_PROFILE_UPDATED',
        entityType: 'Patient',
        entityId: patient.id,
        oldValue,
        newValue: updateData,
      },
      req,
    );

    res.status(200).json({
      patient: {
        id: updatedPatient.id,
        bloodGroup: updatedPatient.bloodGroup,
        age: updatedPatient.age,
        gender: updatedPatient.gender,
        city: updatedPatient.city,
        medicalNotes: updatedPatient.medicalNotes,
        address: updatedPatient.address,
        emergencyContact: updatedPatient.emergencyContact,
        createdAt: updatedPatient.createdAt,
        updatedAt: updatedPatient.updatedAt,
      },
    });
  }),
);

export { router as patientRoutes };
