import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, hashForLookup } from '@mentamind/shared';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Encryption (AES-256-GCM)', () => {
  describe('encrypt / decrypt roundtrip', () => {
    it('encrypts and decrypts a simple string', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });

    it('handles empty string', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });

    it('handles unicode text', () => {
      const plaintext = '你好世界 🌍 مرحبا بالعالم';
      const encrypted = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });

    it('handles long strings', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });

    it('handles special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      const encrypted = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('security properties', () => {
    it('different plaintexts produce different ciphertexts', () => {
      const enc1 = encrypt('message A', TEST_KEY);
      const enc2 = encrypt('message B', TEST_KEY);
      expect(enc1).not.toBe(enc2);
    });

    it('same plaintext encrypts to different ciphertexts (random IV)', () => {
      const plaintext = 'same message';
      const enc1 = encrypt(plaintext, TEST_KEY);
      const enc2 = encrypt(plaintext, TEST_KEY);
      expect(enc1).not.toBe(enc2);
      // But both decrypt to same value
      expect(decrypt(enc1, TEST_KEY)).toBe(plaintext);
      expect(decrypt(enc2, TEST_KEY)).toBe(plaintext);
    });

    it('tampering with ciphertext throws error', () => {
      const encrypted = encrypt('sensitive data', TEST_KEY);
      // Tamper with the middle of the ciphertext
      const tampered = encrypted.slice(0, 10) + 'X' + encrypted.slice(11);
      expect(() => decrypt(tampered, TEST_KEY)).toThrow();
    });

    it('wrong key throws error', () => {
      const encrypted = encrypt('secret', TEST_KEY);
      const wrongKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });
  });

  describe('hashForLookup', () => {
    it('returns consistent hash for same input', () => {
      const hash1 = hashForLookup('test@example.com');
      const hash2 = hashForLookup('test@example.com');
      expect(hash1).toBe(hash2);
    });

    it('returns different hashes for different inputs', () => {
      const hash1 = hashForLookup('user1@example.com');
      const hash2 = hashForLookup('user2@example.com');
      expect(hash1).not.toBe(hash2);
    });

    it('returns a hex string of length 64 (SHA-256)', () => {
      const hash = hashForLookup('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
