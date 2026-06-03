import { OcrService, OcrResult } from '@mentamind/shared';

/**
 * Local stub implementation of OcrService.
 * Returns hardcoded prescription data for development and testing.
 */
export class LocalOcrService implements OcrService {
  async extractPrescription(
    _fileBuffer: Buffer,
    _mimeType: string,
  ): Promise<OcrResult> {
    console.log(
      '[LOCAL-OCR] extractPrescription called — returning stub data. ' +
        'Replace with a real OCR service (e.g., Google Vision, Tesseract) in production.',
    );

    return {
      medicines: [
        {
          name: 'Paracetamol',
          dosage: '500mg',
          quantity: 10,
          frequency: 'Twice daily after meals',
          confidence: 0.85,
        },
        {
          name: 'Amoxicillin',
          dosage: '250mg',
          quantity: 21,
          frequency: 'Three times daily',
          confidence: 0.85,
        },
        {
          name: 'Cetirizine',
          dosage: '10mg',
          quantity: 7,
          frequency: 'Once daily at bedtime',
          confidence: 0.85,
        },
      ],
      rawText:
        'Rx\n1. Tab Paracetamol 500mg — 1 BD x 5 days\n' +
        '2. Cap Amoxicillin 250mg — 1 TDS x 7 days\n' +
        '3. Tab Cetirizine 10mg — 1 OD x 7 days',
      overallConfidence: 0.85,
    };
  }
}
