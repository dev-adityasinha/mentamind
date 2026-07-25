"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getJourney,
  getCurriculumDay,
  getCompletion,
  type Journey,
  type CurriculumDay,
  type DailyCompletion,
} from "@/lib/api/mindful";

function ActionCard({
  badge,
  title,
  subtitle,
  href,
  cta,
  done,
}: {
  badge: string;
  title: string;
  subtitle: string;
  href: string;
  cta: string;
  done: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
        done
          ? "border-brand/40 bg-brand-subtle"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="inline-flex items-center rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-text-secondary">
          {badge}
        </span>
        {done && (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-brand-foreground text-xs">
            ✓
          </span>
        )}
      </div>
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
        <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand">
        {done ? "Done" : cta}
        <span aria-hidden>→</span>
      </span>
    </Link>
  );
}

export default function MeditationHomePage() {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [day, setDay] = useState<CurriculumDay | null>(null);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const j = await getJourney();
        if (!active) return;
        setJourney(j);
        const [d, c] = await Promise.all([
          getCurriculumDay(j.current_day),
          getCompletion(j.current_day),
        ]);
        if (!active) return;
        setDay(d);
        setCompletion(c);
      } catch {
        if (active) setError("Could not load your journey. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="text-text-muted">Loading your journey…</div>;
  }
  if (error || !journey || !day) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-text-secondary">
        {error ?? "No content available yet."}
      </div>
    );
  }

  const currentDay = journey.current_day;
  const pct =
    journey.total_days > 0
      ? Math.round((journey.completed_days / journey.total_days) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-text-muted">Your journey</p>
          <h1 className="text-2xl font-semibold text-text-primary">
            Day {currentDay} of {journey.total_days}
          </h1>
          <p className="mt-1 text-text-secondary">
            {day.title}
            {day.subtitle ? ` — ${day.subtitle}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-text-muted">Streak</p>
          <p className="text-2xl font-semibold text-brand">{journey.streak}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-text-secondary">Overall progress</span>
          <span className="font-medium text-text-primary">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {journey.completed_days} of {journey.total_days} days completed
        </p>
      </div>

      {/* 3 daily action cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ActionCard
          badge="Meditation"
          title={day.meditation?.title ?? "Guided session"}
          subtitle={`${day.meditation?.duration ?? 10} min`}
          href={`/meditation/session?day=${currentDay}`}
          cta="Start"
          done={!!completion?.meditation}
        />
        <ActionCard
          badge="Reflection"
          title="Daily journal"
          subtitle="Write your thoughts"
          href={`/meditation/journal?day=${currentDay}`}
          cta="Open"
          done={!!completion?.reflection}
        />
        <ActionCard
          badge="Task"
          title={day.task?.title ?? "Mindful task"}
          subtitle={day.task?.subtitle ?? "A small practice"}
          href={`/meditation/task?day=${currentDay}`}
          cta="View"
          done={!!completion?.task}
        />
      </div>

      <div>
        <Link
          href="/meditation/journey"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
        >
          View full journey <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
