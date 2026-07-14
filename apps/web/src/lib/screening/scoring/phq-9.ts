/**
 * PHQ-9 Scoring Module
 * Patient Health Questionnaire-9
 *
 * Method: Sum scoring with Q9 high-risk escalation
 * Range: 0–27
 * Bands: None-minimal (0–4), Mild (5–9), Moderate (10–14),
 *        Moderately severe (15–19), Severe (20–27)
 * Safety: Q9 (suicidal ideation) — ANY non-zero triggers immediate escalation
 *
 * Reference: Kroenke, K., Spitzer, R.L., & Williams, J.B.W. (2001)
 */

import type { ScoreResult } from '../types/schema';

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 9) {
        throw new Error(`PHQ-9 requires exactly 9 answers, got ${answers.length}`);
    }
    for (let i = 0; i < answers.length; i++) {
        if (answers[i] < 0 || answers[i] > 3 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 0–3, got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];
    const totalScore = answers.reduce((s, v) => s + v, 0);
    const band = getBand(totalScore);

    // Q9 = index 8 (thoughts of self-harm)
    const q9Score = answers[8];
    const requiresEscalation = q9Score >= 1;
    const escalationReasons: string[] = [];

    if (requiresEscalation) {
        escalationReasons.push('Q9 ≥ 1 — suicidal ideation detected. Immediate safety assessment required.');
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
    if (score <= 4) return 'None-minimal';
    if (score <= 9) return 'Mild';
    if (score <= 14) return 'Moderate';
    if (score <= 19) return 'Moderately severe';
    return 'Severe';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'None-minimal': return 'No significant depression detected';
        case 'Mild': return 'Mild depression symptoms';
        case 'Moderate': return 'Moderate depression — consider counselling';
        case 'Moderately severe': return 'Moderately severe depression — active treatment recommended';
        case 'Severe': return 'Severe depression — immediate professional support';
        default: return '';
    }
}
