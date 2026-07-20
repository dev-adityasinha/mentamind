"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  getOrgWellness,
  getParticipation,
  getHeatmap,
  getOrgUsers,
  type OrgWellnessResponse,
  type ParticipationResponse,
  type HeatmapResponse,
  type OrgUser,
} from "@/lib/api/hr";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

export default function HRDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [wellness, setWellness] = useState<OrgWellnessResponse | null>(null);
  const [participation, setParticipation] = useState<ParticipationResponse | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapResponse | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const isAllowed = user?.role === "admin" || user?.role === "hr_manager";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [w, p, h, u] = await Promise.all([
        getOrgWellness(days),
        getParticipation(),
        getHeatmap(days),
        getOrgUsers().catch(() => []),
      ]);
      setWellness(w);
      setParticipation(p);
      setHeatmap(h);
      setUsers(u);
    } catch {
      addToast("Failed to load HR data", "error");
    } finally {
      setLoading(false);
    }
  }, [days, addToast]);

  useEffect(() => {
    if (authLoading) return;
    if (isAllowed) loadData();
    else setLoading(false);
  }, [authLoading, isAllowed, loadData]);

  if (authLoading) return null;

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-text-muted">
        <p className="text-lg">Access denied.</p>
        <p className="mt-1 text-sm">Only HR managers and admins can view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-surface-raised border-t-brand" />
      </div>
    );
  }

  const wellnessChartData = wellness?.trend.map((t) => ({
    date: new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    composite: t.avg_composite ?? 0,
    mood: t.avg_mood ?? 0,
    stress: t.avg_stress ?? 0,
    participants: t.participants,
  })) ?? [];

  const heatmapData = heatmap?.heatmap.map((h) => ({
    date: new Date(h.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    score: h.avg_score ?? 0,
    responses: h.responses,
  })) ?? [];

  const trendData = wellness?.trend ?? [];
  const latest = trendData[trendData.length - 1] ?? null;
  const previous = trendData.length >= 2 ? trendData[trendData.length - 2] : null;

  function burnoutLabel(score: number | null | undefined): { label: string; color: string; bg: string } {
    if (score == null) return { label: "—", color: "text-text-muted", bg: "bg-surface-raised" };
    if (score > 75) return { label: "High", color: "text-destructive", bg: "bg-destructive-subtle" };
    if (score > 40) return { label: "Moderate", color: "text-amber-500", bg: "bg-amber-500/10" };
    return { label: "Low", color: "text-success", bg: "bg-success-subtle" };
  }

  function wellnessBand(score: number | null | undefined): { label: string; color: string; bg: string } {
    if (score == null) return { label: "—", color: "text-text-muted", bg: "bg-surface-raised" };
    if (score >= 70) return { label: "Good", color: "text-success", bg: "bg-success-subtle" };
    if (score >= 40) return { label: "Fair", color: "text-amber-500", bg: "bg-amber-500/10" };
    return { label: "Concerning", color: "text-destructive", bg: "bg-destructive-subtle" };
  }

  function trend(a: number | null | undefined, b: number | null | undefined): { arrow: string; color: string } {
    if (a == null || b == null) return { arrow: "→", color: "text-text-muted" };
    const diff = a - b;
    if (Math.abs(diff) < 2) return { arrow: "→", color: "text-text-muted" };
    if (diff > 0) return { arrow: "↑", color: "text-success" };
    return { arrow: "↓", color: "text-destructive" };
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">HR Dashboard</h1>
          <p className="mt-1 text-sm text-text-muted">
            Org-wide wellness metrics and participation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={days === 7 ? "primary" : "ghost"}
            size="sm"
            onClick={() => setDays(7)}
          >
            7d
          </Button>
          <Button
            variant={days === 30 ? "primary" : "ghost"}
            size="sm"
            onClick={() => setDays(30)}
          >
            30d
          </Button>
          <Button
            variant={days === 90 ? "primary" : "ghost"}
            size="sm"
            onClick={() => setDays(90)}
          >
            90d
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-5">
            <p className="text-sm text-text-muted">Wellness Score</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-3xl font-bold text-text-primary">
                {latest ? latest.avg_composite ?? "—" : "—"}
              </p>
              <span className="text-lg text-text-muted">/ 100</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${wellnessBand(latest?.avg_composite).bg} ${wellnessBand(latest?.avg_composite).color}`}>
                {wellnessBand(latest?.avg_composite).label}
              </span>
              <span className={`text-xs ${trend(latest?.avg_composite, previous?.avg_composite).color}`}>
                {trend(latest?.avg_composite, previous?.avg_composite).arrow} vs yesterday
              </span>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-sm text-text-muted">Avg Mood</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-3xl font-bold text-text-primary">
                {latest ? latest.avg_mood ?? "—" : "—"}
              </p>
              <span className="text-lg text-text-muted">/ 100</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${wellnessBand(latest?.avg_mood).bg} ${wellnessBand(latest?.avg_mood).color}`}>
                {wellnessBand(latest?.avg_mood).label}
              </span>
              <span className={`text-xs ${trend(latest?.avg_mood, previous?.avg_mood).color}`}>
                {trend(latest?.avg_mood, previous?.avg_mood).arrow} vs yesterday
              </span>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-sm text-text-muted">Burnout Risk</p>
            <p className="mt-1 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${burnoutLabel(latest?.avg_burnout).bg} ${burnoutLabel(latest?.avg_burnout).color}`}>
                {burnoutLabel(latest?.avg_burnout).label}
              </span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-xs ${trend(latest?.avg_burnout, previous?.avg_burnout).color}`}>
                {trend(latest?.avg_burnout, previous?.avg_burnout).arrow} vs yesterday
              </span>
              {latest?.avg_burnout != null && (
                <span className="text-xs text-text-muted">({latest.avg_burnout}/100)</span>
              )}
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-sm text-text-muted">Participants</p>
            <p className="mt-1 text-3xl font-bold text-text-primary">
              {latest?.participants ?? "—"}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              checked in today
            </p>
            {participation && (
              <p className="mt-1 text-xs text-text-muted">
                {participation.participation_rate}% of org this month
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* People */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">People</h2>
            <span className="text-sm text-text-muted">{users.length} members</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted uppercase tracking-wide">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 pr-4 font-medium">Joined</th>
                  <th className="pb-2 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-4 text-text-primary font-medium">{u.display_name}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === "admin" ? "bg-destructive-subtle text-destructive" :
                        u.role === "hr_manager" ? "bg-amber-500/10 text-amber-500" :
                        "bg-surface-raised text-text-secondary"
                      }`}>
                        {u.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-text-secondary">
                      {new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-2.5 text-text-secondary">
                      {u.last_active_at
                        ? new Date(u.last_active_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                        : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Participation */}
      {participation && (
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Participation</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-text-muted">Total users</p>
                <p className="text-2xl font-bold text-text-primary">{participation.total_users}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">Active this month</p>
                <p className="text-2xl font-bold text-text-primary">{participation.active_this_month}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">Rate</p>
                <p className="text-2xl font-bold text-text-primary">{participation.participation_rate}%</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Wellness trend chart */}
      {wellnessChartData.length > 0 && (
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Wellness trend</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={wellnessChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="composite"
                    stroke="var(--color-brand)"
                    strokeWidth={2}
                    dot={false}
                    name="Composite"
                  />
                  <Line
                    type="monotone"
                    dataKey="mood"
                    stroke="var(--color-success)"
                    strokeWidth={2}
                    dot={false}
                    name="Mood"
                  />
                  <Line
                    type="monotone"
                    dataKey="stress"
                    stroke="var(--color-destructive)"
                    strokeWidth={2}
                    dot={false}
                    name="Stress"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      )}

      {/* Heatmap */}
      {heatmapData.length > 0 && (
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Daily scores</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={heatmapData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
                  <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="score" fill="var(--color-brand)" name="Avg score" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="responses" fill="var(--color-border-strong)" name="Responses" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      )}

      {wellnessChartData.length === 0 && heatmapData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <p className="text-lg">No data available yet.</p>
          <p className="mt-1 text-sm">Data will appear once users start checking in.</p>
        </div>
      )}
    </div>
  );
}
