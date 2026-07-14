"use client";

interface MiniTrendProps {
  data: { score: number }[];
  maxScore: number;
}

export function MiniTrend({ data, maxScore }: MiniTrendProps) {
  if (data.length < 2) return null;

  const points = data.map((d, i) => ({
    x: i,
    y: maxScore > 0 ? 1 - d.score / maxScore : 0.5,
  }));
  const w = 80;
  const h = 28;
  const stepX = points.length > 1 ? w / (points.length - 1) : w;

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${i * stepX},${p.y * h}`)
    .join(" ");

  const isDownward = data[data.length - 1].score < data[0].score;
  const strokeColor = isDownward ? "var(--color-success, #22c55e)" : "var(--color-destructive, #ef4444)";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
