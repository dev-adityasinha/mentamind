import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { QuestionScreen } from './QuestionScreen';
import { ProgressBar } from './ProgressBar';
import { GentleResultsPage } from './GentleResultsPage';
import { useAutosave } from '@/lib/screening/hooks/useAutosave';
import { useSessionHistory } from '@/lib/screening/hooks/useSessionHistory';
import { getScorer } from '@/lib/screening/scoring/registry';
import { getTestData } from '@/lib/screening/data/test-loader';
import { getHelpText } from '@/lib/screening/data/help-text';
import { ScoreResult } from '@/lib/screening/types/schema';

type ScreenState = 'intro' | 'questions' | 'results';

interface GenericTestRunnerProps {
    testId: string;
    onBack: () => void;
    onHome: () => void;
}

export const GenericTestRunner: React.FC<GenericTestRunnerProps> = ({ testId, onBack, onHome }) => {
    const testData = useMemo(() => getTestData(testId), [testId]);
    const scorer = useMemo(() => getScorer(testId), [testId]);

    const [screen, setScreen] = useState<ScreenState>('intro');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<(number | null)[]>(
        new Array(testData.questions.length).fill(null)
    );
    const [result, setResult] = useState<ScoreResult | null>(null);

    const { save, load, clear } = useAutosave();
    const { addEntry, getHistoryForTest } = useSessionHistory();

    useEffect(() => {
        const saved = load(testId);
        if (saved) {
            setAnswers(saved.answers);
            setCurrentIndex(saved.currentIndex);
            if (saved.answers.some((a: number | null) => a !== null)) {
                setScreen('questions');
            }
        }
    }, [testId, load]);

    useEffect(() => {
        if (screen === 'questions') {
            save({
                testId,
                answers,
                currentIndex,
                startedAt: new Date().toISOString(),
            });
        }
    }, [answers, currentIndex, screen, save, testId]);

    const currentQuestion = useMemo(
        () => testData.questions[currentIndex],
        [currentIndex, testData]
    );

    const handleAnswer = useCallback((value: number) => {
        setAnswers((prev) => {
            const next = [...prev];
            next[currentIndex] = value;
            return next;
        });
    }, [currentIndex]);

    const handleNext = useCallback(() => {
        if (currentIndex < testData.questions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
        } else {
            const numericAnswers = answers as number[];
            const scoreResult = scorer(numericAnswers);
            setResult(scoreResult);
            setScreen('results');
            clear(testId);
            addEntry({
                testId,
                testTitle: testData.title || testData.shortTitle || testId,
                totalScore: scoreResult.totalScore,
                maxScore: testData.scoring?.maxScore ?? testData.scoring?.range?.max ?? 0,
                band: scoreResult.band,
            });
        }
    }, [currentIndex, answers, clear, testId, testData, scorer, addEntry]);

    const handlePrevious = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
        }
    }, [currentIndex]);

    const handleRetake = useCallback(() => {
        setAnswers(new Array(testData.questions.length).fill(null));
        setCurrentIndex(0);
        setResult(null);
        setScreen('intro');
    }, [testData]);

    const friendlyTitle = testData.title || testData.shortTitle || testId;
    const timeFrame = testData.timeFrame || testData.timeframe || '';
    const description = testData.description || testData.instruction || '';
    const disclaimer = testData.non_diagnostic_disclaimer || testData.safetyNotes?.[0]
        || 'This is a screening tool, not a diagnosis.';

    if (screen === 'intro') {
        return (
            <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
                <div className="fixed top-6 left-6">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-xl bg-surface/80 border border-border flex items-center justify-center
                                   hover:bg-surface-raised transition-colors focus:outline-none focus:ring-4 focus:ring-focus"
                        aria-label="Go back"
                    >
                        <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                </div>

                <div className="max-w-md w-full text-center animate-fade-slide">
                    <div className="w-16 h-16 bg-brand-subtle rounded-2xl flex items-center justify-center mx-auto mb-6 animate-breathe">
                        <svg className="w-8 h-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>

                    <h1 className="text-3xl font-bold text-text-primary mb-3">
                        {friendlyTitle}
                    </h1>

                    {timeFrame && (
                        <p className="text-text-secondary mb-2 text-sm">
                            {timeFrame} \u2022 {testData.questions.length} questions
                        </p>
                    )}

                    <p className="text-text-secondary leading-relaxed mb-8">
                        {description}
                    </p>

                    <div className="bg-destructive-subtle border border-destructive-subtle rounded-xl p-4 mb-8 text-left">
                        <p className="text-sm text-destructive">
                            {disclaimer}
                        </p>
                    </div>

                    <button
                        onClick={() => setScreen('questions')}
                        className="w-full px-6 py-4 rounded-2xl font-semibold text-brand-foreground text-lg
                               bg-brand hover:bg-brand-hover shadow-lg shadow-brand/20
                               transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-focus min-h-[56px]
                               active:scale-[0.98]"
                        autoFocus
                    >
                        Begin
                    </button>
                </div>
            </div>
        );
    }

    if (screen === 'questions' && currentQuestion) {
        return (
            <div>
                <div className="fixed top-0 left-0 right-0 z-10 bg-surface/80 backdrop-blur-sm border-b border-border px-6 py-3">
                    <ProgressBar
                        current={currentIndex + 1}
                        total={testData.questions.length}
                        testTitle={friendlyTitle}
                    />
                </div>
                <div className="pt-16">
                    <QuestionScreen
                        question={currentQuestion}
                        questionNumber={currentIndex + 1}
                        totalQuestions={testData.questions.length}
                        selectedValue={answers[currentIndex]}
                        onAnswer={handleAnswer}
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                        isFirst={currentIndex === 0}
                        isLast={currentIndex === testData.questions.length - 1}
                        testTitle={friendlyTitle}
                        helpText={getHelpText(testId, currentQuestion.id)?.helpText}
                        whyText={getHelpText(testId, currentQuestion.id)?.whyText}
                        helpExample={getHelpText(testId, currentQuestion.id)?.example}
                    />
                </div>
            </div>
        );
    }

    if (screen === 'results' && result) {
        return (
            <GentleResultsPage
                testId={testId}
                testTitle={friendlyTitle}
                result={result}
                testData={testData}
                onRetake={handleRetake}
                onHome={onHome}
            />
        );
    }

    return null;
};

export default GenericTestRunner;
