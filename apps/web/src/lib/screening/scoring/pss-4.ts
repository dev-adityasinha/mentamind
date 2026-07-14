/**
 * PSS-4 Scoring Module
 * Perceived Stress Scale (4-item)
 *
 * Method: Sum with reverse scoring for Q2, Q3 (0-indexed: 1, 2)
 * Reverse formula: 4 - score
 * Range: 0–16
 * Bands: Low (0–5), Moderate (6–10), High (11–16)
 */

import type { ScoreResult } from '../types/schema';

const REVERSE_INDICES = [1, 2]; // Q2, Q3

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 4) {
        throw new Error(`PSS-4 requires exactly 4 answers, got ${answers.length}`);
    }
    for (let i = 0; i < answers.length; i++) {
        if (answers[i] < 0 || answers[i] > 4 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 0–4, got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];
    const scored = answers.map((v, i) => REVERSE_INDICES.includes(i) ? 4 - v : v);
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
    if (score <= 5) return 'Low stress';
    if (score <= 10) return 'Moderate stress';
    return 'High stress';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'Low stress': return 'Low perceived stress';
        case 'Moderate stress': return 'Moderate stress';
        case 'High stress': return 'High stress — professional support recommended';
        default: return '';
    }
}
