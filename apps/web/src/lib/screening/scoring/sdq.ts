/**
 * SDQ Scoring Module
 * Strengths and Difficulties Questionnaire — 25 items
 *
 * Total Difficulties = Emotional + Conduct + Hyperactivity + Peer Problems (Q1-20)
 * Prosocial (Q21-25) scored separately as strength
 * Range: Total Difficulties 0–40, Prosocial 0–10
 * Bands: Normal (0–13), Borderline (14–16), High difficulties (17–40)
 */

import type { ScoreResult } from '../types/schema';

const SUBSCALE_MAP: Record<string, number[]> = {
    emotional: [0, 1, 2, 3, 4],
    conduct: [5, 6, 7, 8, 9],
    hyperactivity: [10, 11, 12, 13, 14],
    peer_problems: [15, 16, 17, 18, 19],
    prosocial: [20, 21, 22, 23, 24],
};

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 25) {
        throw new Error(`SDQ requires exactly 25 answers, got ${answers.length}`);
    }
    for (let i = 0; i < answers.length; i++) {
        if (answers[i] < 0 || answers[i] > 2 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 0–2, got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];

    const subscaleScores: Record<string, { score: number; band?: string }> = {};
    for (const [name, indices] of Object.entries(SUBSCALE_MAP)) {
        subscaleScores[name] = { score: indices.reduce((s, i) => s + answers[i], 0) };
    }

    const totalDifficulties =
        subscaleScores.emotional.score +
        subscaleScores.conduct.score +
        subscaleScores.hyperactivity.score +
        subscaleScores.peer_problems.score;

    const band = getBand(totalDifficulties);

    return {
        totalScore: totalDifficulties,
        band,
        bandDescription: getBandDescription(band),
        subscaleScores,
        requiresEscalation: false,
        escalationReasons: [],
        rawAnswers,
    };
}

function getBand(score: number): string {
    if (score <= 13) return 'Normal';
    if (score <= 16) return 'Borderline';
    return 'High difficulties';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'Normal': return 'No significant difficulties';
        case 'Borderline': return 'Borderline difficulties — monitor';
        case 'High difficulties': return 'High difficulties — professional screening recommended';
        default: return '';
    }
}
