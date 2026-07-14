/**
 * ERQ Scoring Module
 * Emotion Regulation Questionnaire — 10 items
 *
 * Method: Average by subscale
 * Subscales:
 *   - Cognitive Reappraisal (Q1,Q3,Q5,Q7,Q8,Q10 → 0-indexed: 0,2,4,6,7,9)
 *   - Expressive Suppression (Q2,Q4,Q6,Q9 → 0-indexed: 1,3,5,8)
 * Scale: 1–7
 */

import type { ScoreResult } from '../types/schema';

const REAPPRAISAL_INDICES = [0, 2, 4, 6, 7, 9];
const SUPPRESSION_INDICES = [1, 3, 5, 8];

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 10) {
        throw new Error(`ERQ requires exactly 10 answers, got ${answers.length}`);
    }
    for (let i = 0; i < answers.length; i++) {
        if (answers[i] < 1 || answers[i] > 7 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 1–7, got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];

    const reappraisalSum = REAPPRAISAL_INDICES.reduce((s, i) => s + answers[i], 0);
    const suppressionSum = SUPPRESSION_INDICES.reduce((s, i) => s + answers[i], 0);

    const reappraisalAvg = Math.round((reappraisalSum / 6) * 100) / 100;
    const suppressionAvg = Math.round((suppressionSum / 4) * 100) / 100;

    return {
        totalScore: 0, // ERQ has no total — subscale-only
        band: 'N/A',
        bandDescription: 'ERQ uses subscale averages, no total band',
        subscaleScores: {
            cognitive_reappraisal: { score: reappraisalAvg, band: reappraisalAvg >= 5 ? 'High' : reappraisalAvg >= 3 ? 'Moderate' : 'Low' },
            expressive_suppression: { score: suppressionAvg, band: suppressionAvg >= 5 ? 'High' : suppressionAvg >= 3 ? 'Moderate' : 'Low' },
        },
        requiresEscalation: false,
        escalationReasons: [],
        rawAnswers,
    };
}
