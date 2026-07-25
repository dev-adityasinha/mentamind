"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getCurriculumDay,
  getCompletion,
  markCompletion,
  type CurriculumDay,
} from "@/lib/api/mindful";

function TaskInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dayParam = searchParams.get("day");

  const [content, setContent] = useState<CurriculumDay | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const day = content?.day ?? (dayParam ? parseInt(dayParam, 10) : 1);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = dayParam ? parseInt(dayParam, 10) : 1;
        const target = Number.isFinite(d) && d > 0 ? d : 1;
        const [c, comp] = await Promise.all([
          getCurriculumDay(target),
          getCompletion(target),
        ]);
        if (!active) return;
        setContent(c);
        setDone(!!comp?.task);
      } catch {
        if (active) setError("Could not load the task.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [dayParam]);

  async function complete() {
    if (saving || done) return;
    setSaving(true);
    try {
      await markCompletion({ day, task: true });
      setDone(true);
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-text-muted">Loading…</div>;
  if (error || !content) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-text-secondary">
        {error ?? "Task not available."}
      </div>
    );
  }

  const t = content.task;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm text-text-muted">Day {day} task</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">{t?.title ?? "Mindful task"}</h1>
        {t?.subtitle && <p className="mt-1 text-text-secondary">{t.subtitle}</p>}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <span className="inline-flex items-center rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-text-secondary">
          Lifestyle task
        </span>
        {t?.description && (
          <p className="mt-4 text-text-secondary">{t.description}</p>
        )}
        <p className="mt-4 text-sm text-text-muted">
          {t?.duration && t.duration > 0 ? `${t.duration} minutes` : "All-day practice"}
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={complete}
          disabled={done || saving}
          className={`rounded-full px-6 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
            done
              ? "cursor-not-allowed bg-surface-raised text-text-muted"
              : "bg-brand text-brand-foreground hover:bg-brand-hover"
          }`}
        >
          {done ? "Completed ✓" : saving ? "Saving…" : "Mark as complete"}
        </button>
        <button
          type="button"
          onClick={() => (dayParam ? router.push(`/meditation/day/${day}`) : router.push("/meditation"))}
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          Back
        </button>
      </div>
    </div>
  );
}

export default function MeditationTaskPage() {
  return (
    <Suspense fallback={<div className="text-text-muted">Loading…</div>}>
      <TaskInner />
    </Suspense>
  );
}
