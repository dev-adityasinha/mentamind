import { BloodGroup } from '../enums/blood-group';
import { UrgencyLevel } from '../enums/urgency-level';

export interface DonorProfile {
  id: string;
  userId: string;
  bloodGroup: BloodGroup;
  lastDonationDate: Date | null;
  latitude: number | null;
  longitude: number | null;
  totalDonations: number;
  isAvailable: boolean;
}

export interface BloodRequestContext {
  bloodGroup: BloodGroup;
  urgency: UrgencyLevel;
  hospitalLatitude?: number;
  hospitalLongitude?: number;
  unitsNeeded: number;
}

export interface RankedDonor {
  donor: DonorProfile;
  score: number; // higher = better match
  reasons: string[]; // e.g. ["exact blood match", "donated >56 days ago", "within 10km"]
}

export interface DonorRanker {
  rankDonors(eligibleDonors: DonorProfile[], request: BloodRequestContext): Promise<RankedDonor[]>;
}
