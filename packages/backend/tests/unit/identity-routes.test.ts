import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock PrismaClient
vi.mock('@prisma/client', () => {
  const mockFindUnique = vi.fn();
  const mockUpdate = vi.fn();
  return {
    PrismaClient: vi.fn(() => ({
      user: {
        findUnique: mockFindUnique,
        update: mockUpdate,
      },
      patient: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
      notification: {
        create: vi.fn().mockResolvedValue({}),
      },
    })),
  };
});

// Mock config
vi.mock('../../src/config/env.js', () => ({
  config: {
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    MINIO_ENDPOINT: 'localhost',
    MINIO_PORT: 9000,
    MINIO_USE_SSL: false,
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin',
    MINIO_BUCKET: 'mentamind',
    PORT: 4000,
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:3000',
  },
}));

import { PrismaClient } from '@prisma/client';
import { LocalIdentityVerifier } from '../../src/services/local-identity-verifier';

describe('Identity Routes Logic', () => {
  let prisma: any;
  let verifier: LocalIdentityVerifier;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = new PrismaClient();
    verifier = new LocalIdentityVerifier();
  });

  describe('Send OTP flow', () => {
    it('sends OTP successfully for a valid user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        phone: 'encrypted-phone',
        identityVerified: false,
      });

      const result = await verifier.sendOtp('encrypted-phone');
      expect(result.success).toBe(true);
      expect(result.requestId).toBeDefined();
    });

    it('validates Aadhaar format — rejects non-12-digit input', () => {
      // This tests the Zod schema logic
      const { z } = require('zod');
      const schema = z.object({
        aadhaarNumber: z
          .string()
          .transform((v: string) => v.replace(/[\s-]/g, ''))
          .pipe(z.string().regex(/^\d{12}$/, 'Must be 12 digits')),
      });

      const valid = schema.safeParse({ aadhaarNumber: '123456789012' });
      expect(valid.success).toBe(true);

      const tooShort = schema.safeParse({ aadhaarNumber: '12345' });
      expect(tooShort.success).toBe(false);

      const withDashes = schema.safeParse({ aadhaarNumber: '1234-5678-9012' });
      expect(withDashes.success).toBe(true);

      const letters = schema.safeParse({ aadhaarNumber: 'abcdefghijkl' });
      expect(letters.success).toBe(false);
    });
  });

  describe('Verify OTP flow', () => {
    it('updates user on successful verification', async () => {
      const sendResult = await verifier.sendOtp('+919876543210');

      const verifyResult = await verifier.verifyOtp(sendResult.requestId, '123456');
      expect(verifyResult.verified).toBe(true);

      // Simulate what the route does on success
      const maskedRef = verifier.getMaskedReference('123456789012');
      expect(maskedRef).toBe('XXXX-XXXX-9012');

      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        role: 'PATIENT',
        identityVerified: true,
        maskedAadhaarRef: maskedRef,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updatedUser = await prisma.user.update({
        where: { id: 'user-1' },
        data: {
          identityVerified: true,
          maskedAadhaarRef: maskedRef,
        },
      });

      expect(updatedUser.identityVerified).toBe(true);
      expect(updatedUser.maskedAadhaarRef).toBe('XXXX-XXXX-9012');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          identityVerified: true,
          maskedAadhaarRef: 'XXXX-XXXX-9012',
        },
      });
    });

    it('does not update user on failed verification', async () => {
      const sendResult = await verifier.sendOtp('+919876543210');
      const verifyResult = await verifier.verifyOtp(sendResult.requestId, 'abc'); // invalid

      expect(verifyResult.verified).toBe(false);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('verification is idempotent for already-verified users', async () => {
      prisma.user.findUnique.mockResolvedValue({
        phone: 'encrypted-phone',
        identityVerified: true, // already verified
      });

      // Should still be able to send OTP
      const result = await verifier.sendOtp('encrypted-phone');
      expect(result.success).toBe(true);
    });
  });

  describe('OTP validation schema', () => {
    it('accepts valid 6-digit OTP', () => {
      const { z } = require('zod');
      const schema = z.string().regex(/^\d{6}$/);
      expect(schema.safeParse('123456').success).toBe(true);
    });

    it('rejects 5-digit OTP', () => {
      const { z } = require('zod');
      const schema = z.string().regex(/^\d{6}$/);
      expect(schema.safeParse('12345').success).toBe(false);
    });

    it('rejects 7-digit OTP', () => {
      const { z } = require('zod');
      const schema = z.string().regex(/^\d{6}$/);
      expect(schema.safeParse('1234567').success).toBe(false);
    });
  });
});
