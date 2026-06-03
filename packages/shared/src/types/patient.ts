import { BloodGroup } from '../enums/blood-group';

export interface PatientDTO {
  id: string;
  userId: string;
  bloodGroup: BloodGroup | null;
  medicalNotes: string | null;
  address: string | null;
  emergencyContact: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePatientDTO {
  bloodGroup?: BloodGroup;
  medicalNotes?: string;
  address?: string;
  emergencyContact?: string;
}
