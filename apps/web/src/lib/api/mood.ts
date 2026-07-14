import { apiFetch } from "./client";

export type InputMethod = "tap" | "voice" | "text";

export interface MoodCreateRequest {
  mood_score: number;
  emotion_tags?: string[];
  context_tag?: string;
  note?: string;
  input_method?: InputMethod;
}

export interface MoodResponse {
  id: string;
  mood_score: number;
  emotion_tags: string[];
  context_tag: string | null;
  note: string | null;
  input_method: InputMethod;
  logged_at: string;
  created_at: string;
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
