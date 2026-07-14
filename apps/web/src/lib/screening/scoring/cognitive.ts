/**
 * Cognitive Screening Module (MoCA Self-Adapted)
 * 11 items — Q6 is non-scored (word learning), Q7 has 0-5 range (recall)
 *
 * Method: Sum (skip Q6, Q7 max = 5, rest binary 0/1)
 * Range: 0–12
 * Bands: No difficulty (10–12), Mild (7–9), Possible concern (0–6)
 */

import type { ScoreResult } from '../types/schema';

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 11) {
        throw new Error(`Cognitive Screening requires exactly 11 answers, got ${answers.length}`);
    }

    // Validate: Q1-Q5 (0-1), Q6 (0 always — non-scored), Q7 (0-5), Q8-Q11 (0-1)
    for (let i = 0; i < answers.length; i++) {
        if (i === 5) { // Q6 — non-scored word learning
            if (answers[i] !== 0) {
                throw new Error(`Answer 6 (word learning) must be 0 (non-scored), got ${answers[i]}`);
            }
            continue;
        }
        if (i === 6) { // Q7 — delayed recall, 0-5
            if (answers[i] < 0 || answers[i] > 5 || !Number.isInteger(answers[i])) {
                throw new Error(`Answer 7 (recall) must be an integer 0–5, got ${answers[i]}`);
            }
            continue;
        }
        if (answers[i] !== 0 && answers[i] !== 1) {
            throw new Error(`Answer ${i + 1} must be 0 or 1, got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];

    // Score: skip Q6 (index 5), sum all others
    const totalScore = answers.reduce((s, v, i) => i === 5 ? s : s + v, 0);
    const band = getBand(totalScore);

    return {
        totalScore,
        band,
        bandDescription: getBandDescription(band),
        requiresEscalation: false,
        escalationReasons: totalScore <= 6
            ? ['Cognitive screening score ≤ 6 — professional assessment recommended.']
            : [],
        rawAnswers,
    };
}

function getBand(score: number): string {
    if (score >= 10) return 'No significant difficulty';
    if (score >= 7) return 'Mild cognitive difficulty';
    return 'Possible cognitive concern';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'No significant difficulty': return 'No cognitive concerns';
        case 'Mild cognitive difficulty': return 'Mild difficulty — may relate to stress or sleep';
        case 'Possible cognitive concern': return 'Possible concern — professional assessment recommended';
        default: return '';
    }
}
