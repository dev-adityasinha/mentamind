"use client";

import { apiFetch } from "./client";

export interface CoachSession {
  id: string;
  user_id: string | null;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  crisis_detected: boolean;
  crisis_type: string | null;
  escalated: boolean;
  summary: string | null;
  meta: Record<string, unknown>;
}

export interface CoachMessage {
  id: string;
  session_id: string;
  role: string;
  content: string | null;
  sentiment_score: number | null;
  emotion_tags: string[];
  created_at: string;
}

export interface CreateSessionData {
  meta?: Record<string, unknown>;
}

export interface SendMessageData {
  content: string;
}

export async function listCoachSessions(): Promise<CoachSession[]> {
  const res = await apiFetch("/ai-coach/sessions");
  if (!res.ok) throw new Error("Failed to load coach sessions");
  return res.json();
}

export async function getCoachSession(id: string): Promise<CoachSession> {
  const res = await apiFetch(`/ai-coach/sessions/${id}`);
  if (!res.ok) throw new Error("Session not found");
  return res.json();
}

export async function createCoachSession(data?: CreateSessionData): Promise<CoachSession> {
  const res = await apiFetch("/ai-coach/sessions", {
    method: "POST",
    body: JSON.stringify(data ?? {}),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function sendCoachMessage(sessionId: string, data: SendMessageData): Promise<CoachMessage> {
  const res = await apiFetch(`/ai-coach/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

export async function listCoachMessages(sessionId: string): Promise<CoachMessage[]> {
  const res = await apiFetch(`/ai-coach/sessions/${sessionId}/messages`);
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

export async function endCoachSession(sessionId: string): Promise<CoachSession> {
  const res = await apiFetch(`/ai-coach/sessions/${sessionId}/end`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to end session");
  return res.json();
}
