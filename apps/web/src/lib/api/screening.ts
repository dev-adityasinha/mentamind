import { apiFetch } from "./client";

export interface ScreeningResultRequest {
  test_id: string;
  score: number;
  max_score: number;
  severity: string | null;
  answers?: number[];
}

export interface ScreeningResultResponse {
  id: string;
  test_id: string;
  score: number;
  severity: string | null;
  created_at: string;
}

export interface ScreeningDetailResponse {
  id: string;
  test_id: string;
  score: number;
  severity: string | null;
  metadata_answers: Record<string, unknown> | null;
  created_at: string;
}

export async function saveScreeningResult(
  data: ScreeningResultRequest
): Promise<ScreeningResultResponse> {
  const res = await apiFetch("/screening/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save screening result");
  return res.json();
}

export async function getScreeningHistory(
  days: number = 90
): Promise<ScreeningDetailResponse[]> {
  const res = await apiFetch(`/screening/history?days=${days}`);
  if (!res.ok) throw new Error("Failed to load screening history");
  return res.json();
}

export async function getScreeningHistoryForTest(
  testId: string,
  days: number = 365
): Promise<ScreeningDetailResponse[]> {
  const res = await apiFetch(`/screening/history/${testId}?days=${days}`);
  if (!res.ok) throw new Error("Failed to load screening history for test");
  return res.json();
}
