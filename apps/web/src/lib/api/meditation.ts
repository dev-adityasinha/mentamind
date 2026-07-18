"use client";

import { apiFetch } from "./client";

export type MeditationCategory =
  | "guided"
  | "sleep"
  | "relaxation"
  | "focus"
  | "stress"
  | "anxiety";

export type MeditationDifficulty = "beginner" | "intermediate" | "advanced";

export interface MeditationTrack {
  id: string;
  title: string;
  description: string;
  audio_url: string;
  duration_minutes: number;
  category: MeditationCategory;
  difficulty: MeditationDifficulty;
  created_at: string;
}

export interface MeditationStats {
  user_id: string;
  total_minutes: number;
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  weekly_streak: number;
  longest_weekly_streak: number;
  last_meditated_at: string | null;
}

export interface MeditationHistory {
  id: string;
  user_id: string;
  track_id: string;
  duration_minutes: number;
  completed_at: string;
  track: MeditationTrack;
}

export interface MeditationFavorite {
  id: string;
  user_id: string;
  track_id: string;
  created_at: string;
  track: MeditationTrack;
}

// --- Library ---

export async function listTracks(
  opts: { category?: MeditationCategory; difficulty?: MeditationDifficulty } = {},
): Promise<MeditationTrack[]> {
  const params = new URLSearchParams();
  if (opts.category) params.append("category", opts.category);
  if (opts.difficulty) params.append("difficulty", opts.difficulty);
  const qs = params.toString();
  const res = await apiFetch(`/meditation/tracks${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to load meditation library");
  return res.json();
}

export async function getTrack(id: string): Promise<MeditationTrack> {
  const res = await apiFetch(`/meditation/tracks/${id}`);
  if (!res.ok) throw new Error("Track not found");
  return res.json();
}

// --- Progress ---

export async function getMeditationStats(): Promise<MeditationStats> {
  const res = await apiFetch("/meditation/stats");
  if (!res.ok) throw new Error("Failed to load meditation stats");
  return res.json();
}

export async function completeSession(
  trackId: string,
  durationMinutes: number,
): Promise<MeditationHistory> {
  const res = await apiFetch("/meditation/history", {
    method: "POST",
    body: JSON.stringify({ track_id: trackId, duration_minutes: durationMinutes }),
  });
  if (!res.ok) throw new Error("Failed to record session");
  return res.json();
}

// --- Favorites ---

export async function listFavorites(): Promise<MeditationFavorite[]> {
  const res = await apiFetch("/meditation/favorites");
  if (!res.ok) throw new Error("Failed to load favorites");
  return res.json();
}

export async function addFavorite(trackId: string): Promise<MeditationFavorite> {
  const res = await apiFetch("/meditation/favorites", {
    method: "POST",
    body: JSON.stringify({ track_id: trackId }),
  });
  if (!res.ok) throw new Error("Failed to add favorite");
  return res.json();
}

export async function removeFavorite(trackId: string): Promise<void> {
  const res = await apiFetch(`/meditation/favorites/${trackId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to remove favorite");
}

// --- Library management (admin only) ---

export interface TrackInput {
  title: string;
  description: string;
  audio_url: string;
  duration_minutes: number;
  category: MeditationCategory;
  difficulty: MeditationDifficulty;
}

export async function createTrack(input: TrackInput): Promise<MeditationTrack> {
  const res = await apiFetch("/meditation/tracks", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function updateTrack(
  id: string,
  input: Partial<TrackInput>,
): Promise<MeditationTrack> {
  const res = await apiFetch(`/meditation/tracks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to update session");
  return res.json();
}

export async function deleteTrack(id: string): Promise<void> {
  const res = await apiFetch(`/meditation/tracks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete session");
}

export async function uploadAudio(file: File): Promise<{ audio_url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch("/meditation/upload-audio", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    let detail = "Failed to upload audio";
    try {
      const data = await res.json();
      if (data?.detail) detail = data.detail;
    } catch {
      // ignore JSON parse errors; keep the default message
    }
    throw new Error(detail);
  }
  return res.json();
}
