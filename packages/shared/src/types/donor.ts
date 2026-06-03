import { BloodGroup } from '../enums/blood-group';

export interface DonorDTO {
  id: string;
  userId: string;
  bloodGroup: BloodGroup;
  lastDonationDate: Date | null;
  isAvailable: boolean;
  latitude: number | null;
  longitude: number | null;
  totalDonations: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDonorDTO {
  bloodGroup: BloodGroup;
  latitude?: number;
  longitude?: number;
}
