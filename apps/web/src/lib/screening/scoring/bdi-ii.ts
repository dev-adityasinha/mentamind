/**
 * BDI-II Scoring Module
 * Beck Depression Inventory-II — 21 items
 *
 * Method: Sum scoring with Q9 high-risk escalation
 * Range: 0–63
 * Bands: Minimal (0–13), Mild (14–19), Moderate (20–28), Severe (29–63)
 * Safety: Q9 (suicidal thoughts) — ANY non-zero triggers immediate escalation
 */

import type { ScoreResult } from '../types/schema';

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 21) {
        throw new Error(`BDI-II requires exactly 21 answers, got ${answers.length}`);
    }
    for (let i = 0; i < answers.length; i++) {
        if (answers[i] < 0 || answers[i] > 3 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 0–3, got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];
    const totalScore = answers.reduce((s, v) => s + v, 0);
    const band = getBand(totalScore);

    // Q9 = index 8 (suicidal thoughts)
    const q9Score = answers[8];
    const requiresEscalation = q9Score >= 1;
    const escalationReasons: string[] = [];

    if (requiresEscalation) {
        escalationReasons.push('Q9 ≥ 1 — suicidal thoughts detected. Immediate safety assessment required.');
    }

    return {
        totalScore,
        band,
        bandDescription: getBandDescription(band),
        requiresEscalation,
        escalationReasons,
        rawAnswers,
    };
}

function getBand(score: number): string {
    if (score <= 13) return 'Minimal';
    if (score <= 19) return 'Mild';
    if (score <= 28) return 'Moderate';
    return 'Severe';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'Minimal': return 'No significant depression';
        case 'Mild': return 'Mild depression symptoms';
        case 'Moderate': return 'Moderate depression — professional consultation recommended';
        case 'Severe': return 'Severe depression — urgent professional treatment';
        default: return '';
    }
}
