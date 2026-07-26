import { useCallback } from 'react';

const STORAGE_PREFIX = 'mentamind_session_';

interface SessionData {
    testId: string;
    answers: (number | null)[];
    currentIndex: number;
    startedAt: string;
    lastSavedAt: string;
}

interface UseAutosaveReturn {
    save: (data: Omit<SessionData, 'lastSavedAt'>) => void;
    load: (testId: string) => SessionData | null;
    clear: (testId: string) => void;
}

/**
 * Hook that saves screening session progress to localStorage.
 */
export function useAutosave(): UseAutosaveReturn {

    const save = useCallback((data: Omit<SessionData, 'lastSavedAt'>) => {
        const sessionData: SessionData = {
            ...data,
            lastSavedAt: new Date().toISOString(),
        };

        // Save to localStorage
        try {
            localStorage.setItem(
                `${STORAGE_PREFIX}${data.testId}`,
                JSON.stringify(sessionData)
            );
        } catch {
            console.warn('Failed to save session to localStorage');
        }
    }, []);

    const load = useCallback((testId: string): SessionData | null => {
        try {
            const raw = localStorage.getItem(`${STORAGE_PREFIX}${testId}`);
            if (raw) {
                return JSON.parse(raw) as SessionData;
            }
        } catch {
            console.warn('Failed to load session from localStorage');
        }
        return null;
    }, []);

    const clear = useCallback((testId: string) => {
        try {
            localStorage.removeItem(`${STORAGE_PREFIX}${testId}`);
        } catch {
            console.warn('Failed to clear session from localStorage');
        }
    }, []);

    return { save, load, clear };
}

export default useAutosave;
