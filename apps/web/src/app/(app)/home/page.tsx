"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreeningTimeline } from "@/components/dashboard/ScreeningTimeline";
import { getScreeningHistory, ScreeningDetailResponse } from "@/lib/api/screening";
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const screeningData = await getScreeningHistory(90).catch(() => []);
        setScreenings(screeningData);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const recentScreenings = screenings.slice(0, 5);

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {getGreeting()}, {user?.display_name?.split(" ")[0]}
          </h1>
          <p className="text-text-secondary mt-1">
            Here&apos;s your wellbeing overview for today.
          </p>
        </div>
        <Button type="button" variant="primary" onClick={() => router.push("/tests")}>
          Take a Screening
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-text-primary">
            Quick Actions
          </h2>
          <div className="flex flex-col gap-3 flex-1">
            <button
              type="button"
              onClick={() => router.push("/tests")}
              className="flex items-center gap-3 rounded-lg border border-border bg-bg px-4 py-3 text-left text-sm font-medium text-text-primary hover:border-border-strong hover:shadow-sm transition-all"
            >
              <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Take a Screening
            </button>
            <button
              type="button"
              onClick={() => router.push("/checkin")}
              className="flex items-center gap-3 rounded-lg border border-border bg-bg px-4 py-3 text-left text-sm font-medium text-text-primary hover:border-border-strong hover:shadow-sm transition-all"
            >
              <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Daily Check-In
            </button>
            <button
              type="button"
              onClick={() => router.push("/journal")}
              className="flex items-center gap-3 rounded-lg border border-border bg-bg px-4 py-3 text-left text-sm font-medium text-text-primary hover:border-border-strong hover:shadow-sm transition-all"
            >
              <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Journal Entry
            </button>
            <button
              type="button"
              onClick={() => router.push("/coach")}
              className="flex items-center gap-3 rounded-lg border border-border bg-bg px-4 py-3 text-left text-sm font-medium text-text-primary hover:border-border-strong hover:shadow-sm transition-all"
            >
              <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Talk to AI Coach
            </button>
          </div>
        </div>
      </div>

      {/* Screening Timeline */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-sm font-medium text-text-primary mb-4">Screening History</h2>
        <ScreeningTimeline screenings={screenings} />
      </div>

      {/* Recent Screenings */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-text-primary">Recent Screenings</h2>
          <button
            type="button"
            onClick={() => router.push("/tests")}
            className="text-xs text-brand hover:text-brand-hover transition-colors"
          >
            View all screenings
          </button>
        </div>

        {recentScreenings.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-text-muted mb-3">
              No screenings completed yet. Take your first screening to see patterns over time.
            </p>
            <Button type="button" variant="secondary" onClick={() => router.push("/tests")}>
              Start a Screening
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {recentScreenings.map((s) => {
              const label = TEST_LABELS[s.test_id];
              const displayName = label?.title || label?.shortTitle || s.test_id;
              const dotColor = label?.color || "var(--color-text-muted)";
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: dotColor }}
                    />
                    <span className="text-sm font-medium text-text-primary truncate">
                      {displayName}
                    </span>
                    <span className="text-sm tabular-nums text-text-secondary">
                      {s.score}
                    </span>
                    <SeverityBadge severity={s.severity} />
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-text-muted">
                      {format(parseISO(s.created_at), "MMM d, yyyy")}
                    </span>
                    <button
                      type="button"
                      onClick={() => router.push(`/tests/${s.test_id}`)}
                      className="text-xs text-brand hover:text-brand-hover transition-colors"
                    >
                      Retake
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Additional Dashboard Widgets */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Community Posts */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
              Community Highlights
            </h2>
            <p className="text-sm text-text-secondary mb-4">See what others are discussing in the AnonyMenta forum.</p>
          </div>
          <Button variant="secondary" onClick={() => router.push("/forum")} className="w-full justify-center">View Forum</Button>
        </div>

        {/* Pending Chats */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
              <span className="relative flex h-3 w-3 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-brand"></span>
              </span>
              Pending Chats
            </h2>
            <p className="text-sm text-text-secondary mb-4">You have active anonymous chat sessions waiting.</p>
          </div>
          <Button variant="secondary" onClick={() => router.push("/chat")} className="w-full justify-center">Join Chat</Button>
        </div>

        {/* AI Check-in Summary */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              AI Check-in Summary
            </h2>
            <p className="text-sm text-text-secondary mb-4">Your AI coach noticed a positive trend in your mood this week.</p>
          </div>
          <Button variant="secondary" onClick={() => router.push("/coach")} className="w-full justify-center">Talk to Coach</Button>
        </div>
      </div>
    </div>
  );
}
