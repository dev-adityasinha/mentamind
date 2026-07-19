"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PenSquare,
  BookOpen,
  MessageCircle,
  Users,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { getScreeningHistory, ScreeningDetailResponse } from "@/lib/api/screening";
import { apiFetch } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/Button";
import questionnaireMap from "@/lib/screening/data/questionnaire-map.json";
import { format, parseISO } from "date-fns";

const TEST_LABELS: Record<string, { title: string; shortTitle: string; color: string }> = {};
for (const cat of questionnaireMap.categories) {
  for (const t of cat.tests) {
    TEST_LABELS[t.id] = { title: t.title, shortTitle: t.shortTitle, color: cat.color };
  }
}

const severityColors: Record<string, string> = {
  severe: "text-destructive",
  moderate: "text-amber-500",
  mild: "text-yellow-500",
  minimal: "text-success",
};

function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return null;
  const color = severityColors[severity] || "text-text-muted";
  return (
    <span className={`text-xs font-medium capitalize ${color}`}>
      {severity}
    </span>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [screenings, setScreenings] = useState<ScreeningDetailResponse[]>([]);
  const [summary, setSummary] = useState({ community_posts: 0, pending_chats: 0, ai_checkins: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const screeningData = await getScreeningHistory(90).catch(() => []);
        setScreenings(screeningData);
        
        const summaryData = await apiFetch("/dashboard/summary").then(res => res.json()).catch(() => null);
        if (summaryData) {
          setSummary(summaryData);
        }
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const recentScreenings = screenings.slice(0, 5);
  const latestScreening = screenings[0] ?? null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-surface-raised border-t-brand"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-[132px] gap-4">
      {/* Hero */}
      <div className="sm:col-span-2 lg:col-span-2 row-span-2 rounded-2xl border border-border bg-surface p-6 glass-shimmer flex flex-col justify-between overflow-hidden relative">
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-0 dark:opacity-40 blur-[80px] -z-10"
          style={{ background: "radial-gradient(circle, #1d4ed8 0%, transparent 70%)" }}
        />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
            {getGreeting()}, {user?.display_name?.split(" ")[0]}
          </h1>
          <p className="text-text-secondary mt-1">
            Here&apos;s your wellbeing overview for today.
          </p>
        </div>
        <Button type="button" variant="primary" onClick={() => router.push("/tests")} className="w-fit">
          Take a Screening
        </Button>
      </div>

      {/* Screening History */}
      <button
        type="button"
        onClick={() => router.push("/tests")}
        className="lg:col-span-1 row-span-2 rounded-2xl border border-border-strong bg-surface-raised text-text-primary p-6 glass-shimmer flex flex-col justify-between text-left hover:bg-border/40 transition-colors overflow-hidden"
      >
        <h2 className="text-sm font-medium">Screening History</h2>
        <div>
          <div className="text-4xl font-bold tabular-nums">{screenings.length}</div>
          <p className="text-xs text-text-muted mt-1">
            {screenings.length === 0 ? "No screenings yet" : "screenings taken"}
          </p>
        </div>
        {latestScreening ? (
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: TEST_LABELS[latestScreening.test_id]?.color || "var(--color-text-muted)" }}
            />
            <span className="text-xs truncate text-text-secondary">
              {TEST_LABELS[latestScreening.test_id]?.title || latestScreening.test_id}
            </span>
            <SeverityBadge severity={latestScreening.severity} />
          </div>
        ) : (
          <span className="text-xs text-brand">Take your first screening</span>
        )}
      </button>

      {/* Recent Screenings */}
      <div className="lg:col-span-1 rounded-2xl border border-border bg-surface p-6 glass-shimmer flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-primary">Recent Screenings</h2>
          <button
            type="button"
            onClick={() => router.push("/tests")}
            className="text-xs text-brand hover:text-brand-hover transition-colors shrink-0"
          >
            View all
          </button>
        </div>
        {recentScreenings.length === 0 ? (
          <p className="text-xs text-text-muted">
            No screenings yet. Take your first to see patterns over time.
          </p>
        ) : (
          <div className="space-y-1.5 overflow-hidden">
            {recentScreenings.slice(0, 2).map((s) => {
              const label = TEST_LABELS[s.test_id];
              const displayName = label?.title || label?.shortTitle || s.test_id;
              const dotColor = label?.color || "var(--color-text-muted)";
              return (
                <div key={s.id} className="flex items-center gap-2 min-w-0">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
                  <span className="text-xs font-medium text-text-primary truncate">{displayName}</span>
                  <SeverityBadge severity={s.severity} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Check-in Summary */}
      <div className="lg:col-span-1 rounded-2xl border border-border bg-surface p-6 glass-shimmer flex flex-col justify-between overflow-hidden">
        <h2 className="text-sm font-medium text-text-primary flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand shrink-0" />
          AI Check-ins
        </h2>
        <p className="text-xs text-text-secondary">
          {summary.ai_checkins > 0 ? `${summary.ai_checkins} sessions completed.` : "No sessions yet."}
        </p>
      </div>

      {/* Quick action: Daily Check-in */}
      <button
        type="button"
        onClick={() => router.push("/checkin")}
        className="rounded-2xl border border-border bg-surface p-6 glass-shimmer flex flex-col justify-between text-left hover:bg-surface-raised transition-colors"
      >
        <PenSquare className="w-5 h-5 text-brand" />
        <span className="text-sm font-medium text-text-primary">Daily Check-In</span>
      </button>

      {/* Quick action: Journal */}
      <button
        type="button"
        onClick={() => router.push("/journal")}
        className="rounded-2xl border border-border bg-surface p-6 glass-shimmer flex flex-col justify-between text-left hover:bg-surface-raised transition-colors"
      >
        <BookOpen className="w-5 h-5 text-brand" />
        <span className="text-sm font-medium text-text-primary">Journal Entry</span>
      </button>

      {/* Quick action: AI Coach */}
      <button
        type="button"
        onClick={() => router.push("/coach")}
        className="rounded-2xl border border-border bg-surface p-6 glass-shimmer flex flex-col justify-between text-left hover:bg-surface-raised transition-colors"
      >
        <MessageCircle className="w-5 h-5 text-brand" />
        <span className="text-sm font-medium text-text-primary">Talk to AI Coach</span>
      </button>

      {/* Pending Chats */}
      <button
        type="button"
        onClick={() => router.push("/chat")}
        className="rounded-2xl border border-border bg-surface p-6 glass-shimmer flex flex-col justify-between text-left hover:bg-surface-raised transition-colors"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-brand"></span>
        </span>
        <span className="text-sm font-medium text-text-primary">
          {summary.pending_chats > 0 ? `${summary.pending_chats} pending chats` : "Pending Chats"}
        </span>
      </button>

      {/* Community Highlights - wide banner */}
      <button
        type="button"
        onClick={() => router.push("/forum")}
        className="sm:col-span-2 lg:col-span-4 rounded-2xl border border-border bg-surface p-6 glass-shimmer flex items-center justify-between text-left hover:bg-surface-raised transition-colors gap-4"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Users className="w-5 h-5 text-brand shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-text-primary">Community Highlights</h2>
            <p className="text-xs text-text-secondary truncate">
              {summary.community_posts > 0
                ? `${summary.community_posts} new posts in the AnonyMenta forum.`
                : "See what others are discussing in the AnonyMenta forum."}
            </p>
          </div>
        </div>
        <MessageSquareText className="w-5 h-5 text-text-muted shrink-0" />
      </button>
    </div>
  );
}
