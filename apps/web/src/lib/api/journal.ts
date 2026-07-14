"use client";

import { apiFetch } from "./client";

export interface JournalEntry {
  id: string;
  entry_type: "text" | "voice" | "gratitude" | "ai_reflection";
  mood_score: number | null;
  emotion_tags: string[];
  word_count: number;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateJournalData {
  content: string;
  entry_type?: "text" | "voice" | "gratitude" | "ai_reflection";
  prompt?: string | null;
  mood_score?: number | null;
  emotion_tags?: string[];
  duration_seconds?: number | null;
}

export interface UpdateJournalData {
  content?: string;
  prompt?: string | null;
  mood_score?: number | null;
  emotion_tags?: string[];
}

export async function listJournalEntries(days = 30): Promise<JournalEntry[]> {
  const res = await apiFetch(`/journal?days=${days}`);
  if (!res.ok) throw new Error("Failed to load journal entries");
  return res.json();
}

export async function getJournalEntry(id: string): Promise<JournalEntry> {
  const res = await apiFetch(`/journal/${id}`);
  if (!res.ok) throw new Error("Journal entry not found");
  return res.json();
}

export async function createJournalEntry(data: CreateJournalData): Promise<JournalEntry> {
  const res = await apiFetch("/journal", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create journal entry");
  return res.json();
}

export async function updateJournalEntry(id: string, data: UpdateJournalData): Promise<JournalEntry> {
  const res = await apiFetch(`/journal/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update journal entry");
  return res.json();
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const res = await apiFetch(`/journal/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete journal entry");
}
