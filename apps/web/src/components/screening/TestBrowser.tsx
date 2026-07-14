import React from 'react';
import questionnaireMap from '@/lib/screening/data/questionnaire-map.json';

interface TestBrowserProps {
    onSelectTest: (testId: string) => void;
    onBack: () => void;
}

const categoryIcons: Record<string, string> = {
    'mood-emotions': '\u{1F49C}',
    'stress-coping': '\u{1F536}',
    'sleep-body': '\u{1F319}',
    'self-attention': '\u{1F9E0}',
    'behaviour-safety': '\u{1F6E1}\u{FE0F}',
};

export const TestBrowser: React.FC<TestBrowserProps> = ({ onSelectTest, onBack }) => {
    return (
        <div className="min-h-screen bg-bg">
            <header className="px-6 pt-6 pb-4 flex items-center gap-3 sticky top-0 z-10 bg-surface/80 backdrop-blur-sm border-b border-border">
                <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center
                               hover:bg-surface-raised transition-colors focus:outline-none focus:ring-4 focus:ring-focus"
                    aria-label="Go back"
                >
                    <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div>
                    <h1 className="text-lg font-semibold text-text-primary">All Screenings</h1>
                    <p className="text-xs text-text-muted">{questionnaireMap.categories.reduce((n, c) => n + c.tests.length, 0)} available</p>
                </div>
            </header>

            <main className="px-6 py-6 max-w-lg mx-auto space-y-3">
                {questionnaireMap.categories.map((category) => (
                    <details key={category.id} className="group rounded-xl border border-border bg-surface overflow-hidden animate-fade-slide">
                        <summary className="flex items-center gap-3 px-4 py-3.5 cursor-pointer list-none
                                           hover:bg-surface-raised transition-colors select-none">
                            <span className="text-lg">{categoryIcons[category.id] || '\u{1F4CB}'}</span>
                            <div className="flex-1 min-w-0">
                                <span className="font-semibold text-text-primary text-sm">{category.name}</span>
                                <span className="ml-2 text-xs text-text-muted">{category.tests.length} tests</span>
                            </div>
                            <svg className="w-4 h-4 text-text-muted transition-transform duration-200 group-open:rotate-90"
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </summary>
                        <div className="border-t border-border px-4 py-3 space-y-2">
                            {category.tests.map((test) => (
                                <button
                                    key={test.id}
                                    onClick={() => onSelectTest(test.id)}
                                    className="w-full text-left px-4 py-3 rounded-lg bg-bg border border-border
                                               hover:border-border-strong hover:shadow-sm transition-all duration-200
                                               focus:outline-none focus:ring-4 focus:ring-focus group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-text-primary group-hover:text-brand transition-colors truncate">
                                                    {test.title}
                                                </p>
                                                {test.tags.includes('quick') && (
                                                    <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-success-subtle text-success border border-success-subtle">
                                                        Quick
                                                    </span>
                                                )}
                                                {test.tags.includes('recommended') && (
                                                    <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-brand-subtle text-brand border border-brand-subtle">
                                                        Recommended
                                                    </span>
                                                )}
                                                {test.tags.includes('safety') && (
                                                    <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-destructive-subtle text-destructive border border-destructive-subtle">
                                                        Safety
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-text-muted mt-0.5 truncate">
                                                {test.purpose}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                            <div className="text-right">
                                                <p className="text-xs text-text-muted">{test.time}</p>
                                                <p className="text-[10px] text-text-muted">{test.questions} Qs</p>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </details>
                ))}

                <div className="pt-4 pb-8 text-center">
                    <p className="text-xs text-text-muted max-w-sm mx-auto">
                        All screenings use clinically validated tools. Results are for self-awareness only \u2014 not a diagnosis.
                    </p>
                </div>
            </main>
        </div>
    );
};

export default TestBrowser;
