/**
 * PSQI Scoring Module (Simplified Self-Report)
 * Sleep Quality Assessment — 18 items (Q1, Q3 are time inputs, not scored directly here)
 *
 * Simplified for digital self-report:
 * Components scored: Subjective quality (Q9), Sleep latency (Q2+Q5a), Sleep duration (Q4),
 *   Sleep disturbances (Q5b-Q5j avg→0-3), Sleep medication (Q6), Daytime dysfunction (Q7+Q8)
 *
 * Inputs: 18 values mapped as:
 *   [0]=Q1(time,ignored), [1]=Q2(0-3), [2]=Q3(time,ignored), [3]=Q4(0-3),
 *   [4]=Q5a(0-3), [5]=Q5b(0-3), [6]=Q5c(0-3), [7]=Q5d(0-3), [8]=Q5e(0-3),
 *   [9]=Q5f(0-3), [10]=Q5g(0-3), [11]=Q5h(0-3), [12]=Q5i(0-3), [13]=Q5j(0-3),
 *   [14]=Q6(0-3), [15]=Q7(0-3), [16]=Q8(0-3), [17]=Q9(0-3)
 *
 * Global PSQI range: 0–21
 * Bands: Good (0–5), Poor (6–21)
 */

import type { ScoreResult } from '../types/schema';

export function computeScore(answers: number[]): ScoreResult {
    if (answers.length !== 18) {
        throw new Error(`PSQI requires exactly 18 answers, got ${answers.length}`);
    }

    // Q1 (index 0) and Q3 (index 2) are time inputs — accept any number (ignored in scoring)
    for (let i = 0; i < answers.length; i++) {
        if (i === 0 || i === 2) continue; // time inputs — skip validation
        if (answers[i] < 0 || answers[i] > 3 || !Number.isInteger(answers[i])) {
            throw new Error(`Answer ${i + 1} must be an integer 0–3, got ${answers[i]}`);
        }
    }

    const rawAnswers = [...answers];

    // Component 1: Subjective sleep quality — Q9 (index 17)
    const c1 = answers[17];

    // Component 2: Sleep latency — Q2 + Q5a, combined and capped at 3
    const latencySum = answers[1] + answers[4];
    const c2 = latencySum <= 1 ? 0 : latencySum <= 2 ? 1 : latencySum <= 4 ? 2 : 3;

    // Component 3: Sleep duration — Q4 (index 3)
    const c3 = answers[3];

    // Component 4: Sleep disturbances — Q5b-Q5j (indices 5-13), sum then categorize
    const disturbSum = [5, 6, 7, 8, 9, 10, 11, 12, 13].reduce((s, i) => s + answers[i], 0);
    const c4 = disturbSum === 0 ? 0 : disturbSum <= 9 ? 1 : disturbSum <= 18 ? 2 : 3;

    // Component 5: Sleep medication — Q6 (index 14)
    const c5 = answers[14];

    // Component 6: Daytime dysfunction — Q7 + Q8 (indices 15, 16), combined and capped
    const daySum = answers[15] + answers[16];
    const c6 = daySum <= 1 ? 0 : daySum <= 2 ? 1 : daySum <= 4 ? 2 : 3;

    // Component 7: Sleep efficiency — simplified (skip, set to 0 for self-report)
    const c7 = 0;

    const globalPSQI = c1 + c2 + c3 + c4 + c5 + c6 + c7;
    const band = globalPSQI <= 5 ? 'Good sleep quality' : 'Poor sleep quality';

    return {
        totalScore: globalPSQI,
        band,
        bandDescription: band === 'Good sleep quality'
            ? 'Adequate sleep quality'
            : 'Poor sleep quality — improvement plan recommended',
        subscaleScores: {
            subjective_quality: { score: c1 },
            sleep_latency: { score: c2 },
            sleep_duration: { score: c3 },
            sleep_disturbances: { score: c4 },
            sleep_medication: { score: c5 },
            daytime_dysfunction: { score: c6 },
        },
        requiresEscalation: false,
        escalationReasons: c5 >= 2
            ? ['Frequent sleep medication use — flag for clinician review.']
            : [],
        rawAnswers,
    };
}
