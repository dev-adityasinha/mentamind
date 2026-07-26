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
            className="min-h-screen bg-bg flex flex-col"
            role="main"
            aria-label="Screening results"
        >
            {/* Header */}
            <header className="px-6 pt-8 pb-2">
                <p className="text-sm font-medium text-mentamind-600 tracking-wide uppercase">
                    {testTitle}
                </p>
                <h1 className="text-2xl font-bold text-gray-800 mt-1">Your Results</h1>
            </header>

            {/* Score Card */}
            <div className="px-6 py-6 max-w-2xl mx-auto w-full">
                <div className="bg-white rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 p-8">
                    {/* Score Circle */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative w-32 h-32 mb-4">
                            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 128 128">
                                <circle
                                    cx="64" cy="64" r="56"
                                    fill="none" stroke="#e5e7eb" strokeWidth="8"
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
                                <span className="text-3xl font-bold text-gray-800">{totalScore}</span>
                                <span className="text-xs text-gray-400">of {maxScore}</span>
                            </div>
                        </div>
                        <span className={`inline-flex px-4 py-1.5 rounded-full text-sm font-semibold ${getBandBadgeClass(band.label)}`}>
                            {band.label}
                        </span>
                    </div>

                    {/* Description — Non-diagnostic language */}
                    {band.description && (
                        <p className="text-center text-gray-600 mb-6 leading-relaxed">
                            {band.description}
                        </p>
                    )}

                    {/* Subscale Results */}
                    {subscales && subscales.length > 0 && (
                        <div className="border-t border-gray-100 pt-6 mb-6">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                                Subscale Insights
                            </h3>
                            <div className="space-y-4">
                                {subscales.map((sub) => (
                                    <div key={sub.label} className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-700">{sub.label}</p>
                                            <p className="text-sm text-gray-400">{sub.band}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-lg font-semibold text-gray-800">{sub.score}</span>
                                            <span className="text-sm text-gray-400">/{sub.maxScore}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommended Next Steps */}
                    {recommendedActions.length > 0 && (
                        <div className="border-t border-gray-100 pt-6 mb-6">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                Recommended Next Steps
                            </h3>
                            <ul className="space-y-2">
                                {recommendedActions.map((action, i) => (
                                    <li key={i} className="flex items-start gap-2 text-gray-600">
                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-mentamind-400 flex-shrink-0" />
                                        <span>{action}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Disclaimer */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                        <p className="text-sm text-amber-800 leading-relaxed">
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
                        className="px-6 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium
                       hover:bg-gray-50 transition-colors focus:outline-none focus:ring-4 focus:ring-gray-200
                       min-h-[48px]"
                    >
                        Retake
                    </button>
                )}
                {onClose && (
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 rounded-xl font-semibold text-white
                       bg-mentamind-600 hover:bg-mentamind-700 shadow-lg shadow-mentamind-200
                       transition-all focus:outline-none focus:ring-4 focus:ring-mentamind-200 min-h-[48px]"
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
        case 'none': return 'text-mentamind-500';
        case 'mild': return 'text-yellow-500';
        case 'moderate': return 'text-orange-500';
        case 'severe': return 'text-red-500';
        default: return 'text-mentamind-500';
    }
}

function getBandBadgeClass(label: string): string {
    switch (label.toLowerCase()) {
        case 'none': return 'bg-mentamind-100 text-mentamind-800';
        case 'mild': return 'bg-yellow-100 text-yellow-800';
        case 'moderate': return 'bg-orange-100 text-orange-800';
        case 'severe': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

export default ResultsPage;
