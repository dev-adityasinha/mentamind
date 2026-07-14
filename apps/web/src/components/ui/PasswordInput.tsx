import React, { useState } from "react";
import { Input } from "./Input";

interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(function PasswordInput({ hasError, className = "", ...props }, forwardedRef) {
  const [visible, setVisible] = useState(false);
  const internalRef = React.useRef<HTMLInputElement | null>(null);

  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef]
  );

  return (
    <div className="relative">
      <Input
        ref={setRefs}
        {...props}
        type={visible ? "text" : "password"}
        hasError={hasError}
        className={["pr-10", className].join(" ").trim()}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onMouseDown={(e) => {
          e.preventDefault(); // Prevent focus loss
        }}
        onClick={() => {
          setVisible((v) => !v);
          if (internalRef.current) {
            const len = internalRef.current.value.length;
            // Restore cursor to the end after type change
            requestAnimationFrame(() => {
              internalRef.current?.setSelectionRange(len, len);
            });
          }
        }}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-r-md transition-colors"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
});

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.636-7 10-7 10 7 10 7-3.636 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-6.364 0-10-7-10-7a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c6.364 0 10 7 10 7a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
