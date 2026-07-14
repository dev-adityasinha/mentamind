/**
 * RSES Scoring Module
 * Rosenberg Self-Esteem Scale — 10 items
 *
 * Method: Sum with reverse scoring for Q3, Q5, Q8, Q9, Q10 (0-indexed: 2, 4, 7, 8, 9)
 * Reverse formula: 3 - score
 * Range: 0–30
 * Bands: Low (0–14), Normal (15–25), High (26–30)
 */

import type { ScoreResult } from '../types/schema';

const REVERSE_INDICES = [2, 4, 7, 8, 9]; // Q3, Q5, Q8, Q9, Q10

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 10) {
        throw new Error(`RSES requires exactly 10 answers, got ${answers.length}`);
    }
    for (let i = 0; i < answers.length; i++) {
        if (answers[i] < 0 || answers[i] > 3 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 0–3, got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];
    const scored = answers.map((v, i) => REVERSE_INDICES.includes(i) ? 3 - v : v);
    const totalScore = scored.reduce((s, v) => s + v, 0);
    const band = getBand(totalScore);

    return {
        totalScore,
        band,
        bandDescription: getBandDescription(band),
        requiresEscalation: false,
        escalationReasons: [],
        rawAnswers,
    };
}

function getBand(score: number): string {
    if (score <= 14) return 'Low self-esteem';
    if (score <= 25) return 'Normal self-esteem';
    return 'High self-esteem';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'Low self-esteem': return 'Low self-esteem — explore self-compassion strategies';
        case 'Normal self-esteem': return 'Healthy self-esteem range';
        case 'High self-esteem': return 'Strong self-esteem';
        default: return '';
    }
}
