/**
 * Academic Stress Scoring Module
 * 15 items, 5 subscales
 *
 * Method: Sum scoring + subscale sums
 * Range: 0–60
 * Bands: Low (0–15), Moderate (16–30), High (31–45), Severe (46–60)
 */

import type { ScoreResult } from '../types/schema';

const SUBSCALE_MAP: Record<string, number[]> = {
    exam_pressure: [0, 1, 2],
    social_pressure: [3, 4, 5],
    workload: [6, 7, 8],
    burnout: [9, 10, 11],
    career_anxiety: [12, 13, 14],
};

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 15) {
        throw new Error(`Academic Stress requires exactly 15 answers, got ${answers.length}`);
    }
    for (let i = 0; i < answers.length; i++) {
        if (answers[i] < 0 || answers[i] > 4 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 0–4, got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];
    const totalScore = answers.reduce((s, v) => s + v, 0);
    const band = getBand(totalScore);

    const subscaleScores: Record<string, { score: number; band?: string }> = {};
    for (const [name, indices] of Object.entries(SUBSCALE_MAP)) {
        const score = indices.reduce((s, i) => s + answers[i], 0);
        subscaleScores[name] = { score, band: score >= 9 ? 'High' : score >= 5 ? 'Moderate' : 'Low' };
    }

    return {
        totalScore,
        band,
        bandDescription: getBandDescription(band),
        subscaleScores,
        requiresEscalation: false,
        escalationReasons: [],
        rawAnswers,
    };
}

function getBand(score: number): string {
    if (score <= 15) return 'Low academic stress';
    if (score <= 30) return 'Moderate academic stress';
    if (score <= 45) return 'High academic stress';
    return 'Severe academic stress';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'Low academic stress': return 'No significant academic stress';
        case 'Moderate academic stress': return 'Moderate stress — time management support helpful';
        case 'High academic stress': return 'High stress — counselling recommended';
        case 'Severe academic stress': return 'Severe stress — urgent professional support';
        default: return '';
    }
}
