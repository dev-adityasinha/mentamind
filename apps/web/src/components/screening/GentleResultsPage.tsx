import React, { useState } from 'react';
import { ScoreResult } from '@/lib/screening/types/schema';
import { EscalationModal } from './EscalationModal';

interface GentleResultsPageProps {
    testId: string;
    testTitle: string;
    result: ScoreResult;
    testData: any;
    onRetake: () => void;
    onHome: () => void;
}

function gentleBandMessage(band: string, testId: string): { headline: string; description: string } {
    const b = band.toLowerCase();

    if (b.includes('minimal') || b.includes('none') || b.includes('no significant') || b.includes('normal') || b.includes('low')) {
        return {
            headline: 'Things seem to be going well',
            description: 'Your responses suggest you\'re managing well in this area. It\'s great that you took the time to check in — keep doing what works for you.',
        };
    }
    if (b.includes('mild')) {
        return {
            headline: 'Some patterns worth noticing',
            description: 'Your responses suggest some mild experiences in this area. This is common and nothing to be alarmed about. Being aware of these patterns is a positive step.',
        };
    }
    if (b.includes('moderate') && !b.includes('severe')) {
        return {
            headline: 'You may be going through something',
            description: 'Your responses suggest you may be experiencing some noticeable challenges. Talking to someone you trust, or exploring professional support, could be really helpful.',
        };
    }
    if (b.includes('severe') || b.includes('high')) {
        return {
            headline: 'It looks like things have been tough',
            description: 'Your responses suggest you may be experiencing significant challenges right now. Please know that support is available, and reaching out to a professional is a strong and brave step.',
        };
    }

    if (b.includes('good well-being') || b.includes('excellent')) {
        return {
            headline: 'You seem to be in a good place',
            description: 'Your well-being appears strong. Keep nurturing the habits and connections that support you.',
        };
    }
    if (b.includes('poor') || b.includes('concern')) {
        return {
            headline: 'Your well-being could use some attention',
            description: 'Your responses suggest your well-being may benefit from some extra care. Consider what small changes might make your days feel a bit brighter.',
        };
    }

    return {
        headline: 'Thank you for sharing',
        description: 'Your responses have been recorded. Take a moment to reflect on what this means for you.',
    };
}

function getScoreColor(band: string): string {
    const b = band.toLowerCase();
    if (b.includes('minimal') || b.includes('none') || b.includes('no significant') || b.includes('normal') || b.includes('low') || b.includes('good'))
        return 'from-emerald-400 to-teal-500';
    if (b.includes('mild'))
        return 'from-amber-400 to-yellow-500';
    if (b.includes('moderate'))
        return 'from-orange-400 to-amber-500';
    return 'from-rose-400 to-red-500';
}

export const GentleResultsPage: React.FC<GentleResultsPageProps> = ({
    testId,
    testTitle,
    result,
    testData,
    onRetake,
    onHome,
}) => {
    const [showModal, setShowModal] = useState(result.requiresEscalation || false);
    const { headline, description } = gentleBandMessage(result.band, testId);
    const maxScore = testData.scoring?.maxScore ?? testData.scoring?.range?.max ?? 100;
    const percentage = Math.round((result.totalScore / maxScore) * 100);
    const colorGradient = getScoreColor(result.band);

    const actions: string[] = [];
    if (testData.recommendedActions) {
        const action = testData.recommendedActions[result.band];
        if (action) {
            if (Array.isArray(action)) actions.push(...action);
            else actions.push(action);
        }
    }
    if (testData.recommended_actions) {
        const key = result.band.toLowerCase();
        const action = testData.recommended_actions[key];
        if (action) {
            if (Array.isArray(action)) actions.push(...action);
            else actions.push(action);
        }
    }

    const disclaimer = testData.non_diagnostic_disclaimer || testData.safetyNotes?.[0]
        || 'This is a screening tool, not a diagnosis.';

    return (
        <div className="min-h-screen bg-bg flex flex-col">
            <main className="flex-1 px-6 py-8 max-w-lg mx-auto w-full">
                <div className="text-center mb-8 animate-fade-slide">
                    <p className="text-sm font-medium text-brand tracking-wide uppercase mb-2">
                        {testTitle}
                    </p>
                    <p className="text-xs text-text-muted">
                        Your responses have been processed
                    </p>
                </div>

                <div className="animate-scale-in mb-8">
                    <div className="rounded-3xl p-8 text-center shadow-lg bg-surface border border-border">
                        <div className="relative w-32 h-32 mx-auto mb-5">
                            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-border)" strokeWidth="8" />
                                <circle
                                    cx="60" cy="60" r="50" fill="none"
                                    stroke="url(#scoreGradient)"
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(percentage / 100) * 314} 314`}
                                    className="transition-all duration-1000 ease-out"
                                />
                                <defs>
                                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" className={`${colorGradient.split(' ')[0]}`} stopColor="currentColor" />
                                        <stop offset="100%" className={`${colorGradient.split(' ')[1]}`} stopColor="currentColor" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold text-text-primary">{result.totalScore}</span>
                                <span className="text-xs text-text-muted">of {maxScore}</span>
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-text-primary mb-2">{headline}</h2>
                        <p className="text-text-secondary leading-relaxed text-sm">{description}</p>
                    </div>
                </div>

                {result.subscaleScores && Object.keys(result.subscaleScores).length > 0 && (
                    <div className="mb-8 animate-fade-slide" style={{ animationDelay: '0.2s' }}>
                        <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3">
                            Areas Explored
                        </h3>
                        <div className="space-y-2">
                            {Object.entries(result.subscaleScores).map(([name, data]) => (
                                <div key={name} className="rounded-xl px-4 py-3 bg-surface border border-border">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium text-text-primary capitalize">
                                            {name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-sm text-text-muted">
                                            {(data as any).score}
                                        </span>
                                    </div>
                                    {(data as any).band && (
                                        <p className="text-xs text-text-muted">{(data as any).band}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {result.requiresEscalation && (
                    <div className="mb-8 bg-destructive-subtle border border-destructive-subtle rounded-xl p-5 animate-fade-slide" style={{ animationDelay: '0.3s' }}>
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <p className="font-semibold text-destructive mb-1">We care about your safety</p>
                                <p className="text-sm text-destructive leading-relaxed">
                                    Some of your responses suggest you may benefit from speaking with someone who can help.
                                    Please consider reaching out to a mental health professional or a helpline.
                                </p>
                                {result.escalationReasons.length > 0 && (
                                    <ul className="mt-2 space-y-1">
                                        {result.escalationReasons.map((r, i) => (
                                            <li key={i} className="text-xs text-destructive-hover">• {r}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <EscalationModal 
                    isOpen={showModal} 
                    message={result.escalationReasons.join(" ")}
                    onAcknowledge={() => setShowModal(false)}
                />

                <div className="mb-8 animate-fade-slide" style={{ animationDelay: '0.4s' }}>
                    <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3">
                        What You Can Do Next
                    </h3>
                    <div className="space-y-2">
                        {actions.length > 0 && actions.map((action, i) => (
                            <div key={i} className="rounded-xl px-4 py-3 bg-surface border border-border">
                                <p className="text-sm text-text-secondary">{action}</p>
                            </div>
                        ))}

                        <a
                            href="https://mentamind.in"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full text-left px-4 py-3.5 rounded-xl bg-brand-subtle border border-brand-subtle
                                       hover:bg-brand-subtle transition-colors group"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-brand">Talk to a professional</p>
                                    <p className="text-xs text-brand mt-0.5">Connect with a counsellor on Mentamind</p>
                                </div>
                                <svg className="w-4 h-4 text-brand group-hover:translate-x-0.5 transition-transform"
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </div>
                        </a>

                        <a
                            href="https://mentamind.in"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full text-left px-4 py-3.5 rounded-xl bg-surface border border-border
                                       hover:border-brand-hover transition-colors group"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-text-primary">Learn more about this area</p>
                                    <p className="text-xs text-text-muted mt-0.5">Read educational content on Mentamind</p>
                                </div>
                                <svg className="w-4 h-4 text-text-muted group-hover:text-brand-hover transition-colors"
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </div>
                        </a>
                    </div>
                </div>

                <div className="space-y-3 mb-8 animate-fade-slide" style={{ animationDelay: '0.5s' }}>
                    <button
                        onClick={onHome}
                        className="w-full px-6 py-3.5 rounded-2xl font-semibold text-brand-foreground
                               bg-brand hover:bg-brand-hover shadow-lg shadow-brand/20
                               transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-focus
                               active:scale-[0.98]"
                    >
                        Take another screening
                    </button>
                    <button
                        onClick={onRetake}
                        className="w-full px-6 py-3 rounded-2xl font-medium text-text-secondary
                               bg-surface border border-border hover:bg-surface-raised
                               transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-focus"
                    >
                        Retake this screening
                    </button>
                </div>

                <div className="text-center pb-8 animate-fade-in" style={{ animationDelay: '0.6s' }}>
                    <div className="bg-surface-raised rounded-xl p-4">
                        <p className="text-xs text-text-muted leading-relaxed">
                            <strong className="text-text-secondary">Important:</strong> {disclaimer}
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default GentleResultsPage;
