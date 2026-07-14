/**
 * Personality (BFI-10) Scoring Module
 * Big Five Personality Inventory — 10 items
 *
 * 5 traits, 2 items each. Q6-Q10 reverse-scored (6 - score)
 * Subscales: Openness (Q1,Q6), Extraversion (Q2,Q7), Conscientiousness (Q3,Q8),
 *            Agreeableness (Q4,Q9), Neuroticism (Q5,Q10)
 * Scale: 1–5 per item → trait range 2–10
 */

import type { ScoreResult } from '../types/schema';

const REVERSE_INDICES = [5, 6, 7, 8, 9]; // Q6-Q10

const TRAITS: Record<string, number[]> = {
    openness: [0, 5],
    extraversion: [1, 6],
    conscientiousness: [2, 7],
    agreeableness: [3, 8],
    neuroticism: [4, 9],
};

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 10) {
        throw new Error(`BFI-10 requires exactly 10 answers, got ${answers.length}`);
    }
    for (let i = 0; i < answers.length; i++) {
        if (answers[i] < 1 || answers[i] > 5 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 1–5, got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];
    const scored = answers.map((v, i) => REVERSE_INDICES.includes(i) ? 6 - v : v);

    const subscaleScores: Record<string, { score: number }> = {};
    for (const [trait, indices] of Object.entries(TRAITS)) {
        subscaleScores[trait] = { score: indices.reduce((s, i) => s + scored[i], 0) };
    }

    return {
        totalScore: 0, // No total for personality
        band: 'N/A',
        bandDescription: 'Personality profile — no severity band',
        subscaleScores,
        requiresEscalation: false,
        escalationReasons: [],
        rawAnswers,
    };
}
