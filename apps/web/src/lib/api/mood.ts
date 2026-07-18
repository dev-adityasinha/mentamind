import { apiFetch } from "./client";

export type InputMethod = "tap" | "voice" | "text";

export interface MoodCreateRequest {
  mood_score: number;
  energy_score?: number | null;
  stress_score?: number | null;
  emotion_tags?: string[];
  context_tag?: string;
  note?: string;
  input_method?: InputMethod;
}

export interface MoodResponse {
  id: string;
  mood_score: number;
  energy_score: number | null;
  stress_score: number | null;
  emotion_tags: string[];
  context_tag: string | null;
  note: string | null;
  input_method: InputMethod;
  logged_at: string;
  created_at: string;
}

export interface MoodAnalyticsBucket {
  period: string;
  period_start: string;
  entries: number;
  avg_mood: number | null;
  avg_energy: number | null;
  avg_stress: number | null;
}

export interface EmotionCount {
  emotion: string;
  count: number;
}

export interface MoodAnalytics {
  period: "weekly" | "monthly";
  range_days: number;
  total_entries: number;
  avg_mood: number | null;
  avg_energy: number | null;
  avg_stress: number | null;
  buckets: MoodAnalyticsBucket[];
  top_emotions: EmotionCount[];
}

export async function submitMoodLog(data: MoodCreateRequest): Promise<MoodResponse> {
  const res = await apiFetch("/mood", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to submit mood log");
  return res.json() as Promise<MoodResponse>;
}

export async function getMoodHistory(days: number = 30): Promise<MoodResponse[]> {
  const res = await apiFetch(`/mood/history?days=${days}`);
  if (!res.ok) throw new Error("Failed to get mood history");
  return res.json() as Promise<MoodResponse[]>;
}

export async function getMoodAnalytics(
  period: "weekly" | "monthly" = "weekly",
  days = 90,
): Promise<MoodAnalytics> {
  const res = await apiFetch(`/mood/analytics?period=${period}&days=${days}`);
  if (!res.ok) throw new Error("Failed to get mood analytics");
  return res.json() as Promise<MoodAnalytics>;
}
