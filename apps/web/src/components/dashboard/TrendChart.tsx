"use client";

import React from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";

interface TrendChartProps {
  data: { date: string; score: number }[];
}

export function TrendChart({ data }: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl border border-border bg-surface text-sm text-text-muted">
        Not enough data yet
      </div>
    );
  }

  // Sort data chronologically for Recharts
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const formattedData = sortedData.map((d) => ({
    ...d,
    displayDate: format(parseISO(d.date), "MMM d"),
  }));

  return (
    <div className="h-[240px] w-full rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-medium text-text-primary mb-4">
        30-Day Trend
      </h3>
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-brand)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-brand)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="displayDate"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
              minTickGap={20}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
              domain={[0, 100]}
              ticks={[0, 50, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
                borderRadius: "0.5rem",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              itemStyle={{ color: "var(--color-text-primary)" }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--color-brand)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorScore)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
