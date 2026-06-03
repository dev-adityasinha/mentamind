import { BloodGroup } from '../enums/blood-group';
import { RequestStatus } from '../enums/request-status';
import { UrgencyLevel } from '../enums/urgency-level';

export interface BloodRequestDTO {
  id: string;
  patientId: string;
  hospitalId: string | null;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  urgency: UrgencyLevel;
  status: RequestStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBloodRequestDTO {
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  urgency?: UrgencyLevel;
  hospitalId?: string;
  notes?: string;
}
