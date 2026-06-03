import { MedicineRequestStatus } from '../enums/medicine-request-status';

export interface MedicineRequestDTO {
  id: string;
  patientId: string;
  prescriptionFileKey: string | null;
  ocrSuggestions: unknown | null;
  adminReviewedData: unknown | null;
  status: MedicineRequestStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMedicineRequestDTO {
  prescriptionFileKey?: string;
  notes?: string;
}
