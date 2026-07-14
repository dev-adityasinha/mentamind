/**
 * ADHD Screener Scoring Module (ASRS-Aligned)
 * 18 items — Part A (Q1-6) drives screening, Part B (Q7-18) supplemental
 *
 * Method: Sum, but screening based on Part A score only
 * Part A range: 0–24
 * Bands: Unlikely (0–9), Possible (10–16), Likely (17–24)
 */

import type { ScoreResult } from '../types/schema';

const PART_A_INDICES = [0, 1, 2, 3, 4, 5];
const PART_B_INDICES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 18) {
        throw new Error(`ADHD Screener requires exactly 18 answers, got ${answers.length}`);
    }
    for (let i = 0; i < answers.length; i++) {
        if (answers[i] < 0 || answers[i] > 4 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 0–4, got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];
    const partAScore = PART_A_INDICES.reduce((s, i) => s + answers[i], 0);
    const partBScore = PART_B_INDICES.reduce((s, i) => s + answers[i], 0);
    const totalScore = partAScore + partBScore;
    const band = getBand(partAScore);

    return {
        totalScore,
        band,
        bandDescription: getBandDescription(band),
        subscaleScores: {
            part_a: { score: partAScore, band },
            part_b: { score: partBScore },
        },
        requiresEscalation: false,
        escalationReasons: [],
        rawAnswers,
    };
}

function getBand(partAScore: number): string {
    if (partAScore <= 9) return 'Unlikely ADHD';
    if (partAScore <= 16) return 'Possible ADHD';
    return 'Likely ADHD';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'Unlikely ADHD': return 'No significant ADHD indicators';
        case 'Possible ADHD': return 'Possible ADHD — professional evaluation recommended';
        case 'Likely ADHD': return 'Likely ADHD — professional evaluation strongly recommended';
        default: return '';
    }
}
