export interface OcrMedicineEntry {
  name: string;
  dosage: string;
  quantity: number;
  frequency?: string;
  confidence: number; // 0-1
}

export interface OcrResult {
  medicines: OcrMedicineEntry[];
  rawText: string;
  overallConfidence: number; // 0-1
}

export interface OcrService {
  extractPrescription(fileBuffer: Buffer, mimeType: string): Promise<OcrResult>;
}
