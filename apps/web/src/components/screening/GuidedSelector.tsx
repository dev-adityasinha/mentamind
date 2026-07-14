import React from 'react';
import questionnaireMap from '@/lib/screening/data/questionnaire-map.json';

interface GuidedSelectorProps {
    onSelectTest: (testId: string) => void;
    onBrowseAll: () => void;
    onBack: () => void;
}

const optionIcons: Record<string, string> = {
    cloud: '☁️',
    rain: '🌧️',
    moon: '🌙',
    fire: '🔥',
    target: '🎯',
    sparkle: '✨',
};

export const GuidedSelector: React.FC<GuidedSelectorProps> = ({ onSelectTest, onBrowseAll, onBack }) => {
    const [selectedOption, setSelectedOption] = React.useState<number | null>(null);
    const guided = questionnaireMap.guidedQuestions[0];

    const recommendedTests = selectedOption !== null
        ? guided.options[selectedOption].recommendedTests
        : [];

    // Get test details from the map
    const getTestInfo = (testId: string) => {
        for (const cat of questionnaireMap.categories) {
            const found = cat.tests.find(t => t.id === testId);
            if (found) return { ...found, categoryColor: cat.color };
        }
        return null;
    };

    return (
        <div className="min-h-screen bg-bg flex flex-col">
            {/* Header */}
            <header className="px-6 pt-6 pb-4 flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center
                               hover:bg-surface-raised transition-colors focus:outline-none focus:ring-4 focus:ring-brand-subtle"
                    aria-label="Go back"
                >
                    <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div>
                    <h1 className="text-lg font-semibold text-text-primary">Check In</h1>
                    <p className="text-xs text-text-muted">Take your time, no rush</p>
                </div>
            </header>

            <main className="flex-1 px-6 pb-8 max-w-lg mx-auto w-full">
                {/* Question */}
                <div className="mb-6 animate-fade-slide">
                    <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2">
                        {guided.text}
                    </h2>
                    <p className="text-sm text-text-muted">
                        Choose what resonates most — we&apos;ll suggest a good starting point.
                    </p>
                </div>

                {/* Options */}
                <div className="space-y-2.5 stagger-children mb-8">
                    {guided.options.map((option, idx) => {
                        const isSelected = selectedOption === idx;
                        return (
                            <button
                                key={idx}
                                onClick={() => setSelectedOption(idx)}
                                className={`w-full text-left px-5 py-4 rounded-2xl border-2 transition-all duration-200
                                    focus:outline-none focus:ring-4 focus:ring-brand-subtle min-h-[56px]
                                    ${isSelected
                                        ? 'border-brand bg-brand-subtle shadow-md shadow-black/5'
                                        : 'border-border bg-surface hover:border-border-strong hover:bg-surface-raised'
                                    }`}
                            >
                                <span className="flex items-center gap-3">
                                    <span className="text-xl flex-shrink-0">
                                        {optionIcons[option.icon] || '💚'}
                                    </span>
                                    <span className={`text-base font-medium ${isSelected ? 'text-brand' : 'text-text-primary'}`}>
                                        {option.label}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Recommended tests */}
                {selectedOption !== null && (
                    <div className="animate-fade-slide">
                        <p className="text-sm font-medium text-text-secondary mb-3 uppercase tracking-wide">
                            We suggest starting with
                        </p>
                        <div className="space-y-2">
                            {recommendedTests.map((testId, idx) => {
                                const info = getTestInfo(testId);
                                if (!info) return null;
                                return (
                                    <button
                                        key={testId}
                                        onClick={() => onSelectTest(testId)}
                                        className="w-full text-left px-5 py-4 rounded-2xl bg-surface border border-border
                                                   hover:border-border-strong hover:shadow-md transition-all duration-200
                                                   focus:outline-none focus:ring-4 focus:ring-brand-subtle group"
                                        style={{ animationDelay: `${idx * 80}ms` }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-text-primary group-hover:text-brand transition-colors">
                                                    {info.title}
                                                </p>
                                                <p className="text-sm text-text-muted mt-0.5">
                                                    {info.purpose}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                                <span className="text-xs text-text-muted">{info.time}</span>
                                                <svg className="w-5 h-5 text-text-muted group-hover:text-brand transition-colors"
                                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Browse all link */}
                <div className="mt-6 text-center">
                    <button
                        onClick={onBrowseAll}
                        className="text-sm text-brand hover:text-brand-hover font-medium transition-colors
                                   focus:outline-none focus:ring-4 focus:ring-brand-subtle rounded-lg px-3 py-1.5"
                    >
                        Or browse all screenings →
                    </button>
                </div>
            </main>
        </div>
    );
};

export default GuidedSelector;
