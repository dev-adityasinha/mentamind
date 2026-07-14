/**
 * ISI Scoring Module
 * Insomnia Severity Index
 *
 * Method: Sum scoring
 * Range: 0–28
 * Bands: No insomnia (0–7), Subthreshold (8–14), Moderate (15–21), Severe (22–28)
 */

import type { ScoreResult } from '../types/schema';

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 7) {
        throw new Error(`ISI requires exactly 7 answers, got ${answers.length}`);
    }
    for (let i = 0; i < answers.length; i++) {
        if (answers[i] < 0 || answers[i] > 4 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 0–4, got ${answers[i]}`);
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
    if (score <= 7) return 'No clinically significant insomnia';
    if (score <= 14) return 'Subthreshold insomnia';
    if (score <= 21) return 'Moderate insomnia';
    return 'Severe insomnia';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'No clinically significant insomnia': return 'Sleep hygiene adequate';
        case 'Subthreshold insomnia': return 'Monitor sleep patterns';
        case 'Moderate insomnia': return 'Professional sleep support recommended';
        case 'Severe insomnia': return 'Urgent sleep intervention needed';
        default: return '';
    }
}
