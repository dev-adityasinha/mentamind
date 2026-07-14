/**
 * Canonical questionnaire schema definitions.
 * All parsed questionnaire JSONs must conform to this interface.
 */

export interface ResponseOption {
    value: number;
    label: string;
}

export interface Question {
    id: string;           // e.g. "q1", "q2"
    index: number;        // 0-based
    text: string;         // question stem
    subscale?: string;    // e.g. "anxiety", "depression", "EE", "DP", "PA"
    isReverseScored: boolean;
    isHighRisk: boolean;
    highRiskThreshold?: number;   // score ≥ this triggers escalation
    options: ResponseOption[];    // per-question overrides (if different from global scale)
}

export interface ResponseScale {
    min: number;
    max: number;
    labels: Record<number, string>;
}

export interface Band {
    label: string;        // e.g. "Minimal", "Mild", "Moderate", "Severe"
    min: number;
    max: number;
    description?: string;
    action?: string;      // recommended AI action
}

export interface Subscale {
    id: string;           // e.g. "anxiety", "depression"
    label: string;
    questionIds: string[];
    range: { min: number; max: number };
    bands?: Band[];
    method: 'sum' | 'average';
}

export interface EscalationRule {
    questionId: string;
    condition: 'gte' | 'eq' | 'any_yes';
    threshold: number;
    action: string;       // e.g. "immediate_escalation", "flag_review"
    message: string;      // empathetic message to show
}

export interface CanonicalTest {
    id: string;
    title: string;
    description: string;
    timeframe: string;
    instruction: string;
    questions: Question[];
    response_scale: ResponseScale;
    scoring: {
        method: 'sum' | 'subscale' | 'rule-based' | 'average';
        range: { min: number; max: number };
        reverse_items: number[];
        subscales?: Subscale[];
        bands: Band[];
    };
    display: {
        one_question_per_screen: boolean;
        show_progress: boolean;
    };
    high_risk_items: string[];         // question IDs with escalation
    escalation_rules: EscalationRule[];
    recommended_actions: Record<string, string[]>;
    safety_notes: string[];
    non_diagnostic_disclaimer: string;
}

export interface ScoreResult {
    totalScore: number;
    band: string;
    bandDescription?: string;
    subscaleScores?: Record<string, { score: number; band?: string }>;
    requiresEscalation: boolean;
    escalationReasons: string[];
    rawAnswers: number[];
}

export interface ValidationReport {
    testId: string;
    confidence: number;
    issues: ValidationIssue[];
    suggestedFixes: string[];
    needs_review: boolean;
    timestamp: string;
    questionCount: number;
    scaleRange: { min: number; max: number };
    bandsCovered: boolean;
}

export interface ValidationIssue {
    severity: 'error' | 'warning' | 'info';
    field: string;
    message: string;
}
