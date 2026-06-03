import { describe, it, expect } from 'vitest';
import { LocalDonorRanker } from '../../src/services/local-donor-ranker';
import { BloodGroup, UrgencyLevel } from '@mentamind/shared';
import type { DonorProfile, BloodRequestContext } from '@mentamind/shared';

function makeDonor(overrides: Partial<DonorProfile> = {}): DonorProfile {
  return {
    id: 'donor-1',
    userId: 'user-1',
    bloodGroup: BloodGroup.O_POS,
    lastDonationDate: null,
    latitude: null,
    longitude: null,
    totalDonations: 0,
    isAvailable: true,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<BloodRequestContext> = {}): BloodRequestContext {
  return {
    bloodGroup: BloodGroup.O_POS,
    urgency: UrgencyLevel.NORMAL,
    unitsNeeded: 1,
    ...overrides,
  };
}

describe('LocalDonorRanker', () => {
  const ranker = new LocalDonorRanker();

  describe('blood type scoring', () => {
    it('exact match scores higher than compatible match', async () => {
      const exactDonor = makeDonor({ id: 'exact', bloodGroup: BloodGroup.A_POS });
      const compatDonor = makeDonor({ id: 'compat', bloodGroup: BloodGroup.O_POS }); // O+ can donate to A+

      const request = makeRequest({ bloodGroup: BloodGroup.A_POS });
      const results = await ranker.rankDonors([exactDonor, compatDonor], request);

      const exact = results.find((r) => r.donor.id === 'exact')!;
      const compat = results.find((r) => r.donor.id === 'compat')!;

      expect(exact.score).toBeGreaterThan(compat.score);
      expect(exact.reasons).toContain('Exact blood type match');
    });

    it('incompatible blood type scores 0', async () => {
      const donor = makeDonor({ bloodGroup: BloodGroup.A_POS }); // A+ cannot donate to O+
      const request = makeRequest({ bloodGroup: BloodGroup.O_POS });

      const results = await ranker.rankDonors([donor], request);
      expect(results[0].score).toBe(0);
      expect(results[0].reasons).toContain('Incompatible blood type');
    });
  });

  describe('donation recency scoring', () => {
    it('never-donated donor is fully eligible', async () => {
      const donor = makeDonor({ lastDonationDate: null });
      const request = makeRequest();

      const results = await ranker.rankDonors([donor], request);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].reasons.some((r) => r.includes('fully eligible'))).toBe(true);
    });

    it('donor who donated >56 days ago scores higher than <56 days', async () => {
      const longAgo = new Date();
      longAgo.setDate(longAgo.getDate() - 90); // 90 days ago

      const recent = new Date();
      recent.setDate(recent.getDate() - 30); // 30 days ago

      const donorLong = makeDonor({ id: 'long', lastDonationDate: longAgo });
      const donorRecent = makeDonor({ id: 'recent', lastDonationDate: recent });

      const request = makeRequest();
      const results = await ranker.rankDonors([donorLong, donorRecent], request);

      const long = results.find((r) => r.donor.id === 'long')!;
      const rec = results.find((r) => r.donor.id === 'recent')!;

      expect(long.score).toBeGreaterThan(rec.score);
    });
  });

  describe('distance scoring', () => {
    it('closer donor ranks higher', async () => {
      // Hospital at 0,0
      const closeDonor = makeDonor({ id: 'close', latitude: 0.01, longitude: 0.01 }); // ~1.5km
      const farDonor = makeDonor({ id: 'far', latitude: 0.3, longitude: 0.3 }); // ~47km

      const request = makeRequest({
        hospitalLatitude: 0,
        hospitalLongitude: 0,
      });

      const results = await ranker.rankDonors([closeDonor, farDonor], request);
      const close = results.find((r) => r.donor.id === 'close')!;
      const far = results.find((r) => r.donor.id === 'far')!;

      expect(close.score).toBeGreaterThan(far.score);
    });

    it('donor without coordinates gets no distance score but no penalty', async () => {
      const donor = makeDonor({ latitude: null, longitude: null });
      const request = makeRequest({ hospitalLatitude: 0, hospitalLongitude: 0 });

      const results = await ranker.rankDonors([donor], request);
      expect(results[0].reasons.some((r) => r.includes('Distance not available'))).toBe(true);
    });
  });

  describe('urgency multiplier', () => {
    it('CRITICAL urgency applies 1.5x multiplier', async () => {
      const donor = makeDonor();
      const normalReq = makeRequest({ urgency: UrgencyLevel.NORMAL });
      const criticalReq = makeRequest({ urgency: UrgencyLevel.CRITICAL });

      const normalResults = await ranker.rankDonors([donor], normalReq);
      const criticalResults = await ranker.rankDonors([donor], criticalReq);

      expect(criticalResults[0].score).toBeGreaterThan(normalResults[0].score);
      // Should be ~1.5x
      const ratio = criticalResults[0].score / normalResults[0].score;
      expect(ratio).toBeCloseTo(1.5, 1);
    });

    it('URGENT urgency applies 1.25x multiplier', async () => {
      const donor = makeDonor();
      const normalReq = makeRequest({ urgency: UrgencyLevel.NORMAL });
      const urgentReq = makeRequest({ urgency: UrgencyLevel.URGENT });

      const normalResults = await ranker.rankDonors([donor], normalReq);
      const urgentResults = await ranker.rankDonors([donor], urgentReq);

      const ratio = urgentResults[0].score / normalResults[0].score;
      expect(ratio).toBeCloseTo(1.25, 1);
    });
  });

  describe('sorting', () => {
    it('returns donors sorted by score descending', async () => {
      const donors = [
        makeDonor({ id: 'a', bloodGroup: BloodGroup.A_POS }), // compatible
        makeDonor({ id: 'b', bloodGroup: BloodGroup.O_NEG }), // universal donor, compatible
        makeDonor({ id: 'c', bloodGroup: BloodGroup.O_POS }), // exact match
      ];

      const request = makeRequest({ bloodGroup: BloodGroup.O_POS });
      const results = await ranker.rankDonors(donors, request);

      // Exact match (O+) should be first, incompatible (A+) should be last
      expect(results[0].donor.id).toBe('c'); // exact
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('handles empty donor list', async () => {
      const results = await ranker.rankDonors([], makeRequest());
      expect(results).toEqual([]);
    });
  });

  describe('experience scoring', () => {
    it('experienced donor gets bonus', async () => {
      const newbie = makeDonor({ id: 'new', totalDonations: 0 });
      const veteran = makeDonor({ id: 'vet', totalDonations: 10 });

      const request = makeRequest();
      const results = await ranker.rankDonors([newbie, veteran], request);

      const n = results.find((r) => r.donor.id === 'new')!;
      const v = results.find((r) => r.donor.id === 'vet')!;

      expect(v.score).toBeGreaterThan(n.score);
    });
  });
});
