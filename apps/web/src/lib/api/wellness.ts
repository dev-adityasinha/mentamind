import { apiFetch } from "./client";

export type BurnoutRiskLevel = "green" | "amber" | "red";

export interface WellnessScoreResponse {
  id: string;
  score_date: string;
  composite_score: number | null;
  mood_component: number | null;
  sleep_component: number | null;
  stress_component: number | null;
  energy_component: number | null;
  activity_component: number | null;
  journaling_component: number | null;
  burnout_risk_score: number | null;
  burnout_risk_level: BurnoutRiskLevel | null;
}

export async function getWellnessScores(days: number = 30): Promise<WellnessScoreResponse[]> {
  const res = await apiFetch(`/wellness/score?days=${days}`);
  if (!res.ok) throw new Error("Failed to get wellness scores");
  return res.json() as Promise<WellnessScoreResponse[]>;
}
