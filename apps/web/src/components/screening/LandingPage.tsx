import React from 'react';

interface LandingPageProps {
    onStart: () => void;
    onBrowseAll: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart, onBrowseAll }) => {
    return (
        <div className="min-h-screen bg-bg flex flex-col">
            {/* Header */}
            <header className="px-6 pt-6 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-brand-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                    </div>
                    <span className="font-bold text-lg text-text-primary">Mentamind</span>
                </div>
                <a
                    href="https://mentamind.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand hover:text-brand-hover font-medium transition-colors"
                >
                    mentamind.in
                </a>
            </header>

            {/* Hero */}
            <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <div className="max-w-lg w-full animate-fade-slide">
                    {/* Floating illustration */}
                    <div className="animate-float mb-8">
                        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-brand-subtle via-emerald-100 to-teal-100 rounded-3xl flex items-center justify-center shadow-lg shadow-black/5">
                            <svg className="w-12 h-12 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                        </div>
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-bold text-text-primary mb-4 leading-tight">
                        How are you <span className="text-brand">feeling</span>?
                    </h1>

                    <p className="text-lg text-text-secondary mb-3 leading-relaxed">
                        Take a moment to check in with yourself.
                        This is a safe, calm space — no judgments, no diagnoses.
                    </p>

                    <p className="text-sm text-text-muted mb-10">
                        Your answers stay private and are never shared.
                    </p>

                    {/* CTA buttons */}
                    <div className="space-y-3">
                        <button
                            onClick={onStart}
                            className="w-full px-6 py-4 rounded-2xl font-semibold text-brand-foreground text-lg
                               bg-brand hover:bg-brand-hover shadow-lg shadow-black/10
                               transition-all duration-300 hover:shadow-xl hover:shadow-black/15
                               focus:outline-none focus:ring-4 focus:ring-brand-subtle min-h-[56px]
                               active:scale-[0.98]"
                            autoFocus
                        >
                            Let&apos;s check in
                        </button>

                        <button
                            onClick={onBrowseAll}
                            className="w-full px-6 py-3 rounded-2xl font-medium text-brand
                               bg-brand-subtle hover:bg-surface-raised border border-border
                               transition-all duration-200
                               focus:outline-none focus:ring-4 focus:ring-brand-subtle min-h-[48px]"
                        >
                            Browse all screenings
                        </button>
                    </div>
                </div>

                {/* Trust badges */}
                <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-text-muted animate-fade-in" style={{ animationDelay: '0.5s' }}>
                    <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Clinically validated tools
                    </span>
                    <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        100% private
                    </span>
                    <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        No time pressure
                    </span>
                </div>
            </main>

            {/* Disclaimer footer */}
            <footer className="px-6 pb-6 text-center">
                <p className="text-xs text-text-muted max-w-md mx-auto">
                    This is a screening tool, not a diagnosis. Results help you understand
                    patterns and decide if professional support might be helpful.
                </p>
            </footer>
        </div>
    );
};

export default LandingPage;
