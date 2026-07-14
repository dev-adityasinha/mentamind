import React, { useCallback, useEffect, useRef } from 'react';
import { HelpTooltip } from './HelpTooltip';

interface ResponseOption {
    value: number;
    label: string;
}

interface QuestionData {
    id: string;
    text: string;
    options: ResponseOption[];
}

interface QuestionScreenProps {
    question: QuestionData;
    questionNumber: number;
    totalQuestions: number;
    selectedValue: number | null;
    onAnswer: (value: number) => void;
    onNext: () => void;
    onPrevious: () => void;
    isFirst: boolean;
    isLast: boolean;
    testTitle: string;
    helpText?: string;
    whyText?: string;
    helpExample?: string;
}

export const QuestionScreen: React.FC<QuestionScreenProps> = ({
    question,
    questionNumber,
    totalQuestions,
    selectedValue,
    onAnswer,
    onNext,
    onPrevious,
    isFirst,
    isLast,
    testTitle,
    helpText,
    whyText,
    helpExample,
}) => {
    const firstOptionRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            firstOptionRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, [question.id]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && selectedValue !== null) {
                if (isLast) {
                    onNext();
                } else {
                    onNext();
                }
            }
        },
        [selectedValue, isLast, onNext]
    );

    return (
        <div
            className="min-h-screen bg-bg flex flex-col"
            role="main"
            aria-label={`Question ${questionNumber} of ${totalQuestions}`}
            onKeyDown={handleKeyDown}
        >
            <header className="px-6 pt-8 pb-4">
                <p className="text-sm font-medium text-brand tracking-wide uppercase">
                    {testTitle}
                </p>
                <p className="text-xs text-text-muted mt-1">
                    Question {questionNumber} of {totalQuestions}
                </p>
            </header>

            <div className="flex-1 flex flex-col justify-center px-6 pb-8 max-w-2xl mx-auto w-full">
                <div className="mb-10">
                    <h2
                        id={`question-${question.id}`}
                        className="text-2xl sm:text-3xl font-semibold text-text-primary leading-snug"
                    >
                        {question.text}
                    </h2>
                    {(helpText || whyText || helpExample) && (
                        <div className="mt-3">
                            <HelpTooltip helpText={helpText} whyText={whyText} example={helpExample} />
                        </div>
                    )}
                </div>

                <fieldset
                    aria-labelledby={`question-${question.id}`}
                    className="space-y-3"
                >
                    <legend className="sr-only">{question.text}</legend>
                    {question.options.map((option, idx) => {
                        const isSelected = selectedValue === option.value;
                        return (
                            <button
                                key={option.value}
                                ref={idx === 0 ? firstOptionRef : undefined}
                                role="radio"
                                aria-checked={isSelected}
                                tabIndex={0}
                                onClick={() => onAnswer(option.value)}
                                className={`
                  w-full text-left px-5 py-4 rounded-2xl border-2 transition-all duration-200
                  focus:outline-none focus:ring-4 focus:ring-focus
                  min-h-[56px] text-base sm:text-lg
                  ${isSelected
                                        ? 'border-brand bg-brand-subtle text-brand shadow-md shadow-brand/10'
                                        : 'border-border bg-surface text-text-primary hover:border-brand-hover hover:bg-brand-subtle'
                                    }
                `}
                            >
                                <span className="flex items-center gap-3">
                                    <span
                                        className={`
                      flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                      ${isSelected ? 'border-brand bg-brand' : 'border-border-strong'}
                    `}
                                    >
                                        {isSelected && (
                                            <span className="w-2.5 h-2.5 rounded-full bg-white" />
                                        )}
                                    </span>
                                    <span>{option.label}</span>
                                </span>
                            </button>
                        );
                    })}
                </fieldset>
            </div>

            <footer className="px-6 pb-8 flex gap-3 max-w-2xl mx-auto w-full">
                {!isFirst && (
                    <button
                        onClick={onPrevious}
                        className="px-6 py-3 rounded-xl border-2 border-border text-text-secondary font-medium
                       hover:bg-surface-raised transition-colors focus:outline-none focus:ring-4 focus:ring-focus
                       min-h-[48px]"
                        aria-label="Go to previous question"
                    >
                        Back
                    </button>
                )}
                <button
                    onClick={onNext}
                    disabled={selectedValue === null}
                    className={`
            flex-1 px-6 py-3 rounded-xl font-semibold text-white transition-all
            focus:outline-none focus:ring-4 focus:ring-focus min-h-[48px]
            ${selectedValue !== null
                            ? 'bg-brand hover:bg-brand-hover shadow-lg shadow-brand/20'
                            : 'bg-border-strong cursor-not-allowed'
                        }
          `}
                    aria-label={isLast ? 'Submit answers' : 'Go to next question'}
                >
                    {isLast ? 'See Results' : 'Continue'}
                </button>
            </footer>
        </div>
    );
};

export default QuestionScreen;
