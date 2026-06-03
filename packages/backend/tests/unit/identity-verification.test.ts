import { describe, it, expect } from 'vitest';
import { LocalIdentityVerifier } from '../../src/services/local-identity-verifier';

describe('LocalIdentityVerifier', () => {
  const verifier = new LocalIdentityVerifier();

  describe('sendOtp', () => {
    it('returns success with a requestId', async () => {
      const result = await verifier.sendOtp('+919876543210');
      expect(result.success).toBe(true);
      expect(result.requestId).toBeDefined();
      expect(typeof result.requestId).toBe('string');
      expect(result.requestId.length).toBeGreaterThan(0);
    });

    it('returns different requestIds for different calls', async () => {
      const r1 = await verifier.sendOtp('+919876543210');
      const r2 = await verifier.sendOtp('+919876543210');
      expect(r1.requestId).not.toBe(r2.requestId);
    });
  });

  describe('verifyOtp', () => {
    it('returns verified=true for valid 6-digit OTP', async () => {
      const sendResult = await verifier.sendOtp('+919876543210');
      const result = await verifier.verifyOtp(sendResult.requestId, '123456');
      expect(result.verified).toBe(true);
      expect(result.maskedReference).toBeDefined();
    });

    it('returns verified=false for OTP with less than 6 digits', async () => {
      const sendResult = await verifier.sendOtp('+919876543210');
      const result = await verifier.verifyOtp(sendResult.requestId, '12345');
      expect(result.verified).toBe(false);
    });

    it('returns verified=false for OTP with non-digit characters', async () => {
      const sendResult = await verifier.sendOtp('+919876543210');
      const result = await verifier.verifyOtp(sendResult.requestId, 'abcdef');
      expect(result.verified).toBe(false);
    });

    it('returns verified=false for empty OTP', async () => {
      const sendResult = await verifier.sendOtp('+919876543210');
      const result = await verifier.verifyOtp(sendResult.requestId, '');
      expect(result.verified).toBe(false);
    });

    it('returns verified=true for any 6-digit OTP (local mode)', async () => {
      const sendResult = await verifier.sendOtp('+919876543210');
      const result = await verifier.verifyOtp(sendResult.requestId, '000000');
      expect(result.verified).toBe(true);
    });
  });

  describe('getMaskedReference', () => {
    it('masks a 12-digit Aadhaar number correctly', () => {
      const masked = verifier.getMaskedReference('123456781234');
      expect(masked).toBe('XXXX-XXXX-1234');
    });

    it('masks a number with dashes/spaces', () => {
      // Note: the caller should strip these, but getMaskedReference handles raw digits
      const masked = verifier.getMaskedReference('1234-5678-9012');
      expect(masked).toBe('XXXX-XXXX-9012');
    });

    it('handles shorter inputs by padding', () => {
      const masked = verifier.getMaskedReference('12');
      expect(masked).toBe('XXXX-XXXX-0012');
    });

    it('handles 4-digit input', () => {
      const masked = verifier.getMaskedReference('5678');
      expect(masked).toBe('XXXX-XXXX-5678');
    });

    it('handles longer input by taking last 4', () => {
      const masked = verifier.getMaskedReference('9999888877776666');
      expect(masked).toBe('XXXX-XXXX-6666');
    });

    it('strips non-digit characters', () => {
      const masked = verifier.getMaskedReference('1234 5678 9012');
      expect(masked).toBe('XXXX-XXXX-9012');
    });
  });
});
