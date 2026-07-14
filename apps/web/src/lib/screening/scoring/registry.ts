/**
 * Scoring Registry — maps test IDs to their scoring functions
 * so the generic test runner can dynamically compute scores.
 */
import { ScoreResult } from '../types/schema';

import { computeScore as phq4Score } from './phq-4';
import { computeScore as phq9Score } from './phq-9';
import { computeScore as gad7Score } from './gad-7';
import { computeScore as who5Score } from './who-5';
import { computeScore as isiScore } from './isi';
import { computeScore as baiScore } from './bai';
import { computeScore as bdiiiScore } from './bdi-ii';
import { computeScore as pss10Score } from './pss-10';
import { computeScore as pss4Score } from './pss-4';
import { computeScore as rsesScore } from './rses';
import { computeScore as erqScore } from './erq';
import { computeScore as academicStressScore } from './academic-stress';
import { computeScore as adhdScreenerScore } from './adhd-screener';
import { computeScore as burnoutScore } from './burnout';
import { computeScore as personalityScore } from './personality-bfi10';
import { computeScore as sdqScore } from './sdq';
import { computeScore as suicideRiskScore } from './suicide-risk';
import { computeScore as moodMdqScore } from './mood-mdq';
import { computeScore as cognitiveScore } from './cognitive';
import { computeScore as psqiScore } from './psqi';
import { computeScore as iesrScore } from './ies-r';

type ScoringFn = (answers: number[]) => ScoreResult;

const registry: Record<string, ScoringFn> = {
    'phq-4': phq4Score,
    'phq-9': phq9Score,
    'gad-7': gad7Score,
    'who-5': who5Score,
    'isi': isiScore,
    'bai': baiScore,
    'bdi-ii': bdiiiScore,
    'pss-10': pss10Score,
    'pss-4': pss4Score,
    'rses': rsesScore,
    'erq': erqScore,
    'academic-stress': academicStressScore,
    'adhd-screener': adhdScreenerScore,
    'burnout': burnoutScore,
    'personality-bfi10': personalityScore,
    'sdq': sdqScore,
    'suicide-risk': suicideRiskScore,
    'mood-mdq': moodMdqScore,
    'cognitive': cognitiveScore,
    'psqi': psqiScore,
    'ies-r': iesrScore,
};

export function getScorer(testId: string): ScoringFn {
    const fn = registry[testId];
    if (!fn) throw new Error(`No scoring function registered for test: ${testId}`);
    return fn;
}

export default registry;
