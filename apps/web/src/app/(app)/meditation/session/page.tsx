"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import confetti from "canvas-confetti";
import {
  getCurriculumDay,
  markCompletion,
  type CurriculumDay,
} from "@/lib/api/mindful";

// Optional ambient background track. If the file is absent the player still
// works (TTS narration + timer only) — audio errors are swallowed.
const AMBIENT_AUDIO_SRC = "/assets/audio/meditation_ambient.mp3";

function fireConfetti() {
  const end = Date.now() + 2500;
  const colors = ["#18181b", "#4b9b87", "#94a3b8", "#e2e8f0"];
  const frame = () => {
    const timeLeft = end - Date.now();
    if (timeLeft <= 0) return;
    const particleCount = 40 * (timeLeft / 2500);
    confetti({ particleCount, angle: 60, spread: 55, origin: { x: 0 }, colors });
    confetti({ particleCount, angle: 120, spread: 55, origin: { x: 1 }, colors });
    setTimeout(frame, 250);
  };
  frame();
}

function fmt(remaining: number): string {
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SessionPlayer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dayParam = searchParams.get("day");

  const [content, setContent] = useState<CurriculumDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [saved, setSaved] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dayNum = content?.day ?? (dayParam ? parseInt(dayParam, 10) : 1);

  // Load the day content (default day 1 if no param).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = dayParam ? parseInt(dayParam, 10) : 1;
        const c = await getCurriculumDay(Number.isFinite(d) && d > 0 ? d : 1);
        if (active) setContent(c);
      } catch {
        if (active) setError("Could not load this session.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [dayParam]);

  const totalSeconds = (durationMin ?? 0) * 60;

  const recordCompletion = useCallback(async () => {
    if (saved || durationMin == null) return;
    setSaved(true);
    try {
      await markCompletion({
        day: dayNum,
        meditation: true,
        meditation_duration: durationMin,
      });
    } catch {
      // Non-fatal: the session still counts locally; surfaced silently.
    }
  }, [saved, durationMin, dayNum]);

  // Timer.
  useEffect(() => {
    if (!playing || durationMin == null) return;
    const id = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= totalSeconds) {
          setPlaying(false);
          setCelebrating(true);
          fireConfetti();
          void recordCompletion();
          return totalSeconds;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, durationMin, totalSeconds, recordCompletion]);

  // TTS narration of the meditation script (intro), once, when play starts.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const script = content?.meditation?.script;
    if (playing && !introDone && script) {
      const u = new SpeechSynthesisUtterance(script);
      u.rate = 0.85;
      u.pitch = 0.95;
      u.onend = () => setIntroDone(true);
      window.speechSynthesis.speak(u);
    }
    if (!playing) {
      window.speechSynthesis.cancel();
    }
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [playing, introDone, content]);

  // Ambient audio: play after intro (or immediately if no script). Errors
  // (missing file, autoplay block) are swallowed so the session still works.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const hasScript = !!content?.meditation?.script;
    const shouldPlay = playing && (introDone || !hasScript);
    if (shouldPlay) {
      el.volume = 0.5;
      const p = el.play();
      if (p) p.catch(() => {});
    } else {
      el.pause();
    }
  }, [playing, introDone, content]);

  // Cleanup on unmount. Snapshot the audio node so the cleanup does not read a
  // ref that may have changed (react-hooks/exhaustive-deps).
  useEffect(() => {
    const el = audioRef.current;
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    };
  }, []);

  function finishBack() {
    // After completing the session, move forward to the day/journey (never
    // back to the player the user just left).
    if (dayParam) router.push(`/meditation/day/${dayNum}`);
    else router.push("/meditation");
  }

  function goBack() {
    // Plain "Back" — return to wherever the user came from (Today,
    // Recommended, Dashboard...), not a hardcoded destination.
    router.back();
  }

  async function markDoneNow() {
    setPlaying(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    await recordCompletion();
    finishBack();
  }

  if (loading) return <div className="text-text-muted">Loading session…</div>;
  if (error || !content) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-text-secondary">
        {error ?? "Session not available."}
      </div>
    );
  }

  const med = content.meditation;
  const fullMin = med?.duration ?? 10;
  const shortMin = med?.shortDuration ?? Math.max(1, Math.round(fullMin / 2));
  const remaining = Math.max(0, totalSeconds - elapsed);
  const pct = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 0;

  // Session length not chosen yet — show the picker.
  if (durationMin == null) {
    return (
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div>
          <p className="text-sm text-text-muted">Day {content.day} meditation</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">{med?.title ?? "Guided session"}</h1>
          {med?.description && (
            <p className="mt-2 text-text-secondary">{med.description}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setDurationMin(fullMin)}
            className="rounded-2xl border border-border bg-surface p-5 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <p className="text-2xl font-semibold text-text-primary">{fullMin}</p>
            <p className="text-sm text-text-muted">minutes</p>
          </button>
          <button
            type="button"
            onClick={() => setDurationMin(shortMin)}
            className="rounded-2xl border border-border bg-surface p-5 hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <p className="text-2xl font-semibold text-text-primary">{shortMin}</p>
            <p className="text-sm text-text-muted">min (short)</p>
          </button>
        </div>
        <button
          type="button"
          onClick={goBack}
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          Back
        </button>
        {/* Preload the audio element so refs are ready once a length is picked. */}
        <audio ref={audioRef} src={AMBIENT_AUDIO_SRC} loop preload="none" />
      </div>
    );
  }

  // Celebration screen.
  if (celebrating) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-10 text-center">
        <div className="text-4xl">🎉</div>
        <h1 className="text-2xl font-semibold text-text-primary">Session complete</h1>
        <p className="text-text-secondary">
          You meditated for {durationMin} minute{durationMin === 1 ? "" : "s"}. Nicely done.
        </p>
        <button
          type="button"
          onClick={finishBack}
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-brand-foreground hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Continue
        </button>
        <audio ref={audioRef} src={AMBIENT_AUDIO_SRC} loop preload="none" />
      </div>
    );
  }

  // Active player.
  return (
    <div className="mx-auto max-w-md space-y-8 py-6 text-center">
      <div>
        <p className="text-sm text-text-muted">Day {content.day}</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">{med?.title ?? "Guided session"}</h1>
      </div>

      {/* Progress ring */}
      <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" strokeWidth="4" className="stroke-surface-raised" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            className="stroke-brand transition-all"
            style={{
              strokeDasharray: 283,
              strokeDashoffset: 283 - (283 * pct) / 100,
            }}
          />
        </svg>
        <div
          className={`flex h-32 w-32 items-center justify-center rounded-full bg-brand-subtle text-3xl font-semibold text-text-primary tabular-nums transition-transform duration-[4000ms] ${
            playing ? "scale-110" : "scale-100"
          }`}
        >
          {fmt(remaining)}
        </div>
      </div>

      {med?.script && (
        <p className="text-sm text-text-muted">
          {playing && !introDone ? "Narrating…" : "Breathe, and follow along."}
        </p>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="rounded-full bg-brand px-8 py-3 text-sm font-medium text-brand-foreground hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {playing ? "Pause" : elapsed > 0 ? "Resume" : "Begin"}
        </button>
        <button
          type="button"
          onClick={markDoneNow}
          className="rounded-full border border-border px-5 py-3 text-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Mark as done
        </button>
      </div>

      <audio ref={audioRef} src={AMBIENT_AUDIO_SRC} loop preload="none" />
    </div>
  );
}

export default function MeditationSessionPage() {
  return (
    <Suspense fallback={<div className="text-text-muted">Loading session…</div>}>
      <SessionPlayer />
    </Suspense>
  );
}
