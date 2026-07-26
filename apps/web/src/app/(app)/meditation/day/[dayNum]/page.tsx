"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getCurriculumDay,
  getCompletion,
  markCompletion,
  type CurriculumDay,
  type DailyCompletion,
} from "@/lib/api/mindful";

const TOTAL_DAYS = 30;

export default function MeditationDayPage() {
  const router = useRouter();
  const params = useParams<{ dayNum: string }>();
  const day = Math.min(
    Math.max(parseInt(params?.dayNum ?? "1", 10) || 1, 1),
    TOTAL_DAYS,
  );

  const [content, setContent] = useState<CurriculumDay | null>(null);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  // Favorites have no backend in Mentamind's /mindful API, so the heart is
  // local UI state — faithful to the original's look and feel without
  // inventing a persistence endpoint.
  const [favorite, setFavorite] = useState(false);
  // Some curriculum tasks point at illustration files that aren't bundled in
  // the app yet, so the <img> 404s. Track a load failure and fall back to the
  // icon illustration instead of showing a broken-image placeholder.
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setImgFailed(false);
    (async () => {
      try {
        const [c, comp] = await Promise.all([
          getCurriculumDay(day),
          getCompletion(day),
        ]);
        if (!active) return;
        setContent(c);
        setCompletion(comp);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [day]);

  const isTaskComplete = completion?.task ?? false;
  const isMeditationComplete = completion?.meditation ?? false;
  const isReflectionComplete = completion?.reflection ?? false;

  const handleCompleteTask = async () => {
    if (isTaskComplete || saving) return;
    setSaving(true);
    try {
      const updated = await markCompletion({ day, task: true });
      setCompletion(updated);
    } catch {
      // no-op; stays incomplete on failure
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-text-muted">Loading day…</div>;
  }

  if (notFound || !content) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-text-secondary">Day not found</p>
      </div>
    );
  }

  const taskDuration = content.task.duration ?? 0;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 pt-8 pb-4">
        <button
          type="button"
          onClick={() => router.push("/meditation/journey")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/50 transition-all hover:bg-white/80 active:scale-95 dark:bg-white/10 dark:hover:bg-white/20"
          aria-label="Back to journey"
        >
          <span className="material-symbols-outlined text-[#111817] dark:text-white">
            arrow_back
          </span>
        </button>
        <h2 className="text-lg font-bold tracking-tight text-[#111817] dark:text-white/90">
          Day {content.day.toString().padStart(2, "0")}{" "}
          <span className="mx-1 text-[#3D6B5B]">•</span> {content.title}
        </h2>
        <button
          type="button"
          onClick={() => setFavorite((f) => !f)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/50 transition-all hover:bg-white/80 active:scale-95 dark:bg-white/10 dark:hover:bg-white/20"
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <span
            className={`material-symbols-outlined ${
              favorite ? "text-red-500" : "text-gray-500 dark:text-white"
            }`}
            style={favorite ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            favorite
          </span>
        </button>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-6 pb-8">
        {/* Main Task Card */}
        <div className="group relative w-full max-w-md transform transition-all duration-500 hover:scale-[1.01]">
          {/* Card shadow */}
          <div className="absolute inset-4 translate-y-4 transform rounded-3xl bg-[#3D6B5B]/20 opacity-40 blur-2xl transition-opacity group-hover:opacity-50 dark:bg-black/40" />

          <div className="relative flex flex-col overflow-hidden rounded-[2rem] bg-white shadow-xl ring-1 ring-black/5 dark:bg-[#151E32] dark:ring-white/10">
            {/* Illustration Section */}
            <div className="relative flex h-64 w-full items-center justify-center overflow-hidden bg-[#F2F7F6] dark:bg-[#0c111c]">
              {content.task.image && !imgFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={content.task.image}
                  alt={content.task.title}
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <>
                  {/* Decorative circles */}
                  <div className="absolute right-0 top-0 h-32 w-32 -translate-y-10 translate-x-10 rounded-full bg-[#3D6B5B]/10 dark:bg-blue-500/10" />
                  <div className="absolute bottom-0 left-0 h-40 w-40 -translate-x-10 translate-y-10 rounded-full bg-[#E2B19F]/20 dark:bg-indigo-500/10" />

                  {/* Icon Illustration */}
                  <div className="relative z-10 flex h-32 w-32 items-center justify-center rounded-full bg-[#3D6B5B]/10 dark:bg-[#3D6B5B]/20">
                    <span className="material-symbols-outlined text-[64px] text-[#3D6B5B]">
                      {content.task.icon ?? "self_improvement"}
                    </span>
                  </div>
                </>
              )}

              {/* Bottom gradient fade */}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent opacity-80 dark:from-[#151E32]" />
            </div>

            {/* Content */}
            <div className="flex flex-col gap-5 px-8 pb-8 pt-2">
              {/* Badge */}
              <div>
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#3D6B5B]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#3D6B5B]">
                  <span className="material-symbols-outlined text-[16px]">footprint</span>
                  <span>Lifestyle Task</span>
                </div>

                <h1 className="text-3xl font-extrabold leading-tight text-[#111817] dark:text-white">
                  {content.task.title}
                </h1>
                {content.task.subtitle && (
                  <p className="mt-2 text-lg font-medium text-[#3D6B5B]">
                    {content.task.subtitle}
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="h-px w-full bg-gray-100 dark:bg-white/10" />

              {/* Description */}
              <p className="text-base leading-relaxed text-gray-600 dark:text-gray-300">
                {content.task.description}
              </p>

              {/* Duration badge */}
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                {taskDuration > 0 ? `${taskDuration} minutes` : "All day practice"}
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleCompleteTask}
                  disabled={isTaskComplete || saving}
                  className={`group/btn relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl py-4 text-white shadow-lg transition-all active:scale-[0.98] ${
                    isTaskComplete
                      ? "cursor-not-allowed bg-gray-400"
                      : "bg-[#3D6B5B] shadow-[#3D6B5B]/25 hover:-translate-y-0.5 hover:shadow-[#3D6B5B]/40"
                  }`}
                >
                  <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover/btn:opacity-100" />
                  <span className="material-symbols-outlined relative z-10">
                    {isTaskComplete ? "check" : "check_circle"}
                  </span>
                  <span className="relative z-10 text-base font-bold">
                    {isTaskComplete ? "Completed!" : saving ? "Saving…" : "Mark as Complete"}
                  </span>
                </button>

                <button
                  type="button"
                  className="w-full text-center text-sm font-medium text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  Remind me later
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Other activities for this day */}
        <div className="mt-6 w-full max-w-md space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Also Today
          </h3>

          {/* Meditation */}
          <button
            type="button"
            onClick={() => router.push(`/meditation/session?day=${day}`)}
            className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition-all active:scale-[0.98] dark:bg-[#151E32]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600">
              <span className="material-symbols-outlined text-white">self_improvement</span>
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-[#111817] dark:text-white">
                {content.meditation.title}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {content.meditation.duration} min meditation
              </p>
            </div>
            {isMeditationComplete ? (
              <span className="material-symbols-outlined text-[#389485]">check_circle</span>
            ) : (
              <span className="material-symbols-outlined text-gray-400 dark:text-gray-500">
                arrow_forward
              </span>
            )}
          </button>

          {/* Reflection */}
          <button
            type="button"
            onClick={() => router.push(`/meditation/journal?day=${day}`)}
            className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition-all active:scale-[0.98] dark:bg-[#151E32]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600">
              <span className="material-symbols-outlined text-white">edit_note</span>
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-[#111817] dark:text-white">Journal</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {content.reflection.prompt.slice(0, 40)}...
              </p>
            </div>
            {isReflectionComplete ? (
              <span className="material-symbols-outlined text-[#389485]">check_circle</span>
            ) : (
              <span className="material-symbols-outlined text-gray-400 dark:text-gray-500">
                arrow_forward
              </span>
            )}
          </button>
        </div>

        {/* Day navigation */}
        <div className="mt-8 flex w-full max-w-md items-center justify-between">
          <button
            type="button"
            onClick={() => day > 1 && router.push(`/meditation/day/${day - 1}`)}
            disabled={day <= 1}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-gray-700 transition-all dark:text-white ${
              day <= 1
                ? "cursor-not-allowed opacity-30"
                : "bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span className="text-sm font-medium">Day {day - 1}</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/meditation/journey")}
            className="rounded-full bg-gray-100 p-2 transition-all hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20"
            aria-label="Back to journey grid"
          >
            <span className="material-symbols-outlined text-gray-700 dark:text-white">
              grid_view
            </span>
          </button>

          <button
            type="button"
            onClick={() => day < TOTAL_DAYS && router.push(`/meditation/day/${day + 1}`)}
            disabled={day >= TOTAL_DAYS}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-gray-700 transition-all dark:text-white ${
              day >= TOTAL_DAYS
                ? "cursor-not-allowed opacity-30"
                : "bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20"
            }`}
          >
            <span className="text-sm font-medium">Day {day + 1}</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </main>
    </div>
  );
}
