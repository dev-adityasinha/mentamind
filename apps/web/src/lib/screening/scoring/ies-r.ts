/**
 * IES-R Scoring Module
 * Trauma Impact Assessment (IES-R Aligned) — 22 items
 *
 * Method: Sum scoring + 3 subscale sums
 * Range: 0–88
 * Bands: Minimal (0–23), Mild (24–32), Moderate (33–36), Severe (37–88)
 * Escalation: Total ≥ 37
 */

import type { ScoreResult } from '../types/schema';

const SUBSCALE_MAP: Record<string, number[]> = {
    intrusion: [0, 1, 2, 3, 4],
    avoidance: [5, 6, 7, 8, 9, 10, 11],
    hyperarousal: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
};

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 22) {
        throw new Error(`IES-R requires exactly 22 answers, got ${answers.length}`);
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
        subscaleScores[name] = { score: indices.reduce((s, i) => s + answers[i], 0) };
    }

    const requiresEscalation = totalScore >= 37;

    return {
        totalScore,
        band,
        bandDescription: getBandDescription(band),
        subscaleScores,
        requiresEscalation,
        escalationReasons: requiresEscalation
            ? ['IES-R ≥ 37 — high trauma impact. Professional trauma-informed support recommended.']
            : [],
        rawAnswers,
    };
}

function getBand(score: number): string {
    if (score <= 23) return 'Minimal';
    if (score <= 32) return 'Mild';
    if (score <= 36) return 'Moderate';
    return 'Severe';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'Minimal': return 'Minimal trauma-related distress';
        case 'Mild': return 'Mild trauma impact';
        case 'Moderate': return 'Moderate trauma impact — professional support recommended';
        case 'Severe': return 'Severe trauma impact — urgent professional support';
        default: return '';
    }
}
