/**
 * Mood Disorder Screening (MDQ) Scoring Module
 * 15 items — rule-based, three-criteria screening
 *
 * Positive screen requires ALL three:
 *   1. Section 1 (Q1-Q13): ≥ 7 Yes responses
 *   2. Q14 = Yes (symptoms clustered in same period)
 *   3. Q15 ≥ 2 (moderate or serious functional impact)
 *
 * FLAG-ONLY — never labels as "bipolar"
 */

import type { ScoreResult } from '../types/schema';

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 15) {
        throw new Error(`MDQ requires exactly 15 answers, got ${answers.length}`);
    }

    // Q1-Q14: 0 or 1; Q15: 0-3
    for (let i = 0; i < 14; i++) {
        if (answers[i] !== 0 && answers[i] !== 1) {
            throw new Error(`Answer ${i + 1} must be 0 or 1, got ${answers[i]}`);
        }
    }
    if (answers[14] < 0 || answers[14] > 3 || !Number.isInteger(answers[14])) {
        throw new Error(`Answer 15 must be an integer 0–3, got ${answers[14]}`);
    }

    const rawAnswers = [...answers];

    // Criteria 1: Section 1 yes count
    const section1YesCount = answers.slice(0, 13).reduce((s, v) => s + v, 0);
    const criterion1 = section1YesCount >= 7;

    // Criteria 2: Q14 clustering
    const criterion2 = answers[13] === 1;

    // Criteria 3: Q15 functional impact ≥ 2
    const criterion3 = answers[14] >= 2;

    const positiveScreen = criterion1 && criterion2 && criterion3;
    const band = positiveScreen ? 'Positive screen' : 'Negative screen';

    return {
        totalScore: section1YesCount,
        band,
        bandDescription: positiveScreen
            ? 'Mood patterns detected — professional evaluation recommended'
            : 'No significant mood pattern indicators',
        subscaleScores: {
            section1_yes: { score: section1YesCount },
            clustering: { score: answers[13] },
            impact: { score: answers[14] },
        },
        requiresEscalation: false,
        escalationReasons: positiveScreen
            ? ['Positive MDQ screen — recommend professional mood evaluation.']
            : [],
        rawAnswers,
    };
}
