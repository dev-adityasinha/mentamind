/**
 * Burnout Scoring Module (MBI-Aligned)
 * 22 items, 3 subscales
 *
 * Subscales: EE (Q1-9), DP (Q10-14), PA (Q15-22, reverse-interpreted)
 * PA reverse-interpretation: LOW PA score = HIGH burnout
 * Scale: 0–6
 */

import type { ScoreResult } from '../types/schema';

const EE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const DP_INDICES = [9, 10, 11, 12, 13];
const PA_INDICES = [14, 15, 16, 17, 18, 19, 20, 21];

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 22) {
        throw new Error(`Burnout requires exactly 22 answers, got ${answers.length}`);
    }
    for (let i = 0; i < answers.length; i++) {
        if (answers[i] < 0 || answers[i] > 6 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 0–6, got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];
    const eeScore = EE_INDICES.reduce((s, i) => s + answers[i], 0);
    const dpScore = DP_INDICES.reduce((s, i) => s + answers[i], 0);
    const paScore = PA_INDICES.reduce((s, i) => s + answers[i], 0);

    const eeBand = eeScore >= 27 ? 'High' : eeScore >= 17 ? 'Moderate' : 'Low';
    const dpBand = dpScore >= 13 ? 'High' : dpScore >= 7 ? 'Moderate' : 'Low';
    // PA is reverse-interpreted: LOW score = HIGH burnout
    const paBand = paScore <= 31 ? 'High burnout' : paScore <= 38 ? 'Moderate' : 'Low burnout';

    const overallBand = (eeBand === 'High' || dpBand === 'High' || paBand === 'High burnout')
        ? 'High burnout'
        : (eeBand === 'Moderate' || dpBand === 'Moderate' || paBand === 'Moderate')
            ? 'Moderate burnout'
            : 'Low burnout';

    return {
        totalScore: eeScore + dpScore, // PA excluded from total per MBI convention
        band: overallBand,
        bandDescription: getBandDescription(overallBand),
        subscaleScores: {
            emotional_exhaustion: { score: eeScore, band: eeBand },
            depersonalization: { score: dpScore, band: dpBand },
            personal_accomplishment: { score: paScore, band: paBand },
        },
        requiresEscalation: false,
        escalationReasons: overallBand === 'High burnout'
            ? ['High burnout detected — professional support recommended.']
            : [],
        rawAnswers,
    };
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'Low burnout': return 'No significant burnout';
        case 'Moderate burnout': return 'Moderate burnout — rest and lifestyle changes recommended';
        case 'High burnout': return 'High burnout — urgent professional support';
        default: return '';
    }
}
