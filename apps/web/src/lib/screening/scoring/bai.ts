/**
 * BAI Scoring Module
 * Beck Anxiety Inventory — 21 items
 *
 * Method: Sum scoring
 * Range: 0–63
 * Bands: Minimal (0–7), Mild (8–15), Moderate (16–25), Severe (26–63)
 */

import type { ScoreResult } from '../types/schema';

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 21) {
        throw new Error(`BAI requires exactly 21 answers, got ${answers.length}`);
    }
    for (let i = 0; i < answers.length; i++) {
        if (answers[i] < 0 || answers[i] > 3 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 0–3, got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];
    const totalScore = answers.reduce((s, v) => s + v, 0);
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
    if (score <= 7) return 'Minimal';
    if (score <= 15) return 'Mild';
    if (score <= 25) return 'Moderate';
    return 'Severe';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'Minimal': return 'No significant anxiety';
        case 'Mild': return 'Mild anxiety';
        case 'Moderate': return 'Moderate anxiety — consider professional consultation';
        case 'Severe': return 'Severe anxiety — urgent professional support';
        default: return '';
    }
}
