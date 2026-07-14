import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-foreground hover:bg-brand-hover focus-visible:ring-brand",
  secondary:
    "bg-surface text-text-primary border border-border hover:bg-surface-raised focus-visible:ring-brand",
  ghost:
    "text-text-primary hover:bg-surface-raised focus-visible:ring-brand",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive-hover focus-visible:ring-destructive",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading}
      className={[
        "inline-flex items-center justify-center rounded-md font-medium",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
