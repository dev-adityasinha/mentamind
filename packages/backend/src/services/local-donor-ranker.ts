import {
  DonorRanker,
  DonorProfile,
  BloodRequestContext,
  RankedDonor,
  BloodGroup,
  UrgencyLevel,
  canDonate,
} from '@mentamind/shared';

// Scoring weights
const SCORE_EXACT_BLOOD_MATCH = 40;
const SCORE_COMPATIBLE_BLOOD_MATCH = 20;
const SCORE_ELIGIBLE_DAYS_SINCE_DONATION = 20;
const SCORE_DISTANCE_MAX = 15;
const SCORE_EXPERIENCE_MAX = 5;

// Minimum days since last donation for eligibility
const MIN_DAYS_BETWEEN_DONATIONS = 56;

// Maximum distance considered for scoring (in km)
const MAX_SCORING_DISTANCE_KM = 50;

/**
 * Local implementation of DonorRanker.
 * Scores and ranks donors based on blood compatibility, recency of last donation,
 * proximity to hospital, and donation experience.
 */
export class LocalDonorRanker implements DonorRanker {
  async rankDonors(
    eligibleDonors: DonorProfile[],
    request: BloodRequestContext,
  ): Promise<RankedDonor[]> {
    const rankedDonors: RankedDonor[] = [];

    for (const donor of eligibleDonors) {
      const { score, reasons } = this.scoreDonor(donor, request);
      rankedDonors.push({ donor, score, reasons });
    }

    // Sort by score descending (higher = better match)
    rankedDonors.sort((a, b) => b.score - a.score);

    return rankedDonors;
  }

  private scoreDonor(
    donor: DonorProfile,
    request: BloodRequestContext,
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // ─── Blood Type Compatibility ─────────────────────────────────────
    if (!canDonate(donor.bloodGroup, request.bloodGroup)) {
      reasons.push('Incompatible blood type');
      return { score: 0, reasons };
    }

    if (donor.bloodGroup === request.bloodGroup) {
      score += SCORE_EXACT_BLOOD_MATCH;
      reasons.push('Exact blood type match');
    } else {
      score += SCORE_COMPATIBLE_BLOOD_MATCH;
      reasons.push(
        `Compatible blood type (${donor.bloodGroup} → ${request.bloodGroup})`,
      );
    }

    // ─── Days Since Last Donation ─────────────────────────────────────
    const daysSinceLastDonation = this.getDaysSinceLastDonation(donor);

    if (daysSinceLastDonation === null) {
      // Never donated before — fully eligible
      score += SCORE_ELIGIBLE_DAYS_SINCE_DONATION;
      reasons.push('No previous donations on record (fully eligible)');
    } else if (daysSinceLastDonation >= MIN_DAYS_BETWEEN_DONATIONS) {
      // Eligible: scale score based on how long ago
      const daysBeyondMinimum = daysSinceLastDonation - MIN_DAYS_BETWEEN_DONATIONS;
      const eligibilityBonus = Math.min(
        SCORE_ELIGIBLE_DAYS_SINCE_DONATION,
        SCORE_ELIGIBLE_DAYS_SINCE_DONATION * (daysBeyondMinimum / 90),
      );
      score += eligibilityBonus;
      reasons.push(
        `Last donation ${daysSinceLastDonation} days ago (eligible, >${MIN_DAYS_BETWEEN_DONATIONS} days)`,
      );
    } else {
      // Not eligible yet — significant penalty
      reasons.push(
        `Last donation only ${daysSinceLastDonation} days ago (requires ${MIN_DAYS_BETWEEN_DONATIONS} days between donations)`,
      );
    }

    // ─── Distance from Hospital ───────────────────────────────────────
    if (
      donor.latitude !== null &&
      donor.longitude !== null &&
      request.hospitalLatitude !== undefined &&
      request.hospitalLongitude !== undefined
    ) {
      const distanceKm = this.haversineDistance(
        donor.latitude,
        donor.longitude,
        request.hospitalLatitude,
        request.hospitalLongitude,
      );

      if (distanceKm <= MAX_SCORING_DISTANCE_KM) {
        const distanceScore =
          SCORE_DISTANCE_MAX *
          (1 - distanceKm / MAX_SCORING_DISTANCE_KM);
        score += distanceScore;
        reasons.push(`Within ${distanceKm.toFixed(1)} km of hospital`);
      } else {
        reasons.push(
          `${distanceKm.toFixed(1)} km from hospital (beyond ${MAX_SCORING_DISTANCE_KM} km scoring range)`,
        );
      }
    } else {
      reasons.push('Distance not available (no coordinates)');
    }

    // ─── Donation Experience ──────────────────────────────────────────
    if (donor.totalDonations > 0) {
      const experienceScore = Math.min(
        SCORE_EXPERIENCE_MAX,
        SCORE_EXPERIENCE_MAX * (donor.totalDonations / 10),
      );
      score += experienceScore;
      reasons.push(`${donor.totalDonations} previous donation(s)`);
    }

    // ─── Urgency Multiplier ───────────────────────────────────────────
    const urgencyMultiplier = this.getUrgencyMultiplier(request.urgency);
    if (urgencyMultiplier !== 1.0) {
      score *= urgencyMultiplier;
      reasons.push(
        `Urgency: ${request.urgency} (${urgencyMultiplier}x multiplier)`,
      );
    }

    return { score: Math.round(score * 100) / 100, reasons };
  }

  private getDaysSinceLastDonation(donor: DonorProfile): number | null {
    if (!donor.lastDonationDate) {
      return null;
    }
    const now = new Date();
    const lastDonation = new Date(donor.lastDonationDate);
    const diffMs = now.getTime() - lastDonation.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  private getUrgencyMultiplier(urgency: UrgencyLevel): number {
    switch (urgency) {
      case UrgencyLevel.CRITICAL:
        return 1.5;
      case UrgencyLevel.URGENT:
        return 1.25;
      case UrgencyLevel.NORMAL:
        return 1.0;
      default:
        return 1.0;
    }
  }

  /**
   * Calculates the Haversine distance between two lat/lng points in kilometers.
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const EARTH_RADIUS_KM = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
  }
}
