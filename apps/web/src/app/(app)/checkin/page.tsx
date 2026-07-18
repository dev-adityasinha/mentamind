"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitMoodLog } from "@/lib/api/mood";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { MicrophoneButton } from "@/components/ui/MicrophoneButton";

const MOODS = [
  { value: 1, label: "Terrible", emoji: "😭", color: "hover:bg-red-50 hover:border-red-200" },
  { value: 2, label: "Bad", emoji: "😔", color: "hover:bg-orange-50 hover:border-orange-200" },
  { value: 3, label: "Okay", emoji: "😐", color: "hover:bg-yellow-50 hover:border-yellow-200" },
  { value: 4, label: "Good", emoji: "🙂", color: "hover:bg-green-50 hover:border-green-200" },
  { value: 5, label: "Great", emoji: "🤩", color: "hover:bg-emerald-50 hover:border-emerald-200" },
];

const EMOTIONS = [
  "Anxious", "Grateful", "Stressed", "Joyful", "Exhausted",
  "Focused", "Overwhelmed", "Calm", "Frustrated", "Motivated"
];

const CONTEXTS = [
  "Workload", "Sleep", "Health", "Relationships",
  "Finances", "Personal Life", "Family", "Commute"
];

const ENERGY_LABELS: Record<number, string> = {
  1: "Drained", 2: "Low", 3: "Steady", 4: "Energised", 5: "Buzzing",
};
const STRESS_LABELS: Record<number, string> = {
  1: "Very calm", 2: "Relaxed", 3: "Neutral", 4: "Tense", 5: "Very stressed",
};

const TOTAL_STEPS = 5;

export default function CheckInPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [score, setScore] = useState<number | null>(null);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [energy, setEnergy] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [context, setContext] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function handleSubmit() {
    if (!score) return;
    setIsSubmitting(true);
    try {
      await submitMoodLog({
        mood_score: score,
        energy_score: energy,
        stress_score: stress,
        emotion_tags: selectedEmotions,
        context_tag: context || undefined,
        note: note || undefined,
        input_method: "tap",
      });
      addToast("Check-in saved successfully!", "success");
      router.push("/home");
      router.refresh();
    } catch (err) {
      addToast("Failed to save check-in. Please try again.", "error");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl py-8">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Daily Check-in</h1>
          <span className="text-sm font-medium text-text-muted">
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>

        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-lg font-medium text-text-primary text-center">
              How are you feeling today?
            </h2>
            <div className="grid grid-cols-5 gap-2 sm:gap-4">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    setScore(m.value);
                    setTimeout(() => setStep(2), 300);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    score === m.value
                      ? "border-brand bg-brand-subtle ring-1 ring-brand scale-105"
                      : `border-border bg-surface ${m.color} scale-100`
                  }`}
                >
                  <span className="text-3xl sm:text-4xl">{m.emoji}</span>
                  <span className="text-xs sm:text-sm font-medium text-text-secondary">
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-end">
              <Button variant="primary" disabled={!score} onClick={() => setStep(2)}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-lg font-medium text-text-primary text-center">
              What emotions are you experiencing?
            </h2>
            <p className="text-center text-sm text-text-muted mt-1">Select all that apply</p>
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              {EMOTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    if (selectedEmotions.includes(e)) {
                      setSelectedEmotions((prev) => prev.filter((tag) => tag !== e));
                    } else {
                      setSelectedEmotions((prev) => [...prev, e]);
                    }
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    selectedEmotions.includes(e)
                      ? "border-brand bg-brand-subtle text-brand"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-raised"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button variant="primary" onClick={() => setStep(3)}>
                {selectedEmotions.length > 0 ? "Next" : "Skip"}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div>
              <h2 className="text-lg font-medium text-text-primary text-center">
                How is your energy and stress?
              </h2>
              <p className="text-center text-sm text-text-muted mt-1">
                Rate each from 1 to 5
              </p>
            </div>

            <RatingRow
              label="Energy"
              value={energy}
              onChange={setEnergy}
              labels={ENERGY_LABELS}
            />
            <RatingRow
              label="Stress"
              value={stress}
              onChange={setStress}
              labels={STRESS_LABELS}
            />

            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button variant="primary" onClick={() => setStep(4)}>
                {energy || stress ? "Next" : "Skip"}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-lg font-medium text-text-primary text-center">
              What&apos;s the main context?
            </h2>
            <p className="text-center text-sm text-text-muted mt-1">Choose the primary driver</p>
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              {CONTEXTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setContext(c);
                    setTimeout(() => setStep(5), 300);
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    context === c
                      ? "border-brand bg-brand-subtle text-brand"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-raised"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
              <Button variant="primary" onClick={() => setStep(5)}>
                {context ? "Next" : "Skip"}
              </Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-lg font-medium text-text-primary">
              Anything else you&apos;d like to note?
            </h2>
            <p className="text-sm text-text-muted">
              Your notes are fully encrypted and only visible to you.
            </p>
            <div className="relative">
              <textarea
                className="w-full rounded-md border border-border bg-surface p-3 pr-12 text-sm text-text-primary focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus min-h-[120px] resize-y"
                placeholder="Jot down your thoughts..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="absolute top-2 right-2">
                <MicrophoneButton
                  onTranscript={(text) => setNote((prev) => (prev ? prev + " " + text : text))}
                />
              </div>
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(4)} disabled={isSubmitting}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                disabled={isSubmitting}
              >
                Complete Check-in
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RatingRow({
  label,
  value,
  onChange,
  labels,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  labels: Record<number, string>;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        <span className="text-xs text-text-muted">
          {value ? labels[value] : "Not set"}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${label} ${n}: ${labels[n]}`}
            className={`h-11 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              value === n
                ? "border-brand bg-brand-subtle text-brand"
                : "border-border bg-surface text-text-secondary hover:bg-surface-raised"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
