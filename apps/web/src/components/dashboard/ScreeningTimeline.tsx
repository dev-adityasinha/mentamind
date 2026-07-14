"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScreeningDetailResponse } from "@/lib/api/screening";
import questionnaireMap from "@/lib/screening/data/questionnaire-map.json";
import { Button } from "@/components/ui/Button";

const CATEGORY_COLORS: Record<string, string> = {};
for (const cat of questionnaireMap.categories) {
  for (const t of cat.tests) {
    CATEGORY_COLORS[t.id] = cat.color;
  }
}

const TEST_NAMES: Record<string, string> = {};
for (const cat of questionnaireMap.categories) {
  for (const t of cat.tests) {
    TEST_NAMES[t.id] = t.title;
  }
}

function getMaxScore(s: ScreeningDetailResponse): number {
  return ((s.metadata_answers as { max_score?: number } | null)?.max_score) ?? 100;
}

function normalize(s: ScreeningDetailResponse): number {
  const max = getMaxScore(s);
  if (max <= 0) return 0;
  return Math.round((s.score / max) * 100);
}

interface TimelinePoint {
  date: string;
  dateLabel: string;
  rawScore: number;
  maxScore: number;
  severity: string | null;
  testId: string;
  testName: string;
  id: string;
}

interface Props {
  screenings: ScreeningDetailResponse[];
}

export function ScreeningTimeline({ screenings }: Props) {
  const router = useRouter();
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

  const toggleLine = useCallback((testId: string) => {
    setHiddenLines((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) next.delete(testId);
      else next.add(testId);
      return next;
    });
  }, []);

  const { series, allDates, testIds } = useMemo(() => {
    const byTest = new Map<string, TimelinePoint[]>();
    for (const s of screenings) {
      const arr = byTest.get(s.test_id) ?? [];
      const d = new Date(s.created_at);
      arr.push({
        date: s.created_at.slice(0, 10),
        dateLabel: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        rawScore: s.score,
        maxScore: getMaxScore(s),
        severity: s.severity,
        testId: s.test_id,
        testName: TEST_NAMES[s.test_id] || s.test_id,
        id: s.id,
      });
      byTest.set(s.test_id, arr);
    }
    for (const [, points] of byTest) {
      points.sort((a, b) => a.date.localeCompare(b.date));
    }
    const dateSet = new Set<string>();
    for (const [, points] of byTest) {
      for (const p of points) dateSet.add(p.date);
    }
    const allDates = Array.from(dateSet).sort();
    return {
      series: byTest,
      allDates,
      testIds: Array.from(byTest.keys()),
    };
  }, [screenings]);

  const chartData = useMemo(() => {
    return allDates.map((date) => {
      const point: Record<string, unknown> = { date };
      for (const [testId, points] of series) {
        const match = points.find((p) => p.date === date);
        if (match) {
          point[testId] = normalize({
            id: match.id,
            test_id: match.testId,
            score: match.rawScore,
            severity: match.severity,
            metadata_answers: { max_score: match.maxScore },
            created_at: match.date,
          });
          point[`${testId}_meta`] = match;
        }
      }
      return point;
    });
  }, [allDates, series]);

  const CustomTooltip = useCallback(
    ({ active, payload }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; payload: Record<string, unknown> }> }) => {
      if (!active || !payload?.length) return null;
      const item = payload[0];
      const meta = item.payload[`${item.dataKey}_meta`] as TimelinePoint | undefined;
      if (!meta) return null;
      return (
        <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-md text-xs space-y-1">
          <p className="font-medium text-text-primary">{meta.testName}</p>
          <p className="text-text-muted">{meta.dateLabel}</p>
          <p className="text-text-primary">
            Score: <span className="font-semibold">{meta.rawScore}</span>/{meta.maxScore}
            <span className="text-text-muted ml-1">({item.value}%)</span>
          </p>
          {meta.severity && (
            <p className="capitalize text-text-secondary">{meta.severity}</p>
          )}
        </div>
      );
    },
    [],
  );

  const today = new Date().toISOString().slice(0, 10);

  if (screenings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="text-sm text-text-muted">
          No screenings yet. Take your first screening to see trends over time.
        </p>
        <Button variant="secondary" onClick={() => router.push("/tests")}>
          Start a Screening
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => {
                const d = new Date(v + "T00:00:00");
                return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
              }}
              tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            />
            <Tooltip content={<CustomTooltip />} />
            {testIds.map((testId) => {
              const points = series.get(testId) || [];
              const color = CATEGORY_COLORS[testId] || "var(--color-brand)";
              const hide = hiddenLines.has(testId);
              const hasSinglePoint = points.length === 1;
              return (
                <Line
                  key={testId}
                  type="monotone"
                  dataKey={testId}
                  stroke={color}
                  strokeWidth={2}
                  strokeOpacity={hide ? 0 : 1}
                  dot={
                    hasSinglePoint
                      ? { r: 5, fill: color, strokeWidth: 0 }
                      : { r: 3, fill: color, strokeWidth: 0 }
                  }
                  activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: "var(--color-bg)" }}
                  connectNulls={false}
                  name={TEST_NAMES[testId] || testId}
                  hide={hide}
                />
              );
            })}
            {/* Today marker */}
            {chartData.some((p) => p.date === today) && (
              <ReferenceLine
                x={today}
                stroke="var(--color-border-strong)"
                strokeDasharray="4 4"
                strokeWidth={1}
                label=""
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      {testIds.length > 1 && (
        <div className="flex flex-wrap gap-3">
          {testIds.map((testId) => {
            const color = CATEGORY_COLORS[testId] || "var(--color-brand)";
            const hide = hiddenLines.has(testId);
            return (
              <button
                key={testId}
                type="button"
                onClick={() => toggleLine(testId)}
                className="flex items-center gap-1.5 text-xs transition-opacity"
                style={{ opacity: hide ? 0.4 : 1 }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-text-secondary">{TEST_NAMES[testId] || testId}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
