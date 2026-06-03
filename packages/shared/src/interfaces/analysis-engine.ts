import { BloodGroup } from '../enums/blood-group';

export interface DemandAnalysisParams {
  bloodGroup?: BloodGroup;
  startDate: Date;
  endDate: Date;
  region?: string;
}

export interface DemandInsights {
  totalRequests: number;
  fulfilledRequests: number;
  fulfillmentRate: number;
  averageTimeToFulfill: number; // in hours
  breakdownByBloodGroup: Record<string, number>;
  breakdownByUrgency: Record<string, number>;
}

export interface ShortageParams {
  bloodGroup?: BloodGroup;
  daysAhead: number;
}

export interface ShortageInsights {
  predictedShortages: Array<{
    bloodGroup: BloodGroup;
    currentSupply: number;
    predictedDemand: number;
    deficit: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
}

export interface AnalysisEngine {
  analyzeDemand(params: DemandAnalysisParams): Promise<DemandInsights>;
  predictShortages(params: ShortageParams): Promise<ShortageInsights>;
}
