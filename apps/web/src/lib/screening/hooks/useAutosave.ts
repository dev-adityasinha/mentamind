import { useCallback, useEffect, useRef } from 'react';

const STORAGE_PREFIX = 'mentamind_session_';
const AUTOSAVE_INTERVAL_MS = 5000;

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
 * Hook that saves screening session progress to localStorage
 * and optionally POSTs to /api/sessions stub.
 */
export function useAutosave(): UseAutosaveReturn {
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pendingDataRef = useRef<SessionData | null>(null);

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

        // Queue for API POST (debounced)
        pendingDataRef.current = sessionData;
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

    // Periodic API sync
    useEffect(() => {
        timerRef.current = setInterval(async () => {
            if (pendingDataRef.current) {
                try {
                    await fetch('/api/sessions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(pendingDataRef.current),
                    });
                    pendingDataRef.current = null;
                } catch {
                    // Silently fail — localStorage is the primary backup
                }
            }
        }, AUTOSAVE_INTERVAL_MS);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    return { save, load, clear };
}

export default useAutosave;
