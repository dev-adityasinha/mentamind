"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getJourney,
  getCurriculum,
  getCompletions,
  type Journey,
  type CurriculumDay,
  type DailyCompletion,
} from "@/lib/api/mindful";

type DayStatus = "complete" | "partial" | "current" | "upcoming";

export default function MeditationJourneyPage() {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [days, setDays] = useState<CurriculumDay[]>([]);
  const [completions, setCompletions] = useState<DailyCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [j, cur, comp] = await Promise.all([
          getJourney(),
          getCurriculum(),
          getCompletions(),
        ]);
        if (!active) return;
        setJourney(j);
        setDays(cur);
        setCompletions(comp);
      } catch {
        if (active) setError("Could not load the journey. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="text-text-muted">Loading the journey…</div>;
  if (error || !journey) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-text-secondary">
        {error ?? "No content available yet."}
      </div>
    );
  }

  // Map completions by day for status lookup.
  const compByDay = new Map<number, DailyCompletion>();
  for (const c of completions) compByDay.set(c.day, c);

  const statusFor = (dayNum: number): DayStatus => {
    const c = compByDay.get(dayNum);
    const done = c ? [c.meditation, c.reflection, c.task].filter(Boolean).length : 0;
    if (done === 3) return "complete";
    if (dayNum === journey.current_day) return "current";
    if (done > 0) return "partial";
    return "upcoming";
  };

  const tileClass = (s: DayStatus) => {
    switch (s) {
      case "complete":
        return "border-brand bg-brand text-brand-foreground";
      case "current":
        return "border-brand bg-brand-subtle text-brand ring-2 ring-brand/40";
      case "partial":
        return "border-border-strong bg-surface-raised text-text-primary";
      default:
        return "border-border bg-surface text-text-muted hover:border-border-strong";
    }
  };

  // Group days by block.
  const byBlock = new Map<number, CurriculumDay[]>();
  for (const d of days) {
    const arr = byBlock.get(d.block) ?? [];
    arr.push(d);
    byBlock.set(d.block, arr);
  }

  const overallPct =
    journey.total_days > 0
      ? Math.round((journey.completed_days / journey.total_days) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-text-muted">30-day program</p>
          <h1 className="text-2xl font-semibold text-text-primary">Your journey</h1>
        </div>
        <span className="rounded-full border border-border bg-surface-raised px-3 py-1 text-sm text-text-secondary">
          Day {journey.current_day}/{journey.total_days}
        </span>
      </div>

      {/* Overall progress */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-text-secondary">Overall progress</span>
          <span className="font-medium text-text-primary">{overallPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      {/* Blocks */}
      {journey.blocks.map((b) => {
        const blockDays = (byBlock.get(b.block) ?? []).sort((x, y) => x.day - y.day);
        const pct = b.total_days > 0 ? Math.round((b.completed_days / b.total_days) * 100) : 0;
        return (
          <div key={b.block} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Block {b.block} — {b.name}
                </h2>
                <p className="text-sm text-text-muted">
                  {b.completed_days}/{b.total_days} days
                </p>
              </div>
              <span className="text-sm font-medium text-text-secondary">{pct}%</span>
            </div>
            <div className="my-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {blockDays.map((d) => {
                const s = statusFor(d.day);
                return (
                  <Link
                    key={d.day}
                    href={`/meditation/day/${d.day}`}
                    title={d.title}
                    aria-label={`Day ${d.day}: ${d.title}`}
                    className={`flex aspect-square items-center justify-center rounded-xl border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${tileClass(s)}`}
                  >
                    {s === "complete" ? "✓" : d.day}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
