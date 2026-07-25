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
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm text-text-muted">Day {day} reflection</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Journal</h1>
      </div>

      {content?.reflection?.prompt && (
        <div className="rounded-2xl border border-border bg-surface-raised p-4">
          <p className="text-text-secondary">{content.reflection.prompt}</p>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm text-text-secondary">How are you feeling?</p>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m.score}
              type="button"
              onClick={() => setMood((cur) => (cur === m.score ? null : m.score))}
              aria-pressed={mood === m.score}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                mood === m.score
                  ? "border-brand bg-brand-subtle text-brand"
                  : "border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              <span aria-hidden>{m.emoji}</span> {m.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="journal-text" className="sr-only">Your reflection</label>
        <textarea
          id="journal-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          maxLength={2000}
          placeholder="Write your thoughts…"
          className="w-full resize-none rounded-2xl border border-border bg-surface p-4 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus"
        />
        <p className="mt-1 text-right text-xs text-text-muted">{text.length}/2000</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !text.trim()}
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-brand-foreground hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {saving ? "Saving…" : "Save reflection"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          Cancel
        </button>
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
