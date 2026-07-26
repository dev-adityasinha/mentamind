"use client";

import { useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getJourney,
  getCurriculum,
  getCompletions,
  type Journey,
  type CurriculumDay,
  type DailyCompletion,
} from "@/lib/api/mindful";

type Status = "complete" | "partial" | "upcoming";

const BLOCK_META: Record<number, { name: string; icon: string; color: string }> = {
  1: { name: "Foundation", icon: "foundation", color: "from-teal-400 to-teal-600" },
  2: { name: "Depth", icon: "landscape", color: "from-indigo-400 to-indigo-600" },
  3: { name: "Integration", icon: "integration_instructions", color: "from-purple-400 to-purple-600" },
};

const BLOCK_FOCUS: Record<number, string> = {
  1: "Settling in and learning basic techniques",
  2: "Increasing depth and building skills",
  3: "Application in daily life and maintenance",
};

export default function MeditationJourneyPage() {
  const router = useRouter();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [days, setDays] = useState<CurriculumDay[]>([]);
  const [completions, setCompletions] = useState<DailyCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(1);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [j, cur, comp] = await Promise.all([
          getJourney(),
          getCurriculum(),
          getCompletions(),
        ]);
        if (!active) return;
        setJourney(j);
        setDays(cur);
        setCompletions(comp);
      } catch {
        // handled below
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="text-text-muted">Loading the journey…</div>;
  if (!journey) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-text-secondary">
        No content available yet.
      </div>
    );
  }

  // A program day can have several completion rows (one per calendar date it
  // was worked on). Merge them so a day's meditation/reflection/task flags are
  // OR-ed together across all its rows, instead of the last row overwriting the
  // rest — otherwise parts done on different days cancel each other out.
  const compByDay = new Map<number, DailyCompletion>();
  for (const c of completions) {
    const prev = compByDay.get(c.day);
    if (!prev) {
      compByDay.set(c.day, { ...c });
    } else {
      compByDay.set(c.day, {
        ...prev,
        meditation: prev.meditation || c.meditation,
        reflection: prev.reflection || c.reflection,
        task: prev.task || c.task,
      });
    }
  }

  const statusFor = (dayNum: number): Status => {
    const c = compByDay.get(dayNum);
    if (!c) return "upcoming";
    if (c.meditation && c.reflection && c.task) return "complete";
    if (c.meditation || c.reflection || c.task) return "partial";
    return "upcoming";
  };

  const byBlock = new Map<number, CurriculumDay[]>();
  for (const d of days) {
    const arr = byBlock.get(d.block) ?? [];
    arr.push(d);
    byBlock.set(d.block, arr);
  }

  const overallItems = Array.from(compByDay.values()).reduce(
    (acc, s) => acc + (s.meditation ? 1 : 0) + (s.task ? 1 : 0) + (s.reflection ? 1 : 0),
    0,
  );
  const overallPct = Math.round((overallItems / (journey.total_days * 3)) * 100);

  const activeBlock =
    journey.current_day > 20 ? 3 : Math.ceil(journey.current_day / 10);

  const BlockCard = ({ block }: { block: number }) => {
    const meta = BLOCK_META[block];
    const blockDays = (byBlock.get(block) ?? []).slice().sort((a, b) => a.day - b.day);
    const totalItems = blockDays.length * 3;
    const completedItems = blockDays.reduce((acc, d) => {
      const s = compByDay.get(d.day);
      if (!s) return acc;
      return acc + (s.meditation ? 1 : 0) + (s.reflection ? 1 : 0) + (s.task ? 1 : 0);
    }, 0);
    const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const fullyDone = blockDays.filter((d) => statusFor(d.day) === "complete").length;
    const isActive = block === activeBlock;
    const open = selectedBlock === block;

    return (
      <div className="overflow-hidden rounded-xl bg-white shadow-lg dark:bg-[#151E32]">
        <button
          type="button"
          onClick={() => setSelectedBlock(open ? null : block)}
          className="w-full p-4 text-left transition-all"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${meta.color}`}>
                <span className="material-symbols-outlined text-[20px] text-white">{meta.icon}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[#111817] dark:text-white">
                    Block {block}: {meta.name}
                  </h3>
                  {isActive && (
                    <span className="rounded-full bg-[#3D6B5B]/10 px-2 py-0.5 text-xs font-bold text-[#3D6B5B] dark:bg-[#3D6B5B]/20 dark:text-[#4FD1C5]">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{BLOCK_FOCUS[block]}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {fullyDone}/{blockDays.length} days
              </span>
              <span
                className={`material-symbols-outlined text-gray-500 transition-transform dark:text-gray-400 ${open ? "rotate-180" : ""}`}
              >
                expand_more
              </span>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${meta.color} transition-all duration-500`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </button>

        {open && (
          <div className="space-y-2 border-t border-gray-100 px-4 pb-4 dark:border-white/5">
            <div className="grid grid-cols-1 gap-2 pt-4 sm:grid-cols-2">
              {blockDays.map((day) => {
                const status = statusFor(day.day);
                const isCurrent = day.day === journey.current_day;
                return (
                  <button
                    key={day.day}
                    type="button"
                    onClick={() => router.push(`/meditation/day/${day.day}`)}
                    className={`rounded-2xl p-4 text-left transition-all active:scale-[0.98] ${
                      isCurrent
                        ? "bg-[#3D6B5B]/10 ring-2 ring-[#3D6B5B] dark:bg-[#3D6B5B]/20"
                        : status === "complete"
                          ? "bg-green-50 dark:bg-[#3D6B5B]/10"
                          : status === "partial"
                            ? "bg-yellow-50 dark:bg-yellow-900/20"
                            : "bg-gray-50 dark:bg-white/5"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Day {day.day}</span>
                      {status === "complete" && (
                        <span className="material-symbols-outlined text-[16px] text-[#3D6B5B]">check_circle</span>
                      )}
                      {status === "partial" && (
                        <span className="material-symbols-outlined text-[16px] text-yellow-600 dark:text-yellow-400">pending</span>
                      )}
                      {isCurrent && status !== "complete" && (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-[#3D6B5B]" />
                      )}
                    </div>
                    <p className="truncate text-sm font-bold text-[#111817] dark:text-white">{day.title}</p>
                    <p className="truncate text-xs text-gray-400 dark:text-gray-500">{day.theme}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative min-h-screen pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 -mx-4 mb-1 px-4 pb-3 pt-1 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">30-Day Program</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#111817] dark:text-white">
              Your Journey
            </h1>
          </div>
          <div className="rounded-full bg-[#3D6B5B]/10 px-4 py-2 text-sm font-bold text-[#3D6B5B] dark:bg-[#3D6B5B]/20 dark:text-[#4FD1C5]">
            Day {journey.current_day}/{journey.total_days}
          </div>
        </div>
      </header>

      <main className="space-y-3">
        {/* Overall Progress */}
        <div className="rounded-xl bg-white p-4 shadow-lg dark:bg-[#151E32]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-[#111817] dark:text-white">Overall Progress</h2>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{overallPct}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#3D6B5B] to-[#4FD1C5] transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between">
            {[1, 2, 3].map((block) => (
              <div key={block} className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${
                    block === 1
                      ? "bg-gradient-to-r from-teal-400 to-teal-600"
                      : block === 2
                        ? "bg-gradient-to-r from-indigo-400 to-indigo-600"
                        : "bg-gradient-to-r from-purple-400 to-purple-600"
                  }`}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">Block {block}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Blocks */}
        <BlockCard block={1} />
        <BlockCard block={2} />
        <BlockCard block={3} />
      </main>
    </div>
  );
}
