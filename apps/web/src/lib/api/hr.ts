"use client";

import { apiFetch } from "./client";

export interface OrgWellnessTrend {
  date: string;
  avg_composite: number | null;
  avg_mood: number | null;
  avg_stress: number | null;
  avg_burnout: number | null;
  participants: number;
}

export interface OrgWellnessResponse {
  org_id: string;
  days: number;
  trend: OrgWellnessTrend[];
}

export interface ParticipationResponse {
  org_id: string;
  total_users: number;
  active_this_month: number;
  participation_rate: number;
}

export interface HeatmapEntry {
  date: string;
  avg_score: number | null;
  responses: number;
}

export interface HeatmapResponse {
  org_id: string;
  heatmap: HeatmapEntry[];
}

export async function getOrgWellness(days = 30): Promise<OrgWellnessResponse> {
  const res = await apiFetch(`/admin/hr/org-wellness?days=${days}`);
  if (!res.ok) throw new Error("Failed to load org wellness data");
  return res.json();
}

export async function getParticipation(): Promise<ParticipationResponse> {
  const res = await apiFetch("/admin/hr/participation");
  if (!res.ok) throw new Error("Failed to load participation data");
  return res.json();
}

export async function getHeatmap(days = 30): Promise<HeatmapResponse> {
  const res = await apiFetch(`/admin/hr/dept-heatmap?days=${days}`);
  if (!res.ok) throw new Error("Failed to load heatmap data");
  return res.json();
}

export interface OrgUser {
  id: string;
  display_name: string;
  role: string;
  created_at: string;
  last_active_at: string | null;
}

export async function getOrgUsers(): Promise<OrgUser[]> {
  const res = await apiFetch("/users");
  if (!res.ok) throw new Error("Failed to load users");
  return res.json();
}
