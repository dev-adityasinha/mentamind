import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className = "", children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={[
        "rounded-xl border border-border bg-surface shadow-sm backdrop-blur-md glass-shimmer",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
