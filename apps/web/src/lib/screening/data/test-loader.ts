/**
 * Test Data Loader — dynamically imports canonical JSON for any test ID
 */

// Static imports for all canonical test JSONs (Vite needs static analysis)
import phq4 from '../data/phq-4.json';
import phq9 from '../data/phq-9.json';
import gad7 from '../data/gad-7.json';
import who5 from '../data/who-5.json';
import isi from '../data/isi.json';
import bai from '../data/bai.json';
import bdiii from '../data/bdi-ii.json';
import pss10 from '../data/pss-10.json';
import pss4 from '../data/pss-4.json';
import rses from '../data/rses.json';
import erq from '../data/erq.json';
import academicStress from '../data/academic-stress.json';
import adhdScreener from '../data/adhd-screener.json';
import burnout from '../data/burnout.json';
import personalityBfi10 from '../data/personality-bfi10.json';
import sdq from '../data/sdq.json';
import suicideRisk from '../data/suicide-risk.json';
import moodMdq from '../data/mood-mdq.json';
import cognitive from '../data/cognitive.json';
import psqi from '../data/psqi.json';
import iesR from '../data/ies-r.json';

const testDataMap: Record<string, any> = {
    'phq-4': phq4,
    'phq-9': phq9,
    'gad-7': gad7,
    'who-5': who5,
    'isi': isi,
    'bai': bai,
    'bdi-ii': bdiii,
    'pss-10': pss10,
    'pss-4': pss4,
    'rses': rses,
    'erq': erq,
    'academic-stress': academicStress,
    'adhd-screener': adhdScreener,
    'burnout': burnout,
    'personality-bfi10': personalityBfi10,
    'sdq': sdq,
    'suicide-risk': suicideRisk,
    'mood-mdq': moodMdq,
    'cognitive': cognitive,
    'psqi': psqi,
    'ies-r': iesR,
};

export function getTestData(testId: string): any {
    const data = testDataMap[testId];
    if (!data) throw new Error(`No test data found for: ${testId}`);
    return data;
}

export default testDataMap;
