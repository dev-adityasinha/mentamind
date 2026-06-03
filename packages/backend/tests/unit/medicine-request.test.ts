import { describe, it, expect } from 'vitest';
import {
  MedicineRequestStatus,
  isValidMedicineTransition,
  assertValidMedicineTransition,
} from '@mentamind/shared';
import { LocalOcrService } from '../../src/services/local-ocr-service';

describe('Medicine Request State Machine', () => {
  describe('valid transitions', () => {
    it('DRAFT → PENDING_OCR', () => {
      expect(isValidMedicineTransition(MedicineRequestStatus.DRAFT, MedicineRequestStatus.PENDING_OCR)).toBe(true);
    });

    it('PENDING_OCR → OCR_COMPLETE', () => {
      expect(isValidMedicineTransition(MedicineRequestStatus.PENDING_OCR, MedicineRequestStatus.OCR_COMPLETE)).toBe(true);
    });

    it('OCR_COMPLETE → PENDING_REVIEW', () => {
      expect(isValidMedicineTransition(MedicineRequestStatus.OCR_COMPLETE, MedicineRequestStatus.PENDING_REVIEW)).toBe(true);
    });

    it('PENDING_REVIEW → APPROVED', () => {
      expect(isValidMedicineTransition(MedicineRequestStatus.PENDING_REVIEW, MedicineRequestStatus.APPROVED)).toBe(true);
    });

    it('PENDING_REVIEW → REJECTED', () => {
      expect(isValidMedicineTransition(MedicineRequestStatus.PENDING_REVIEW, MedicineRequestStatus.REJECTED)).toBe(true);
    });

    it('APPROVED → DISPATCHED', () => {
      expect(isValidMedicineTransition(MedicineRequestStatus.APPROVED, MedicineRequestStatus.DISPATCHED)).toBe(true);
    });

    it('DISPATCHED → DELIVERED', () => {
      expect(isValidMedicineTransition(MedicineRequestStatus.DISPATCHED, MedicineRequestStatus.DELIVERED)).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('DRAFT → APPROVED (skip steps)', () => {
      expect(isValidMedicineTransition(MedicineRequestStatus.DRAFT, MedicineRequestStatus.APPROVED)).toBe(false);
    });

    it('PENDING_OCR → APPROVED (skip steps)', () => {
      expect(isValidMedicineTransition(MedicineRequestStatus.PENDING_OCR, MedicineRequestStatus.APPROVED)).toBe(false);
    });

    it('DELIVERED → anything (terminal)', () => {
      for (const status of Object.values(MedicineRequestStatus)) {
        expect(isValidMedicineTransition(MedicineRequestStatus.DELIVERED, status as MedicineRequestStatus)).toBe(false);
      }
    });

    it('CANCELLED → anything (terminal)', () => {
      for (const status of Object.values(MedicineRequestStatus)) {
        expect(isValidMedicineTransition(MedicineRequestStatus.CANCELLED, status as MedicineRequestStatus)).toBe(false);
      }
    });

    it('REJECTED → anything (terminal)', () => {
      for (const status of Object.values(MedicineRequestStatus)) {
        expect(isValidMedicineTransition(MedicineRequestStatus.REJECTED, status as MedicineRequestStatus)).toBe(false);
      }
    });
  });

  describe('cancellation', () => {
    it('all non-terminal states can be cancelled', () => {
      const nonTerminal = [
        MedicineRequestStatus.DRAFT,
        MedicineRequestStatus.PENDING_OCR,
        MedicineRequestStatus.OCR_COMPLETE,
        MedicineRequestStatus.PENDING_REVIEW,
        MedicineRequestStatus.APPROVED,
        MedicineRequestStatus.DISPATCHED,
      ];

      for (const status of nonTerminal) {
        expect(isValidMedicineTransition(status, MedicineRequestStatus.CANCELLED)).toBe(true);
      }
    });
  });

  describe('assertValidMedicineTransition', () => {
    it('does not throw for valid transitions', () => {
      expect(() =>
        assertValidMedicineTransition(MedicineRequestStatus.DRAFT, MedicineRequestStatus.PENDING_OCR),
      ).not.toThrow();
    });

    it('throws for invalid transitions', () => {
      expect(() =>
        assertValidMedicineTransition(MedicineRequestStatus.DRAFT, MedicineRequestStatus.DELIVERED),
      ).toThrow(/Invalid medicine request status transition/);
    });
  });

  describe('complete happy path', () => {
    it('follows DRAFT → PENDING_OCR → OCR_COMPLETE → PENDING_REVIEW → APPROVED → DISPATCHED → DELIVERED', () => {
      const path = [
        MedicineRequestStatus.DRAFT,
        MedicineRequestStatus.PENDING_OCR,
        MedicineRequestStatus.OCR_COMPLETE,
        MedicineRequestStatus.PENDING_REVIEW,
        MedicineRequestStatus.APPROVED,
        MedicineRequestStatus.DISPATCHED,
        MedicineRequestStatus.DELIVERED,
      ];

      for (let i = 0; i < path.length - 1; i++) {
        expect(isValidMedicineTransition(path[i], path[i + 1])).toBe(true);
      }
    });
  });
});

describe('LocalOcrService', () => {
  const ocrService = new LocalOcrService();

  it('returns medicines array with required fields', async () => {
    const result = await ocrService.extractPrescription(Buffer.from('fake'), 'image/jpeg');

    expect(result.medicines).toBeDefined();
    expect(Array.isArray(result.medicines)).toBe(true);
    expect(result.medicines.length).toBeGreaterThan(0);

    for (const med of result.medicines) {
      expect(typeof med.name).toBe('string');
      expect(typeof med.dosage).toBe('string');
      expect(typeof med.quantity).toBe('number');
      expect(med.quantity).toBeGreaterThan(0);
      expect(typeof med.confidence).toBe('number');
      expect(med.confidence).toBeGreaterThanOrEqual(0);
      expect(med.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('returns rawText string', async () => {
    const result = await ocrService.extractPrescription(Buffer.from('fake'), 'image/jpeg');
    expect(typeof result.rawText).toBe('string');
    expect(result.rawText.length).toBeGreaterThan(0);
  });

  it('returns overallConfidence between 0 and 1', async () => {
    const result = await ocrService.extractPrescription(Buffer.from('fake'), 'image/jpeg');
    expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
    expect(result.overallConfidence).toBeLessThanOrEqual(1);
  });

  it('stub returns known medicines (Paracetamol, Amoxicillin, Cetirizine)', async () => {
    const result = await ocrService.extractPrescription(Buffer.from('fake'), 'image/jpeg');
    const names = result.medicines.map((m) => m.name);
    expect(names).toContain('Paracetamol');
    expect(names).toContain('Amoxicillin');
    expect(names).toContain('Cetirizine');
  });
});
