import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BloodGroup } from '@mentamind/shared';

const { mockFindMany } = vi.hoisted(() => {
  return { mockFindMany: vi.fn() };
});

vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn().mockImplementation(() => {
      return {
        bloodRequest: {
          findMany: mockFindMany,
        },
      };
    }),
  };
});

import { LocalAnalysisEngine } from '../../src/services/local-analysis-engine';

describe('LocalAnalysisEngine', () => {
  const engine = new LocalAnalysisEngine();

  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([
      { status: 'FULFILLED', bloodGroup: BloodGroup.A_POS, urgency: 'HIGH', createdAt: new Date(Date.now() - 86400000), updatedAt: new Date() },
      { status: 'MATCHING', bloodGroup: BloodGroup.O_NEG, urgency: 'CRITICAL', createdAt: new Date(), updatedAt: new Date() },
    ]);
  });

  describe('analyzeDemand', () => {
    it('returns all required fields', async () => {
      const result = await engine.analyzeDemand({
        startDate: new Date('2025-01-01'),
        endDate: new Date(),
      });

      expect(typeof result.totalRequests).toBe('number');
      expect(typeof result.fulfilledRequests).toBe('number');
      expect(typeof result.fulfillmentRate).toBe('number');
      expect(typeof result.averageTimeToFulfill).toBe('number');
      expect(typeof result.breakdownByBloodGroup).toBe('object');
      expect(typeof result.breakdownByUrgency).toBe('object');
    });

    it('fulfillment rate is between 0 and 1', async () => {
      const result = await engine.analyzeDemand({
        startDate: new Date('2025-01-01'),
        endDate: new Date(),
      });

      expect(result.fulfillmentRate).toBeGreaterThanOrEqual(0);
      expect(result.fulfillmentRate).toBeLessThanOrEqual(1);
    });

    it('breakdown includes all blood groups', async () => {
      const result = await engine.analyzeDemand({
        startDate: new Date('2025-01-01'),
        endDate: new Date(),
      });

      for (const group of Object.values(BloodGroup)) {
        expect(result.breakdownByBloodGroup).toHaveProperty(group);
      }
    });

    it('fulfilledRequests <= totalRequests', async () => {
      const result = await engine.analyzeDemand({
        startDate: new Date('2025-01-01'),
        endDate: new Date(),
      });

      expect(result.fulfilledRequests).toBeLessThanOrEqual(result.totalRequests);
    });
  });

  describe('predictShortages', () => {
    it('returns predictedShortages array', async () => {
      const result = await engine.predictShortages({ daysAhead: 14 });

      expect(Array.isArray(result.predictedShortages)).toBe(true);
      expect(result.predictedShortages.length).toBe(Object.values(BloodGroup).length);
    });

    it('each shortage has required fields', async () => {
      const result = await engine.predictShortages({ daysAhead: 7 });

      for (const shortage of result.predictedShortages) {
        expect(shortage.bloodGroup).toBeDefined();
        expect(typeof shortage.currentSupply).toBe('number');
        expect(typeof shortage.predictedDemand).toBe('number');
        expect(typeof shortage.deficit).toBe('number');
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(shortage.severity);
      }
    });

    it('deficit is non-negative', async () => {
      const result = await engine.predictShortages({ daysAhead: 14 });

      for (const shortage of result.predictedShortages) {
        expect(shortage.deficit).toBeGreaterThanOrEqual(0);
      }
    });

    it('filters by specific blood group', async () => {
      const result = await engine.predictShortages({ daysAhead: 14, bloodGroup: BloodGroup.O_POS });

      expect(result.predictedShortages.length).toBe(1);
      expect(result.predictedShortages[0].bloodGroup).toBe(BloodGroup.O_POS);
    });
  });
});
