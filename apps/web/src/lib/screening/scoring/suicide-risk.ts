/**
 * Suicide Risk Screening Module (C-SSRS Aligned)
 * 6 items — rule-based escalation
 *
 * CRITICAL SAFETY: Every question is high-risk.
 * Any Yes → flag for review. Q4/Q5/Q6 Yes → CRITICAL escalation.
 * NEVER outputs "suicide" or "suicidal" in user-facing text.
 */

import type { ScoreResult } from '../types/schema';

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 6) {
        throw new Error(`Suicide Risk Screening requires exactly 6 answers, got ${answers.length}`);
    }
    for (let i = 0; i < answers.length; i++) {
        if (answers[i] !== 0 && answers[i] !== 1) {
            throw new Error(`Answer ${i + 1} must be 0 (No) or 1 (Yes), got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];
    const totalScore = answers.reduce((s, v) => s + v, 0);

    const anyYes = totalScore > 0;
    const criticalYes = answers[3] === 1 || answers[4] === 1 || answers[5] === 1;

    const escalationReasons: string[] = [];
    if (answers[0] === 1 || answers[1] === 1) {
        escalationReasons.push('Ideation present — safety assessment needed.');
    }
    if (answers[2] === 1) {
        escalationReasons.push('Ideation with method — elevated risk.');
    }
    if (answers[3] === 1 || answers[4] === 1) {
        escalationReasons.push('Ideation with intent/plan — HIGH RISK.');
    }
    if (answers[5] === 1) {
        escalationReasons.push('Prior attempt reported — CRITICAL RISK.');
    }

    const band = criticalYes ? 'Critical risk' : anyYes ? 'Risk flagged' : 'No risk indicators';

    return {
        totalScore,
        band,
        bandDescription: getBandDescription(band),
        requiresEscalation: anyYes,
        escalationReasons,
        rawAnswers,
    };
}

function getBandDescription(band: string): string {
    switch (band) {
        case 'No risk indicators': return 'No risk indicators detected';
        case 'Risk flagged': return 'Risk indicators present — show crisis resources';
        case 'Critical risk': return 'Critical — immediate professional escalation required';
        default: return '';
    }
}
