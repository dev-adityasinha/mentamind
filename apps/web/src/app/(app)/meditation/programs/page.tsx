"use client";

import { useRouter } from "next/navigation";

interface Program {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  duration: string;
  sessions: number;
  icon: string;
  color: string;
  description: string;
}

// Ported from Mindful-Architecture's Programs page.
const PROGRAMS: Program[] = [
  {
    id: "anxiety",
    href: "/meditation/day/6",
    title: "Calm",
    subtitle: "Reduce Anxiety & Stress",
    duration: "30 days",
    sessions: 30,
    icon: "spa",
    color: "from-teal-400 to-teal-600",
    description:
      "A comprehensive program to help you manage anxiety and find inner peace through guided meditation and breathing exercises.",
  },
  {
    id: "sleep",
    href: "/meditation/library?category=sleep",
    title: "Sleep",
    subtitle: "Better Rest & Recovery",
    duration: "21 days",
    sessions: 21,
    icon: "bedtime",
    color: "from-indigo-400 to-indigo-600",
    description:
      "Wind down with sleep stories, relaxation techniques, and evening rituals designed to improve your sleep quality.",
  },
  {
    id: "focus",
    href: "/meditation/day/11",
    title: "Focus",
    subtitle: "Sharpen Your Mind",
    duration: "14 days",
    sessions: 14,
    icon: "center_focus_strong",
    color: "from-amber-400 to-amber-600",
    description:
      "Enhance concentration and productivity with mindfulness practices designed for busy professionals.",
  },
  {
    id: "beginners",
    href: "/meditation/day/1",
    title: "Foundations",
    subtitle: "Start Your Journey",
    duration: "7 days",
    sessions: 7,
    icon: "self_improvement",
    color: "from-green-400 to-green-600",
    description:
      "Perfect for beginners. Learn the basics of meditation with simple, guided sessions.",
  },
  {
    id: "confidence",
    href: "/meditation/day/28",
    title: "Confidence",
    subtitle: "Build Self-Esteem",
    duration: "21 days",
    sessions: 21,
    icon: "psychology",
    color: "from-purple-400 to-purple-600",
    description:
      "Develop inner strength and self-confidence through positive affirmations and visualization.",
  },
  {
    id: "lifestyle",
    href: "/meditation/day/16",
    title: "Balance",
    subtitle: "Mindful Living",
    duration: "30 days",
    sessions: 30,
    icon: "balance",
    color: "from-rose-400 to-rose-600",
    description:
      "Integrate mindfulness into daily life with practical exercises and lifestyle habits.",
  },
];

export default function MeditationProgramsPage() {
  const router = useRouter();

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Programs</h1>
        <p className="mt-1 text-sm text-text-muted">Choose your path to mindfulness</p>
      </div>

      {/* Programs list */}
      {PROGRAMS.map((program) => (
        <div
          key={program.id}
          onClick={() => router.push(program.href)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              router.push(program.href);
            }
          }}
          className="relative cursor-pointer overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-all hover:scale-[1.01] hover:border-brand/40 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <div className="p-4">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${program.color}`}
              >
                <span className="material-symbols-outlined text-[24px] text-white">
                  {program.icon}
                </span>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-text-primary">{program.title}</h3>
                  <span className="rounded-full bg-surface-raised px-2 py-1 text-xs font-medium text-text-muted">
                    {program.duration}
                  </span>
                </div>

                <p className="mb-2 text-sm font-medium text-brand">{program.subtitle}</p>

                <p className="line-clamp-2 text-sm text-text-muted">{program.description}</p>

                <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">play_circle</span>
                    {program.sessions} sessions
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    10-15 min each
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
