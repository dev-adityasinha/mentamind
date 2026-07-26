"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurriculumDay, markCompletion, type CurriculumDay } from "@/lib/api/mindful";
import { createJournalEntry } from "@/lib/api/journal";

const MOODS = [
  { score: 5, label: "Great", emoji: "😊" },
  { score: 4, label: "Good", emoji: "🙂" },
  { score: 3, label: "Okay", emoji: "😐" },
  { score: 2, label: "Low", emoji: "😔" },
  { score: 1, label: "Hard", emoji: "😞" },
];

function JournalInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dayParam = searchParams.get("day");

  const [content, setContent] = useState<CurriculumDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const day = content?.day ?? (dayParam ? parseInt(dayParam, 10) : 1);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = dayParam ? parseInt(dayParam, 10) : 1;
        const c = await getCurriculumDay(Number.isFinite(d) && d > 0 ? d : 1);
        if (active) setContent(c);
      } catch {
        if (active) setError("Could not load the prompt.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [dayParam]);

  async function save() {
    if (saving || !text.trim()) return;
    setSaving(true);
    try {
      await createJournalEntry({
        content: text.trim(),
        entry_type: "text",
        prompt: content?.reflection?.prompt ?? null,
        mood_score: mood,
      });
      await markCompletion({ day, reflection: true });
      if (dayParam) router.push(`/meditation/day/${day}`);
      else router.push("/meditation");
    } catch {
      setError("Could not save. Please try again.");
      setSaving(false);
    }
  }

  if (loading) return <div className="text-text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-xl">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-xl">
        {/* Soft gradient header accent */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand/10 to-transparent" />

        <div className="relative space-y-7 p-6 sm:p-8">
          {/* Header */}
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">
              Day {day} reflection
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-primary">
              Journal
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Take a quiet moment to put your thoughts into words.
            </p>
          </div>

          {/* Prompt */}
          {content?.reflection?.prompt && (
            <div className="rounded-2xl border border-brand/20 bg-brand-subtle/50 p-5">
              <p className="text-base leading-relaxed text-text-primary">
                {content.reflection.prompt}
              </p>
            </div>
          )}

          {/* Mood */}
          <div className="rounded-2xl border border-border bg-surface-raised/40 p-5">
            <p className="mb-4 text-sm font-medium text-text-secondary">
              How are you feeling?
            </p>
            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {MOODS.map((m) => (
                <button
                  key={m.score}
                  type="button"
                  onClick={() => setMood((cur) => (cur === m.score ? null : m.score))}
                  aria-pressed={mood === m.score}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    mood === m.score
                      ? "border-brand bg-brand-subtle shadow-sm shadow-brand/20 -translate-y-0.5"
                      : "border-border bg-surface hover:border-brand/40 hover:-translate-y-0.5"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`text-2xl transition-transform ${
                      mood === m.score ? "scale-110" : ""
                    }`}
                  >
                    {m.emoji}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      mood === m.score ? "text-brand" : "text-text-secondary"
                    }`}
                  >
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Reflection text */}
          <div>
            <label htmlFor="journal-text" className="sr-only">
              Your reflection
            </label>
            <textarea
              id="journal-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              maxLength={2000}
              placeholder="Write your thoughts…"
              className="w-full resize-none rounded-2xl border border-border bg-surface-raised/40 p-4 text-text-primary placeholder:text-text-muted focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-focus"
            />
            <p className="mt-1.5 text-right text-xs text-text-muted">{text.length}/2000</p>
          </div>

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !text.trim()}
              className="rounded-full bg-brand px-7 py-3 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/25 transition-all hover:bg-brand-hover hover:shadow-brand/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {saving ? "Saving…" : "Save reflection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MeditationJournalPage() {
  return (
    <Suspense fallback={<div className="text-text-muted">Loading…</div>}>
      <JournalInner />
    </Suspense>
  );
}
