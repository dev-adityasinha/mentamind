/**
 * GAD-7 Scoring Module
 * Generalized Anxiety Disorder 7-Item Scale
 *
 * Method: Sum scoring
 * Range: 0–21
 * Bands: Minimal (0–4), Mild (5–9), Moderate (10–14), Severe (15–21)
 *
 * Reference: Spitzer, R.L., Kroenke, K., Williams, J.B.W., & Löwe, B. (2006)
 */

import type { ScoreResult } from '../types/schema';

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 7) {
        throw new Error(`GAD-7 requires exactly 7 answers, got ${answers.length}`);
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
        escalationReasons: totalScore >= 10 ? ['GAD-7 ≥ 10 — clinically significant anxiety. Consider BAI for deeper assessment.'] : [],
        rawAnswers,
    };
}

function getBand(score: number): string {
    if (score <= 4) return 'Minimal';
    if (score <= 9) return 'Mild';
    if (score <= 14) return 'Moderate';
    return 'Severe';
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'Minimal': return 'No significant anxiety detected';
        case 'Mild': return 'Mild anxiety level';
        case 'Moderate': return 'Moderate anxiety — consider professional consultation';
        case 'Severe': return 'Severe anxiety — professional support strongly recommended';
        default: return '';
    }
}
