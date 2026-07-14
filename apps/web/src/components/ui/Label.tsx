import React from "react";

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ required, className = "", children, ...props }: LabelProps) {
  return (
    <label
      {...props}
      className={[
        "block text-sm font-medium text-text-primary mb-1",
        className,
      ].join(" ")}
    >
      {children}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-destructive">
          *
        </span>
      )}
    </label>
  );
}
