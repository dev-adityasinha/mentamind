import {
  AnalysisEngine,
  DemandAnalysisParams,
  DemandInsights,
  ShortageParams,
  ShortageInsights,
  BloodGroup,
} from '@mentamind/shared';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Local stub implementation of AnalysisEngine.
 * analyzeDemand queries real data from the BloodRequest table.
 * predictShortages returns mock data with a warning.
 */
export class LocalAnalysisEngine implements AnalysisEngine {
  async analyzeDemand(params: DemandAnalysisParams): Promise<DemandInsights> {
    const where: Record<string, unknown> = {
      createdAt: {
        gte: params.startDate,
        lte: params.endDate,
      },
    };

    if (params.bloodGroup) {
      where.bloodGroup = params.bloodGroup;
    }

    // Get all matching requests
    const requests = await prisma.bloodRequest.findMany({
      where,
      select: {
        status: true,
        bloodGroup: true,
        urgency: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const totalRequests = requests.length;
    const fulfilledRequests = requests.filter(
      (r) => r.status === 'FULFILLED',
    ).length;
    const fulfillmentRate =
      totalRequests > 0 ? fulfilledRequests / totalRequests : 0;

    // Calculate average time to fulfill (for fulfilled requests)
    const fulfilledItems = requests.filter((r) => r.status === 'FULFILLED');
    let averageTimeToFulfill = 0;
    if (fulfilledItems.length > 0) {
      const totalHours = fulfilledItems.reduce((sum, r) => {
        const diffMs = r.updatedAt.getTime() - r.createdAt.getTime();
        return sum + diffMs / (1000 * 60 * 60);
      }, 0);
      averageTimeToFulfill =
        Math.round((totalHours / fulfilledItems.length) * 100) / 100;
    }

    // Breakdown by blood group
    const breakdownByBloodGroup: Record<string, number> = {};
    for (const group of Object.values(BloodGroup)) {
      breakdownByBloodGroup[group] = requests.filter(
        (r) => r.bloodGroup === group,
      ).length;
    }

    // Breakdown by urgency
    const breakdownByUrgency: Record<string, number> = {};
    for (const request of requests) {
      const urgency = request.urgency;
      breakdownByUrgency[urgency] = (breakdownByUrgency[urgency] ?? 0) + 1;
    }

    return {
      totalRequests,
      fulfilledRequests,
      fulfillmentRate: Math.round(fulfillmentRate * 10000) / 10000,
      averageTimeToFulfill,
      breakdownByBloodGroup,
      breakdownByUrgency,
    };
  }

  async predictShortages(params: ShortageParams): Promise<ShortageInsights> {
    console.warn(
      '[LOCAL-ANALYSIS] predictShortages is a STUB. ' +
        'Replace with a real ML/statistical model in production.',
    );

    // Build predicted shortages for each blood group or the specified one
    const bloodGroups = params.bloodGroup
      ? [params.bloodGroup]
      : Object.values(BloodGroup);

    const predictedShortages = bloodGroups.map((group) => {
      // Generate mock predictions
      const currentSupply = Math.floor(Math.random() * 50) + 5;
      const predictedDemand = Math.floor(
        Math.random() * 30 * (params.daysAhead / 7),
      ) + 10;
      const deficit = Math.max(0, predictedDemand - currentSupply);

      let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      if (deficit === 0) {
        severity = 'LOW';
      } else if (deficit <= 5) {
        severity = 'MEDIUM';
      } else if (deficit <= 15) {
        severity = 'HIGH';
      } else {
        severity = 'CRITICAL';
      }

      return {
        bloodGroup: group,
        currentSupply,
        predictedDemand,
        deficit,
        severity,
      };
    });

    return { predictedShortages };
  }
}
