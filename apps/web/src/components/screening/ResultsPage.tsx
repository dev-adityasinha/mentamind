import React from 'react';

interface BandInfo {
    label: string;
    description?: string;
    action?: string;
}

interface SubscaleResult {
    label: string;
    score: number;
    maxScore: number;
    band: string;
}

interface ResultsPageProps {
    testTitle: string;
    totalScore: number;
    maxScore: number;
    band: BandInfo;
    subscales?: SubscaleResult[];
    recommendedActions: string[];
    disclaimer: string;
    onRetake?: () => void;
    onClose?: () => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({
    testTitle,
    totalScore,
    maxScore,
    band,
    subscales,
    recommendedActions,
    disclaimer,
    onRetake,
    onClose,
}) => {
    const scorePercentage = Math.round((totalScore / maxScore) * 100);

    const bandColorClass = getBandColor(band.label);

    return (
        <div
            className="min-h-screen bg-gradient-to-br from-brand-subtle via-bg to-emerald-50 flex flex-col"
            role="main"
            aria-label="Screening results"
        >
            {/* Header */}
            <header className="px-6 pt-8 pb-2">
                <p className="text-sm font-medium text-brand tracking-wide uppercase">
                    {testTitle}
                </p>
                <h1 className="text-2xl font-bold text-text-primary mt-1">Your Results</h1>
            </header>

            {/* Score Card */}
            <div className="px-6 py-6 max-w-2xl mx-auto w-full">
                <div className="bg-surface rounded-3xl shadow-xl shadow-black/5 border border-border p-8">
                    {/* Score Circle */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative w-32 h-32 mb-4">
                            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 128 128">
                                <circle
                                    cx="64" cy="64" r="56"
                                    fill="none" stroke="var(--color-border)" strokeWidth="8"
                                />
                                <circle
                                    cx="64" cy="64" r="56"
                                    fill="none" stroke="currentColor" strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(scorePercentage / 100) * 352} 352`}
                                    className={bandColorClass}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold text-text-primary">{totalScore}</span>
                                <span className="text-xs text-text-muted">of {maxScore}</span>
                            </div>
                        </div>
                        <span className={`inline-flex px-4 py-1.5 rounded-full text-sm font-semibold ${getBandBadgeClass(band.label)}`}>
                            {band.label}
                        </span>
                    </div>

                    {/* Description — Non-diagnostic language */}
                    {band.description && (
                        <p className="text-center text-text-secondary mb-6 leading-relaxed">
                            {band.description}
                        </p>
                    )}

                    {/* Subscale Results */}
                    {subscales && subscales.length > 0 && (
                        <div className="border-t border-border pt-6 mb-6">
                            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
                                Subscale Insights
                            </h3>
                            <div className="space-y-4">
                                {subscales.map((sub) => (
                                    <div key={sub.label} className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-text-primary">{sub.label}</p>
                                            <p className="text-sm text-text-muted">{sub.band}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-lg font-semibold text-text-primary">{sub.score}</span>
                                            <span className="text-sm text-text-muted">/{sub.maxScore}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommended Next Steps */}
                    {recommendedActions.length > 0 && (
                        <div className="border-t border-border pt-6 mb-6">
                            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
                                Recommended Next Steps
                            </h3>
                            <ul className="space-y-2">
                                {recommendedActions.map((action, i) => (
                                    <li key={i} className="flex items-start gap-2 text-text-secondary">
                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />
                                        <span>{action}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Disclaimer */}
                    <div className="bg-destructive-subtle border border-destructive-subtle rounded-xl p-4 mt-4">
                        <p className="text-sm text-destructive leading-relaxed">
                            <strong>Important:</strong> {disclaimer}
                        </p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <footer className="px-6 pb-8 flex gap-3 max-w-2xl mx-auto w-full">
                {onRetake && (
                    <button
                        onClick={onRetake}
                        className="px-6 py-3 rounded-xl border-2 border-border text-text-secondary font-medium
                       hover:bg-surface-raised transition-colors focus:outline-none focus:ring-4 focus:ring-brand-subtle
                       min-h-[48px]"
                    >
                        Retake
                    </button>
                )}
                {onClose && (
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 rounded-xl font-semibold text-brand-foreground
                       bg-brand hover:bg-brand-hover shadow-lg shadow-black/10
                       transition-all focus:outline-none focus:ring-4 focus:ring-brand-subtle min-h-[48px]"
                    >
                        Done
                    </button>
                )}
            </footer>
        </div>
    );
};

function getBandColor(label: string): string {
    switch (label.toLowerCase()) {
        case 'none': return 'text-brand';
        case 'mild': return 'text-yellow-500';
        case 'moderate': return 'text-orange-500';
        case 'severe': return 'text-red-500';
        default: return 'text-brand';
    }
}

function getBandBadgeClass(label: string): string {
    switch (label.toLowerCase()) {
        case 'none': return 'bg-brand-subtle text-brand';
        case 'mild': return 'bg-yellow-100 text-yellow-800';
        case 'moderate': return 'bg-orange-100 text-orange-800';
        case 'severe': return 'bg-red-100 text-red-800';
        default: return 'bg-surface-raised text-text-secondary';
    }
}

export default ResultsPage;
