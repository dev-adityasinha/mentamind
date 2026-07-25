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
    value,
    onChange,
  }: {
    label: string;
    value: number | null;
    onChange: (n: number) => void;
  }) => (
    <div>
      <p className="mb-2 text-sm text-text-secondary">{label}</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={`h-10 w-10 rounded-full border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              value === n
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm text-text-muted">Daily check-in</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">How are you?</h1>
      </div>

      {/* Mood */}
      <div>
        <p className="mb-2 text-sm text-text-secondary">Your mood</p>
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

      {/* Emotions */}
      <div>
        <p className="mb-2 text-sm text-text-secondary">What best describes it? (optional)</p>
        <div className="flex flex-wrap gap-2">
          {EMOTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleEmotion(tag)}
              aria-pressed={emotions.includes(tag)}
              className={`rounded-full border px-3 py-1 text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                emotions.includes(tag)
                  ? "border-brand bg-brand-subtle text-brand"
                  : "border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <Scale label="Energy (optional)" value={energy} onChange={setEnergy} />
      <Scale label="Stress (optional)" value={stress} onChange={setStress} />

      <div>
        <label htmlFor="mood-note" className="mb-2 block text-sm text-text-secondary">
          Anything on your mind? (optional)
        </label>
        <textarea
          id="mood-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="A few words…"
          className="w-full resize-none rounded-2xl border border-border bg-surface p-4 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || mood == null}
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-brand-foreground hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {saving ? "Saving…" : "Save check-in"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/meditation")}
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
