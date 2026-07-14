import React, { useState, useRef, useEffect } from 'react';

interface HelpTooltipProps {
    helpText?: string;
    whyText?: string;
    example?: string;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({ helpText, whyText, example }) => {
    const [isOpen, setIsOpen] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleOutside = (e: MouseEvent) => {
            if (
                tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen]);

    if (!helpText && !whyText && !example) return null;

    return (
        <div className="relative inline-flex">
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="w-7 h-7 rounded-full bg-brand-subtle border border-brand-subtle
                           flex items-center justify-center text-brand
                           hover:bg-brand-subtle hover:text-brand-hover
                           transition-colors focus:outline-none focus:ring-2 focus:ring-focus"
                aria-label="Learn more about this question"
                aria-expanded={isOpen}
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>

            {isOpen && (
                <div
                    ref={tooltipRef}
                    role="tooltip"
                    className="absolute left-0 top-full mt-2 z-50 w-72 sm:w-80
                               bg-surface rounded-2xl shadow-xl border border-border
                               p-4 animate-scale-in"
                >
                    <div className="absolute -top-1.5 left-4 w-3 h-3 bg-surface border-l border-t border-border transform rotate-45" />

                    {helpText && (
                        <div className="mb-3">
                            <p className="text-xs font-medium text-brand uppercase tracking-wide mb-1">
                                What this means
                            </p>
                            <p className="text-sm text-text-secondary leading-relaxed">{helpText}</p>
                        </div>
                    )}

                    {whyText && (
                        <div className="mb-3">
                            <p className="text-xs font-medium text-brand uppercase tracking-wide mb-1">
                                Why we ask this
                            </p>
                            <p className="text-sm text-text-secondary leading-relaxed">{whyText}</p>
                        </div>
                    )}

                    {example && (
                        <div className="bg-surface-raised rounded-xl p-3">
                            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                                For example
                            </p>
                            <p className="text-sm text-text-secondary italic leading-relaxed">{example}</p>
                        </div>
                    )}

                    <button
                        onClick={() => setIsOpen(false)}
                        className="mt-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
                    >
                        Got it \u2713
                    </button>
                </div>
            )}
        </div>
    );
};

export default HelpTooltip;
