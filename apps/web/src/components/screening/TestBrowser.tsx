import React, { useState } from 'react';
import questionnaireMap from '@/lib/screening/data/questionnaire-map.json';

interface TestBrowserProps {
    onSelectTest: (testId: string) => void;
    onBack: () => void;
}

const categoryIcons: Record<string, string> = {
    'mood-emotions': '💜',
    'stress-coping': '🔶',
    'sleep-body': '🌙',
    'self-attention': '🧠',
    'behaviour-safety': '🛡️',
};

export const TestBrowser: React.FC<TestBrowserProps> = ({ onSelectTest, onBack }) => {
    // Categories are collapsed by default and expand as a dropdown on click.
    const [openCategory, setOpenCategory] = useState<string | null>(null);
    const toggleCategory = (id: string) =>
        setOpenCategory((cur) => (cur === id ? null : id));
    return (
        <div className="min-h-screen bg-bg">
            {/* Header */}
            <header className="px-6 pt-6 pb-4 flex items-center gap-3 sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100">
                <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center
                               hover:bg-gray-50 transition-colors focus:outline-none focus:ring-4 focus:ring-mentamind-200"
                    aria-label="Go back"
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div>
                    <h1 className="text-lg font-semibold text-gray-800">All Screenings</h1>
                    <p className="text-xs text-gray-400">{questionnaireMap.categories.reduce((n, c) => n + c.tests.length, 0)} available</p>
                </div>
            </header>

            <main className="px-6 py-6 max-w-lg mx-auto space-y-8">
                {questionnaireMap.categories.map((category) => (
                    <section key={category.id} className="animate-fade-slide">
                        <button
                            type="button"
                            onClick={() => toggleCategory(category.id)}
                            aria-expanded={openCategory === category.id}
                            className="w-full flex items-center gap-2 mb-3 text-left px-4 py-3 rounded-xl bg-white border border-gray-100
                                       hover:border-mentamind-300 transition-colors focus:outline-none focus:ring-4 focus:ring-mentamind-200"
                        >
                            <span className="text-lg">{categoryIcons[category.id] || '📋'}</span>
                            <div className="flex-1 min-w-0">
                                <h2 className="font-semibold text-gray-800">{category.name}</h2>
                                <p className="text-xs text-gray-400">{category.description}</p>
                            </div>
                            <span className="text-[11px] text-gray-400 flex-shrink-0">{category.tests.length}</span>
                            <svg
                                className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openCategory === category.id ? 'rotate-180' : ''}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {openCategory === category.id && (
                        <div className="space-y-2">
                            {category.tests.map((test) => (
                                <button
                                    key={test.id}
                                    onClick={() => onSelectTest(test.id)}
                                    className="w-full text-left px-4 py-3.5 rounded-xl bg-white border border-gray-100
                                               hover:border-mentamind-300 hover:shadow-sm transition-all duration-200
                                               focus:outline-none focus:ring-4 focus:ring-mentamind-200 group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-gray-800 group-hover:text-mentamind-700 transition-colors truncate">
                                                    {test.title}
                                                </p>
                                                {test.tags.includes('quick') && (
                                                    <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                        Quick
                                                    </span>
                                                )}
                                                {test.tags.includes('recommended') && (
                                                    <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100">
                                                        ★
                                                    </span>
                                                )}
                                                {test.tags.includes('safety') && (
                                                    <span className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                                                        Safety
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-400 mt-0.5 truncate">
                                                {test.purpose}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                            <div className="text-right">
                                                <p className="text-xs text-gray-400">{test.time}</p>
                                                <p className="text-[10px] text-gray-300">{test.questions} Qs</p>
                                            </div>
                                            <svg className="w-4 h-4 text-gray-300 group-hover:text-mentamind-500 transition-colors"
                                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        )}
                    </section>
                ))}

                {/* Footer disclaimer */}
                <div className="pt-4 pb-8 text-center">
                    <p className="text-xs text-gray-400 max-w-sm mx-auto">
                        All screenings use clinically validated tools. Results are for self-awareness only — not a diagnosis.
                    </p>
                </div>
            </main>
        </div>
    );
};

export default TestBrowser;
