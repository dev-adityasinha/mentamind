import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt
 * @param keyHex - A 64-character hex string representing the 256-bit encryption key
 * @returns A base64-encoded string containing: IV (16 bytes) + auth tag (16 bytes) + ciphertext
 * @throws Error if the key is not a valid 64-character hex string
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const key = validateAndParseKey(keyHex);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Concatenate: IV + authTag + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts a base64-encoded string that was encrypted with the `encrypt` function.
 *
 * @param encryptedData - The base64-encoded encrypted data (IV + auth tag + ciphertext)
 * @param keyHex - A 64-character hex string representing the 256-bit encryption key
 * @returns The decrypted plaintext string
 * @throws Error if the data is corrupted, tampered with, or the key is incorrect
 */
export function decrypt(encryptedData: string, keyHex: string): string {
  const key = validateAndParseKey(keyHex);
  const combined = Buffer.from(encryptedData, 'base64');

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error(
      'Invalid encrypted data: buffer too short. Expected at least ' +
        `${IV_LENGTH + AUTH_TAG_LENGTH} bytes, got ${combined.length}.`,
    );
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Decryption failed. The data may be corrupted or tampered with, ` +
        `or the key may be incorrect. Detail: ${message}`,
    );
  }
}

/**
 * Creates a SHA-256 hash of the given value for non-reversible lookups
 * (e.g., email index, phone index).
 *
 * @param value - The string value to hash
 * @returns A lowercase hex-encoded SHA-256 hash
 */
export function hashForLookup(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Validates that a hex key is the correct length and parses it into a Buffer.
 */
function validateAndParseKey(keyHex: string): Buffer {
  const expectedHexLength = KEY_LENGTH * 2; // 64 hex characters for 32 bytes
  if (typeof keyHex !== 'string' || keyHex.length !== expectedHexLength) {
    throw new Error(
      `Invalid encryption key: expected a ${expectedHexLength}-character hex string, ` +
        `got ${typeof keyHex === 'string' ? keyHex.length : typeof keyHex} characters.`,
    );
  }
  if (!/^[0-9a-fA-F]+$/.test(keyHex)) {
    throw new Error('Invalid encryption key: key must contain only hexadecimal characters (0-9, a-f, A-F).');
  }
  return Buffer.from(keyHex, 'hex');
}
