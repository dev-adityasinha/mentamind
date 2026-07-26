"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitMoodLog } from "@/lib/api/mood";

const MOODS = [
  { score: 5, label: "Great", emoji: "😊" },
  { score: 4, label: "Good", emoji: "🙂" },
  { score: 3, label: "Okay", emoji: "😐" },
  { score: 2, label: "Low", emoji: "😔" },
  { score: 1, label: "Hard", emoji: "😞" },
];

// Must match the backend ALLOWED_EMOTION_TAGS set.
const EMOTIONS = [
  "calm",
  "happy",
  "grateful",
  "hopeful",
  "motivated",
  "proud",
  "excited",
  "tired",
  "anxious",
  "stressed",
  "overwhelmed",
  "sad",
  "lonely",
  "frustrated",
  "irritable",
];

export default function MeditationCheckinPage() {
  const router = useRouter();
  const [mood, setMood] = useState<number | null>(null);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [energy, setEnergy] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleEmotion(tag: string) {
    setEmotions((cur) =>
      cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag],
    );
  }

  async function save() {
    if (saving || mood == null) return;
    setSaving(true);
    try {
      await submitMoodLog({
        mood_score: mood,
        energy_score: energy,
        stress_score: stress,
        emotion_tags: emotions,
        note: note.trim() || undefined,
        input_method: "tap",
      });
      router.push("/meditation");
    } catch {
      setError("Could not save your check-in. Please try again.");
      setSaving(false);
    }
  }

  const Scale = ({
    label,
    lowHint,
    highHint,
    value,
    onChange,
  }: {
    label: string;
    lowHint: string;
    highHint: string;
    value: number | null;
    onChange: (n: number) => void;
  }) => (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-medium text-text-secondary">{label}</p>
        <span className="text-xs text-text-muted">
          {lowHint} · {highHint}
        </span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={`flex h-11 flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              value === n
                ? "border-brand bg-brand text-brand-foreground shadow-sm shadow-brand/25"
                : "border-border bg-surface text-text-secondary hover:border-brand/40 hover:text-text-primary"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-xl">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-xl">
        {/* Warm gradient header accent */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand/10 to-transparent" />

        <div className="relative space-y-8 p-6 sm:p-8">
          {/* Header */}
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">
              Daily check-in
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-primary">
              How are you?
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              A quick moment to notice how you feel today.
            </p>
          </div>

          {/* Mood */}
          <div className="rounded-2xl border border-border bg-surface-raised/40 p-5">
            <p className="mb-4 text-sm font-medium text-text-secondary">Your mood</p>
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

          {/* Emotions */}
          <div>
            <p className="mb-3 text-sm font-medium text-text-secondary">
              What best describes it?{" "}
              <span className="font-normal text-text-muted">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleEmotion(tag)}
                  aria-pressed={emotions.includes(tag)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm capitalize transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    emotions.includes(tag)
                      ? "border-brand bg-brand-subtle font-medium text-brand shadow-sm shadow-brand/10"
                      : "border-border text-text-secondary hover:border-brand/40 hover:text-text-primary"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Energy & Stress */}
          <div className="grid gap-6 sm:grid-cols-2">
            <Scale
              label="Energy (optional)"
              lowHint="Drained"
              highHint="Energized"
              value={energy}
              onChange={setEnergy}
            />
            <Scale
              label="Stress (optional)"
              lowHint="Relaxed"
              highHint="Tense"
              value={stress}
              onChange={setStress}
            />
          </div>

          {/* Note */}
          <div>
            <label
              htmlFor="mood-note"
              className="mb-3 block text-sm font-medium text-text-secondary"
            >
              Anything on your mind?{" "}
              <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <textarea
              id="mood-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="A few words…"
              className="w-full resize-none rounded-2xl border border-border bg-surface-raised/40 p-4 text-text-primary placeholder:text-text-muted focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-focus"
            />
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
              onClick={() => router.push("/meditation")}
              className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || mood == null}
              className="rounded-full bg-brand px-7 py-3 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/25 transition-all hover:bg-brand-hover hover:shadow-brand/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {saving ? "Saving…" : "Save check-in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
