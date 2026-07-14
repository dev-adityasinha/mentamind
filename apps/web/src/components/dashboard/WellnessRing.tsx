import React from "react";

interface WellnessRingProps {
  score: number | null;
  size?: number;
  strokeWidth?: number;
}

export function WellnessRing({ score, size = 160, strokeWidth = 12 }: WellnessRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  const displayScore = score ?? 0;
  const offset = circumference - (displayScore / 100) * circumference;

  let color = "text-success";
  if (score === null) color = "text-text-muted";
  else if (score < 40) color = "text-destructive";
  else if (score < 70) color = "text-amber-500"; // fallback tailwind color

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-raised"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={score === null ? circumference : offset}
          strokeLinecap="round"
          className={`${color} transition-all duration-1000 ease-out`}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-text-primary">
          {score === null ? "-" : score}
        </span>
        <span className="text-sm text-text-muted">Wellness</span>
      </div>
    </div>
  );
}
