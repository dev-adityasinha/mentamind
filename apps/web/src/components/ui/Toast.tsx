"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useReducer,
} from "react";

export type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

type Action =
  | { type: "ADD"; toast: Toast }
  | { type: "REMOVE"; id: string };

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case "ADD":
      return [...state, action.toast];
    case "REMOVE":
      return state.filter((t) => t.id !== action.id);
  }
}

const variantStyles: Record<ToastVariant, string> = {
  success: "bg-success-subtle border-success text-text-primary",
  error: "bg-destructive-subtle border-destructive text-text-primary",
  info: "bg-brand-subtle border-brand text-text-primary",
};

const variantIcons: Record<ToastVariant, string> = {
  success: "text-success",
  error: "text-destructive",
  info: "text-brand",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "flex items-start gap-3 w-80 rounded-lg border px-4 py-3 shadow-md",
        "transition-all duration-300",
        variantStyles[toast.variant],
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={["text-sm font-bold mt-0.5", variantIcons[toast.variant]].join(
          " ",
        )}
      >
        {toast.variant === "success" ? "+" : toast.variant === "error" ? "!" : "i"}
      </span>
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="text-text-muted hover:text-text-primary transition-colors"
      >
        x
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);
  const uid = useId();
  const counterRef = React.useRef(0);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      counterRef.current += 1;
      dispatch({
        type: "ADD",
        toast: { id: `${uid}-${counterRef.current}`, message, variant },
      });
    },
    [uid],
  );

  const dismiss = useCallback((id: string) => {
    dispatch({ type: "REMOVE", id });
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
