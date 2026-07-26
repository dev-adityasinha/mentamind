"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getJourney,
  getCurriculumDay,
  getCompletion,
  type Journey,
  type CurriculumDay,
  type DailyCompletion,
} from "@/lib/api/mindful";
import { getMoodHistory, type MoodResponse } from "@/lib/api/mood";
import {
  MeditationIllustration,
  ReflectionIllustration,
  TaskIllustration,
} from "./_components/Illustrations";

export default function MeditationTodayPage() {
  const router = useRouter();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [day, setDay] = useState<CurriculumDay | null>(null);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [moods, setMoods] = useState<MoodResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const j = await getJourney();
        if (!active) return;
        setJourney(j);
        const [d, c, m] = await Promise.all([
          getCurriculumDay(j.current_day),
          getCompletion(j.current_day),
          getMoodHistory(30).catch(() => []),
        ]);
        if (!active) return;
        setDay(d);
        setCompletion(c);
        setMoods(m);
      } catch {
        // handled by the empty render below
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="text-text-muted">Loading your day…</div>;
  if (!journey || !day) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-text-secondary">
        No content available yet.
      </div>
    );
  }

  const currentDay = journey.current_day;

  // Week strip: today centered-ish (i = -1..+3 from today), matching the original.
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  const weekDates = [] as { day: string; date: number; isToday: boolean; isPast: boolean }[];
  for (let i = -1; i <= 3; i++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() + i);
    weekDates.push({
      day: dayNames[dt.getDay()],
      date: dt.getDate(),
      isToday: i === 0,
      isPast: i < 0,
    });
  }

  // 7-day mood series keyed by program day (mood 1-5), from mood_logs.
  const moodByDay = new Map<number, number>();
  moods.forEach((m, idx) => {
    // Map recent logs onto recent days ending at currentDay (best-effort).
    const dnum = currentDay - (moods.length - 1 - idx);
    if (dnum >= 1) moodByDay.set(dnum, m.mood_score);
  });
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const dnum = currentDay - 6 + i;
    const dt = new Date();
    dt.setDate(dt.getDate() - (6 - i));
    return {
      day: dnum,
      mood: dnum < 1 ? 0 : moodByDay.get(dnum) ?? 0,
      label: ["S", "M", "T", "W", "T", "F", "S"][dt.getDay()],
      isToday: i === 6,
    };
  });
  const recentMoods = moods.slice(-7).map((m) => m.mood_score);
  const avgMood =
    recentMoods.length > 0
      ? (recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length).toFixed(1)
      : null;

  const medDone = !!completion?.meditation;
  const reflDone = !!completion?.reflection;
  const taskDone = !!completion?.task;

  return (
    <div className="relative min-h-screen font-['Epilogue'] pb-16">
      {/* Header */}
      <header className="flex items-center justify-between pb-4">
        <div>
          <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">Your Journey</p>
          <h1 className="text-2xl font-bold text-[#111818] dark:text-white">
            Day <span className="text-[#2B4D41] dark:text-[#4FD1C5]">{currentDay}</span> of {journey.total_days}
          </h1>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-[#e8f5f3] to-[#d0ebe6] shadow-sm dark:border-gray-800 dark:from-[#1e3a3a] dark:to-[#0d2626]">
          <span className="text-xl">🙂</span>
        </div>
      </header>

      {/* Week Calendar */}
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          {weekDates.map((d, i) => (
            <div
              key={i}
              className={`flex flex-col items-center rounded-xl px-3 py-2 transition-all ${
                d.isToday
                  ? "bg-[#2B4D41] text-white dark:bg-[#4FD1C5] dark:text-[#0B1121]"
                  : d.isPast
                    ? "text-gray-400 dark:text-gray-600"
                    : "text-gray-600 dark:text-gray-400"
              }`}
            >
              <span className={`text-xs font-medium ${d.isToday ? "text-white/80 dark:text-[#0B1121]/80" : ""}`}>
                {d.day}
              </span>
              <span className="text-lg font-bold">{d.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Cards */}
      <main className="space-y-3">
        {/* Meditation */}
        <div
          onClick={() => router.push(`/meditation/session?day=${currentDay}`)}
          className={`relative cursor-pointer overflow-hidden rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99] ${
            medDone
              ? "bg-[#e8f5f3] ring-2 ring-[#3D6B5B] dark:bg-[#0d3d3d]"
              : "bg-gradient-to-br from-[#e8f5f3] to-white dark:from-[#0d3d3d] dark:to-[#0B1121]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#3D6B5B]/10 px-2.5 py-1 dark:bg-[#4FD1C5]/20">
                <span className="material-symbols-outlined text-[14px] text-[#3D6B5B] dark:text-[#4FD1C5]">spa</span>
                <span className="text-xs font-bold text-[#3D6B5B] dark:text-[#4FD1C5]">Meditation</span>
              </div>
              <h3 className="mb-0.5 text-lg font-bold text-[#2C3E35] dark:text-white">
                {day.meditation?.title ?? "Morning Clarity"}
              </h3>
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                {day.meditation?.duration ?? 10} min audio
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#111818] px-3 py-1.5 text-xs font-bold text-white dark:bg-white dark:text-[#111818]">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                Start
              </span>
            </div>
            <div className="h-20 w-20 flex-shrink-0">
              <MeditationIllustration className="h-full w-full rounded-2xl" />
            </div>
          </div>
          {medDone && (
            <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#4b9b87]">
              <span className="material-symbols-outlined text-[16px] text-white">check</span>
            </div>
          )}
        </div>

        {/* Reflection */}
        <div
          onClick={() => router.push(`/meditation/journal?day=${currentDay}`)}
          className={`relative cursor-pointer overflow-hidden rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99] ${
            reflDone
              ? "bg-[#fff5f3] ring-2 ring-[#e57373] dark:bg-[#3d1f1f]"
              : "bg-gradient-to-br from-[#fff5f3] to-white dark:from-[#3d1f1f] dark:to-[#0B1015]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#e57373]/10 px-2.5 py-1 dark:bg-[#f87171]/20">
                <span className="material-symbols-outlined text-[14px] text-[#e57373] dark:text-[#f87171]">edit_note</span>
                <span className="text-xs font-bold text-[#e57373] dark:text-[#f87171]">Reflection</span>
              </div>
              <h3 className="mb-0.5 text-lg font-bold text-[#111818] dark:text-white">Daily Journal</h3>
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Write your thoughts</p>
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-[#111818] dark:border-gray-700 dark:bg-[#1e1e1e] dark:text-white">
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Open
              </span>
            </div>
            <div className="h-24 w-24 flex-shrink-0">
              <ReflectionIllustration className="h-full w-full rounded-2xl" />
            </div>
          </div>
          {reflDone && (
            <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#e57373]">
              <span className="material-symbols-outlined text-[16px] text-white">check</span>
            </div>
          )}
        </div>

        {/* Task */}
        <div
          onClick={() => router.push(`/meditation/task?day=${currentDay}`)}
          className={`relative cursor-pointer overflow-hidden rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99] ${
            taskDone
              ? "bg-[#eff6ff] ring-2 ring-[#60a5fa] dark:bg-[#1e2a4a]"
              : "bg-gradient-to-br from-[#eff6ff] to-white dark:from-[#1e2a4a] dark:to-[#0B1015]"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#60a5fa]/10 px-2.5 py-1 dark:bg-[#60a5fa]/20">
                <span className="material-symbols-outlined text-[14px] text-[#60a5fa]">directions_walk</span>
                <span className="text-xs font-bold text-[#60a5fa]">Task</span>
              </div>
              <h3 className="mb-1 text-xl font-bold text-[#111818] dark:text-white">
                {day.task?.title ?? "Mindful Walking"}
              </h3>
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Step away from screen</p>
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-[#111818] dark:border-gray-700 dark:bg-[#1e1e1e] dark:text-white">
                <span className="material-symbols-outlined text-[16px]">visibility</span>
                View
              </span>
            </div>
            <div className="h-24 w-24 flex-shrink-0">
              <TaskIllustration className="h-full w-full rounded-2xl" />
            </div>
          </div>
          {taskDone && (
            <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#60a5fa]">
              <span className="material-symbols-outlined text-[16px] text-white">check</span>
            </div>
          )}
        </div>

        {/* Recommended for You */}
        <section className="mt-5">
          <h2 className="mb-3 text-base font-bold text-[#111818] dark:text-white">Recommended for You</h2>
          <div className="flex gap-3">
            <div
              onClick={() => router.push(`/meditation/session?day=${currentDay}`)}
              className="flex-1 cursor-pointer rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-[#161B22] dark:shadow-none"
            >
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#4b9b87]/10 dark:bg-[#5eead4]/20">
                <span className="material-symbols-outlined text-[20px] text-[#4b9b87] dark:text-[#5eead4]">bolt</span>
              </div>
              <h3 className="mb-0.5 text-sm font-bold text-[#111818] dark:text-white">Quick Start</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">A short session</p>
            </div>
            <div
              onClick={() => router.push(`/meditation/session?day=${currentDay}`)}
              className="flex-1 cursor-pointer rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-[#161B22] dark:shadow-none"
            >
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                <span className="material-symbols-outlined text-[20px] text-indigo-500 dark:text-indigo-400">bedtime</span>
              </div>
              <h3 className="mb-0.5 text-sm font-bold text-[#111818] dark:text-white">Sleep Ready</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">Wind down</p>
            </div>
          </div>
        </section>

        {/* Mood This Week */}
        <section className="mt-5">
          <h2 className="mb-3 text-base font-bold text-[#111818] dark:text-white">Your Mood This Week</h2>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#161B22] dark:shadow-none">
            <div className="mb-4 flex h-24 items-end justify-between gap-2">
              {last7.map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-lg transition-all ${
                      d.mood === 0
                        ? "bg-gray-100 dark:bg-gray-800"
                        : d.mood >= 4
                          ? "bg-gradient-to-t from-[#4b9b87] to-[#5EEAD4]"
                          : d.mood === 3
                            ? "bg-yellow-400 dark:bg-yellow-600"
                            : "bg-orange-400 dark:bg-orange-600"
                    }`}
                    style={{ height: d.mood === 0 ? "16px" : `${(d.mood / 5) * 100}%`, minHeight: "16px" }}
                  >
                    {d.mood > 0 && (
                      <div className="flex w-full items-start justify-center pt-0.5">
                        <span className="text-[10px]">
                          {d.mood === 5 ? "😊" : d.mood === 4 ? "🙂" : d.mood === 3 ? "😐" : d.mood === 2 ? "😔" : "😫"}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium ${d.isToday ? "text-[#4b9b87] dark:text-[#5eead4]" : "text-gray-400 dark:text-gray-500"}`}>
                    {d.label}
                  </span>
                </div>
              ))}
            </div>
            {avgMood === null ? (
              <p className="text-center text-sm text-gray-400 dark:text-gray-500">
                Complete mood check-ins to see your trends
              </p>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Avg: {avgMood}/5</span>
                <button
                  type="button"
                  onClick={() => router.push("/meditation/dashboard")}
                  className="text-sm font-medium text-[#4b9b87] dark:text-[#5eead4]"
                >
                  See Details →
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
