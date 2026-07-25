"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getCurriculumDay,
  getCompletion,
  markCompletion,
  type CurriculumDay,
  type DailyCompletion,
} from "@/lib/api/mindful";

const TOTAL_DAYS = 30;

export default function MeditationDayPage() {
  const params = useParams<{ dayNum: string }>();
  const dayNum = Math.max(1, Math.min(TOTAL_DAYS, parseInt(params?.dayNum ?? "1", 10) || 1));

  const [content, setContent] = useState<CurriculumDay | null>(null);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [c, comp] = await Promise.all([
          getCurriculumDay(dayNum),
          getCompletion(dayNum),
        ]);
        if (!active) return;
        setContent(c);
        setCompletion(comp);
      } catch {
        if (active) setError("Could not load this day.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [dayNum]);

  async function completeTask() {
    if (saving || completion?.task) return;
    setSaving(true);
    try {
      const updated = await markCompletion({ day: dayNum, task: true });
      setCompletion(updated);
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-text-muted">Loading day…</div>;
  if (error || !content) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-text-secondary">
        {error ?? "Day not found."}
      </div>
    );
  }

  const taskDone = !!completion?.task;
  const medDone = !!completion?.meditation;
  const reflDone = !!completion?.reflection;
  const padded = String(content.day).padStart(2, "0");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/meditation/journey"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <span aria-hidden>←</span> Journey
        </Link>
        <h1 className="truncate text-lg font-semibold text-text-primary">
          Day {padded} • {content.title}
        </h1>
        <span className="w-16" />
      </div>

      {/* Task card */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        <span className="inline-flex items-center rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-text-secondary">
          Lifestyle task
        </span>
        <h2 className="mt-3 text-xl font-semibold text-text-primary">{content.task?.title}</h2>
        {content.task?.subtitle && (
          <p className="mt-1 text-text-secondary">{content.task.subtitle}</p>
        )}
        {content.task?.description && (
          <p className="mt-4 border-t border-border pt-4 text-text-secondary">
            {content.task.description}
          </p>
        )}
        <p className="mt-4 text-sm text-text-muted">
          {content.task?.duration && content.task.duration > 0
            ? `${content.task.duration} minutes`
            : "All-day practice"}
        </p>
        <button
          type="button"
          onClick={completeTask}
          disabled={taskDone || saving}
          className={`mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            taskDone
              ? "cursor-not-allowed bg-surface-raised text-text-muted"
              : "bg-brand text-brand-foreground hover:bg-brand-hover"
          }`}
        >
          {taskDone ? "Completed ✓" : saving ? "Saving…" : "Mark as complete"}
        </button>
      </div>

      {/* Also today */}
      <div className="rounded-2xl border border-border bg-surface p-2">
        <p className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
          Also today
        </p>
        <Link
          href={`/meditation/session?day=${content.day}`}
          className="flex items-center justify-between rounded-xl px-4 py-3 hover:bg-surface-raised"
        >
          <div>
            <p className="font-medium text-text-primary">{content.meditation?.title ?? "Meditation"}</p>
            <p className="text-sm text-text-muted">{content.meditation?.duration ?? 10} min meditation</p>
          </div>
          <span aria-hidden className={medDone ? "text-brand" : "text-text-muted"}>
            {medDone ? "✓" : "→"}
          </span>
        </Link>
        <Link
          href={`/meditation/journal?day=${content.day}`}
          className="flex items-center justify-between rounded-xl px-4 py-3 hover:bg-surface-raised"
        >
          <div>
            <p className="font-medium text-text-primary">Journal</p>
            <p className="line-clamp-1 text-sm text-text-muted">
              {content.reflection?.prompt ?? "Reflect on your day"}
            </p>
          </div>
          <span aria-hidden className={reflDone ? "text-brand" : "text-text-muted"}>
            {reflDone ? "✓" : "→"}
          </span>
        </Link>
      </div>

      {/* Prev / next nav */}
      <div className="flex items-center justify-between">
        {content.day > 1 ? (
          <Link
            href={`/meditation/day/${content.day - 1}`}
            className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            <span aria-hidden>←</span> Day {content.day - 1}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm text-text-muted opacity-50">
            <span aria-hidden>←</span> Day 0
          </span>
        )}
        <Link href="/meditation/journey" className="text-sm text-text-secondary hover:text-text-primary">
          All days
        </Link>
        {content.day < TOTAL_DAYS ? (
          <Link
            href={`/meditation/day/${content.day + 1}`}
            className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            Day {content.day + 1} <span aria-hidden>→</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm text-text-muted opacity-50">
            Day 31 <span aria-hidden>→</span>
          </span>
        )}
      </div>
    </div>
  );
}
