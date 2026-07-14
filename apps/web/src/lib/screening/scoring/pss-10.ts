/**
 * PSS-10 Scoring Module
 * Perceived Stress Scale (10-item)
 *
 * Method: Sum with reverse scoring for Q4, Q5, Q7, Q8 (0-indexed: 3, 4, 6, 7)
 * Reverse formula: 4 - score
 * Range: 0–40
 * Bands: Low (0–13), Moderate (14–26), High (27–40)
 */

import type { ScoreResult } from '../types/schema';

const REVERSE_INDICES = [3, 4, 6, 7]; // Q4, Q5, Q7, Q8

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 10) {
        throw new Error(`PSS-10 requires exactly 10 answers, got ${answers.length}`);
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
    if (score <= 13) return 'Low stress';
    if (score <= 26) return 'Moderate stress';
    return 'High stress';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'Low stress': return 'Low perceived stress';
        case 'Moderate stress': return 'Moderate stress — consider stress management';
        case 'High stress': return 'High stress — professional support recommended';
        default: return '';
    }
}
