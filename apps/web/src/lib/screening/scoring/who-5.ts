/**
 * WHO-5 Scoring Module
 * WHO-5 Well-Being Index
 *
 * Method: Sum raw scores (0–25) then multiply by 4 for percentage (0–100)
 * Range: 0–100 (percentage)
 * Bands: Good (52–100), Low (29–51), Likely depression (0–28)
 *
 * Reference: WHO (1998)
 */

import type { ScoreResult } from '../types/schema';

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 5) {
        throw new Error(`WHO-5 requires exactly 5 answers, got ${answers.length}`);
    }
    for (let i = 0; i < answers.length; i++) {
        if (answers[i] < 0 || answers[i] > 5 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 0–5, got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];
    const rawScore = answers.reduce((s, v) => s + v, 0);
    const percentageScore = rawScore * 4;
    const band = getBand(percentageScore);

    return {
        totalScore: percentageScore,
        band,
        bandDescription: getBandDescription(band),
        subscaleScores: { raw: { score: rawScore } },
        requiresEscalation: false,
        escalationReasons: percentageScore <= 28
            ? ['WHO-5 ≤ 28% — likely depression. Screen with PHQ-9.']
            : [],
        rawAnswers,
    };
}

function getBand(pct: number): string {
    if (pct >= 52) return 'Good well-being';
    if (pct >= 29) return 'Low well-being';
    return 'Likely depression';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'Good well-being': return 'Good subjective well-being';
        case 'Low well-being': return 'Low well-being — monitor mood';
        case 'Likely depression': return 'Possible depression — recommend PHQ-9 screening';
        default: return '';
    }
}
