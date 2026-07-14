import React from "react";
import { Label } from "./Label";

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
}

export function FormField({
  id,
  label,
  error,
  required,
  className = "",
  children,
}: FormFieldProps) {
  const errorId = `${id}-error`;

  const enhanced = React.cloneElement(children, {
    id,
    "aria-describedby": error ? errorId : undefined,
    "aria-invalid": error ? ("true" as const) : undefined,
    // Signal the error state to Input without hard-wiring its internals.
    ...(error !== undefined && { hasError: !!error }),
  } as Partial<React.HTMLAttributes<HTMLElement>> & { hasError?: boolean });

  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {enhanced}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
