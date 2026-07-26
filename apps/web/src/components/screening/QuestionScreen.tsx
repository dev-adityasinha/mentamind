import React, { useCallback } from 'react';
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
    /** Contextual help — "What this means" */
    helpText?: string;
    /** Contextual help — "Why we ask this" */
    whyText?: string;
    /** Contextual help — example */
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
    // Keyboard navigation
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
            className="h-full bg-bg flex flex-col"
            role="main"
            aria-label={`Question ${questionNumber} of ${totalQuestions}`}
            onKeyDown={handleKeyDown}
        >
            {/* Header */}
            <header className="px-6 pt-4 pb-3 shrink-0">
                <p className="text-sm font-medium text-mentamind-600 tracking-wide uppercase">
                    {testTitle}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                    Question {questionNumber} of {totalQuestions}
                </p>
            </header>

            {/* Question */}
            <div className="flex-1 min-h-0 flex flex-col px-6 pb-4 max-w-2xl mx-auto w-full">
                <div className="mb-5 mt-2 shrink-0 flex items-start justify-between gap-3">
                    <h2
                        id={`question-${question.id}`}
                        className="flex-1 min-w-0 text-xl sm:text-2xl font-semibold text-gray-800 leading-snug break-words"
                    >
                        {question.text}
                    </h2>
                    {(helpText || whyText || helpExample) && (
                        <div className="shrink-0 mt-1">
                            <HelpTooltip helpText={helpText} whyText={whyText} example={helpExample} />
                        </div>
                    )}
                </div>

                {/* Options — scroll only this region if there are many */}
                <fieldset
                    aria-labelledby={`question-${question.id}`}
                    className="space-y-2 min-h-0 flex-1 overflow-y-auto"
                >
                    <legend className="sr-only">{question.text}</legend>
                    {question.options.map((option, idx) => {
                        const isSelected = selectedValue === option.value;
                        return (
                            <button
                                key={option.value}
                                role="radio"
                                aria-checked={isSelected}
                                tabIndex={0}
                                onClick={() => onAnswer(option.value)}
                                className={`
                  w-full text-left px-4 py-2.5 rounded-xl border-2 transition-all duration-200
                  focus:outline-none focus:ring-4 focus:ring-mentamind-200
                  min-h-[44px] text-sm sm:text-base
                  ${isSelected
                                        ? 'border-mentamind-500 bg-mentamind-50 text-mentamind-800 shadow-md shadow-mentamind-100'
                                        : 'border-gray-200 bg-white text-gray-700 hover:border-mentamind-300 hover:bg-mentamind-50/30'
                                    }
                `}
                            >
                                <span className="flex items-center gap-3">
                                    <span
                                        className={`
                      flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                      ${isSelected ? 'border-mentamind-500 bg-mentamind-500' : 'border-gray-300'}
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

            {/* Navigation */}
            <footer className="px-6 pt-3 pb-4 flex gap-3 max-w-2xl mx-auto w-full shrink-0">
                {!isFirst && (
                    <button
                        onClick={onPrevious}
                        className="px-6 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium
                       hover:bg-gray-50 transition-colors focus:outline-none focus:ring-4 focus:ring-gray-200
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
            focus:outline-none focus:ring-4 focus:ring-mentamind-200 min-h-[48px]
            ${selectedValue !== null
                            ? 'bg-mentamind-600 hover:bg-mentamind-700 shadow-lg shadow-mentamind-200'
                            : 'bg-gray-300 cursor-not-allowed'
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
