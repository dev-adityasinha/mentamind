"use client";

import { apiFetch } from "./client";

export interface UserSettings {
  theme: "system" | "light" | "dark";
  reminder_time: string | null;
  notifications_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  slack_notifications: boolean;
  teams_notifications: boolean;
  privacy_analytics: boolean;
  privacy_ai_coaching: boolean;
  privacy_community: boolean;
  audio_bg_volume: number;
  audio_voice_volume: number;
  language: string;
  timezone: string;
}

export interface UpdateSettingsData {
  theme?: "system" | "light" | "dark";
  reminder_time?: string | null;
  notifications_enabled?: boolean;
  email_notifications?: boolean;
  push_notifications?: boolean;
  slack_notifications?: boolean;
  teams_notifications?: boolean;
  privacy_analytics?: boolean;
  privacy_ai_coaching?: boolean;
  privacy_community?: boolean;
  audio_bg_volume?: number;
  audio_voice_volume?: number;
  language?: string;
  timezone?: string;
}

export async function getSettings(): Promise<UserSettings> {
  const res = await apiFetch("/settings");
  if (!res.ok) throw new Error("Failed to load settings");
  return res.json();
}

export async function updateSettings(data: UpdateSettingsData): Promise<UserSettings> {
  const res = await apiFetch("/settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update settings");
  return res.json();
}

export async function exportUserData(): Promise<Blob> {
  const token = (await import("./client")).getAccessToken();
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not configured. Set it in your environment variables."
    );
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${base}/auth/export`, { headers });
  if (!res.ok) throw new Error("Failed to export data");
  return res.blob();
}

export async function deleteAccount(): Promise<void> {
  const res = await apiFetch("/auth/account", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete account");
}

export async function updateConsent(data: {
  analytics: boolean;
  ai_coaching: boolean;
  community: boolean;
  version?: string;
}): Promise<void> {
  const res = await apiFetch("/auth/consent", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update consent");
}
