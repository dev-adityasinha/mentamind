"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getMindfulStats,
  getJourney,
  getCompletions,
  type MindfulStats,
  type Journey,
  type DailyCompletion,
} from "@/lib/api/mindful";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 text-center">
      <p className="text-3xl font-semibold text-text-primary">{value}</p>
      <p className="mt-1 text-sm text-text-muted">{label}</p>
    </div>
  );
}

export default function MeditationDashboardPage() {
  const [stats, setStats] = useState<MindfulStats | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [completions, setCompletions] = useState<DailyCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [s, j, c] = await Promise.all([
          getMindfulStats(),
          getJourney(),
          getCompletions(),
        ]);
        if (!active) return;
        setStats(s);
        setJourney(j);
        setCompletions(c);
      } catch {
        if (active) setError("Could not load your dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="text-text-muted">Loading your dashboard…</div>;
  if (error || !stats || !journey) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-text-secondary">
        {error ?? "No data yet."}
      </div>
    );
  }

  const currentDay = stats.current_day;
  const today = completions.find((c) => c.day === currentDay);

  // Next-step focus: meditation -> task -> reflection -> done.
  let focus: "meditation" | "task" | "reflection" | "complete";
  if (!today?.meditation) focus = "meditation";
  else if (!today?.task) focus = "task";
  else if (!today?.reflection) focus = "reflection";
  else focus = "complete";

  const focusMeta: Record<string, { title: string; href: string; cta: string }> = {
    meditation: {
      title: "Your meditation is waiting",
      href: `/meditation/session?day=${currentDay}`,
      cta: "Start meditation",
    },
    task: {
      title: "Today's task is next",
      href: `/meditation/task?day=${currentDay}`,
      cta: "View task",
    },
    reflection: {
      title: "Time to reflect",
      href: `/meditation/journal?day=${currentDay}`,
      cta: "Open journal",
    },
    complete: {
      title: "Day complete — beautifully done",
      href: "/meditation/journey",
      cta: "View journey",
    },
  };
  const f = focusMeta[focus];

  // Completion status by day for the 30-tile timeline.
  const compByDay = new Map<number, DailyCompletion>();
  for (const c of completions) compByDay.set(c.day, c);

  const tileClass = (dayNum: number) => {
    const c = compByDay.get(dayNum);
    const done = c ? [c.meditation, c.reflection, c.task].filter(Boolean).length : 0;
    if (done === 3) return "border-brand bg-brand text-brand-foreground";
    if (dayNum === currentDay) return "border-brand bg-brand-subtle text-brand";
    if (done > 0) return "border-border-strong bg-surface-raised text-text-primary";
    return "border-border bg-surface text-text-muted";
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-text-muted">Your progress</p>
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
      </div>

      {/* Next-step focus card */}
      <Link
        href={f.href}
        className="flex items-center justify-between rounded-2xl border border-brand/40 bg-brand-subtle p-6 transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <div>
          <p className="text-sm text-brand">Day {currentDay}</p>
          <p className="mt-1 text-lg font-semibold text-text-primary">{f.title}</p>
        </div>
        <span className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground">
          {f.cta}
        </span>
      </Link>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Day streak" value={stats.current_streak} />
        <StatTile label="Minutes" value={stats.total_minutes} />
        <StatTile label="Sessions" value={stats.total_sessions} />
        <StatTile label="Days done" value={`${stats.completed_days}/${stats.total_days}`} />
      </div>

      {/* 30-day timeline */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="mb-3 text-sm text-text-secondary">Your 30 days</p>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
          {Array.from({ length: stats.total_days }, (_, i) => i + 1).map((dayNum) => (
            <Link
              key={dayNum}
              href={`/meditation/day/${dayNum}`}
              aria-label={`Day ${dayNum}`}
              className={`flex aspect-square items-center justify-center rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${tileClass(dayNum)}`}
            >
              {dayNum}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
