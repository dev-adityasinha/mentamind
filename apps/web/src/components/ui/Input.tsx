import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ hasError = false, className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={[
          "flex h-10 w-full rounded-md border bg-surface px-3 py-2",
          "text-sm text-text-primary placeholder:text-text-muted",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          hasError
            ? "border-destructive focus-visible:ring-destructive"
            : "border-border focus-visible:border-brand",
          className,
        ].join(" ")}
      />
    );
  },
);
