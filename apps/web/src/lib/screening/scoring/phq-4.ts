/**
 * PHQ-4 Scoring Module
 * Ultra-Brief Anxiety & Depression Screener
 *
 * Method: Sum scoring with two subscales (anxiety: Q1+Q2, depression: Q3+Q4)
 * Range: 0–12 total, 0–6 per subscale
 * Bands: None (0–2), Mild (3–5), Moderate (6–8), Severe (9–12)
 * Subscale threshold: ≥3 on either subscale flags the domain
 *
 * Reference: Kroenke, K., Spitzer, R.L., Williams, J.B.W., & Löwe, B. (2009)
 */

import type { ScoreResult } from '../types/schema';

export interface PHQ4Result extends ScoreResult {
    subscaleScores: {
        anxiety: { score: number; band: string };
        depression: { score: number; band: string };
    };
}

/**
 * Computes PHQ-4 score from raw answers.
 * @param answers Array of 4 integers, each 0–3, in order [Q1, Q2, Q3, Q4]
 * @returns Full score result with total, band, subscales, and escalation info
 * @throws Error if answers array has wrong length or values out of range
 */
export function computeScore(answers: number[]): PHQ4Result {
    if (answers.length !== 4) {
        throw new Error(`PHQ-4 requires exactly 4 answers, got ${answers.length}`);
    }

    for (let i = 0; i < answers.length; i++) {
        if (answers[i] < 0 || answers[i] > 3 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 0–3, got ${answers[i]}`);
        }
    }

    // Keep raw answers immutable
    const rawAnswers = [...answers];

    // Total score
    const totalScore = answers[0] + answers[1] + answers[2] + answers[3];

    // Subscale scores
    const anxietyScore = answers[0] + answers[1];
    const depressionScore = answers[2] + answers[3];

    // Total band
    const band = getBand(totalScore);

    // Subscale bands
    const anxietyBand = anxietyScore >= 3 ? 'Above threshold' : 'Below threshold';
    const depressionBand = depressionScore >= 3 ? 'Above threshold' : 'Below threshold';

    // Escalation: PHQ-4 has no high-risk items, but flag if subscales breach threshold
    const escalationReasons: string[] = [];
    if (anxietyScore >= 3) {
        escalationReasons.push('Anxiety subscale ≥ 3 — recommend GAD-7 assessment');
    }
    if (depressionScore >= 3) {
        escalationReasons.push('Depression subscale ≥ 3 — recommend PHQ-9 assessment');
    }

    return {
        totalScore,
        band,
        bandDescription: getBandDescription(band),
        subscaleScores: {
            anxiety: { score: anxietyScore, band: anxietyBand },
            depression: { score: depressionScore, band: depressionBand },
        },
        requiresEscalation: false, // PHQ-4 has no suicide/self-harm items
        escalationReasons,
        rawAnswers,
    };
}

function getBand(score: number): string {
    if (score <= 2) return 'None';
    if (score <= 5) return 'Mild';
    if (score <= 8) return 'Moderate';
    return 'Severe';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'None': return 'No significant distress detected';
        case 'Mild': return 'Mild distress level';
        case 'Moderate': return 'Moderate distress level';
        case 'Severe': return 'Severe distress level';
        default: return '';
    }
}
