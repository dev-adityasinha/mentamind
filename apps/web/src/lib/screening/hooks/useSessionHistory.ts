import { useCallback } from 'react';
import { saveScreeningResult } from '@/lib/api/screening';

const HISTORY_KEY = 'mentamind_history';

export interface TestHistoryEntry {
    testId: string;
    testTitle: string;
    totalScore: number;
    maxScore: number;
    band: string;
    completedAt: string;
}

export interface UseSessionHistoryReturn {
    addEntry: (entry: Omit<TestHistoryEntry, 'completedAt'>) => void;
    getHistory: () => TestHistoryEntry[];
    getHistoryForTest: (testId: string) => TestHistoryEntry[];
    clearHistory: () => void;
}

function getSeverity(band: string): string | null {
    const b = band.toLowerCase();
    if (b.includes('severe') || b.includes('high')) return 'severe';
    if (b.includes('moderate')) return 'moderate';
    if (b.includes('mild')) return 'mild';
    if (b.includes('minimal') || b.includes('none')) return 'minimal';
    return null;
}

export function useSessionHistory(): UseSessionHistoryReturn {
    const getHistory = useCallback((): TestHistoryEntry[] => {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            if (raw) {
                return JSON.parse(raw) as TestHistoryEntry[];
            }
        } catch {
            console.warn('Failed to load session history');
        }
        return [];
    }, []);

    const addEntry = useCallback((entry: Omit<TestHistoryEntry, 'completedAt'>) => {
        const newEntry: TestHistoryEntry = {
            ...entry,
            completedAt: new Date().toISOString(),
        };

        // Save to localStorage for offline/instant access
        try {
            const history = getHistory();
            history.push(newEntry);
            const trimmed = history.slice(-50);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
        } catch {
            console.warn('Failed to save session history');
        }

        // Sync to backend (fire-and-forget, fail gracefully)
        saveScreeningResult({
            test_id: entry.testId,
            score: entry.totalScore,
            max_score: entry.maxScore,
            severity: getSeverity(entry.band),
        }).catch(() => {
            // Silently fail — local history is the source of truth
        });
    }, [getHistory]);

    const getHistoryForTest = useCallback((testId: string): TestHistoryEntry[] => {
        return getHistory().filter(e => e.testId === testId);
    }, [getHistory]);

    const clearHistory = useCallback(() => {
        try {
            localStorage.removeItem(HISTORY_KEY);
        } catch {
            console.warn('Failed to clear session history');
        }
    }, []);

    return { addEntry, getHistory, getHistoryForTest, clearHistory };
}

export default useSessionHistory;
