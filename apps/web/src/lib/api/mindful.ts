"use client";

import { apiFetch } from "./client";

// Types mirror the FastAPI /mindful schemas (schemas/mindful.py).
export interface MeditationContent {
  title: string;
  duration: number;
  shortDuration?: number;
  techniques?: string[];
  audioUrl?: string | null;
  script?: string;
  description?: string;
}

export interface ReflectionContent {
  prompt: string;
  follow_up?: string;
}

export interface TaskContent {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  duration?: number;
  image?: string;
}

export interface CurriculumDay {
  day: number;
  block: number;
  title: string;
  subtitle: string;
  theme: string;
  mood_question: string;
  meditation: MeditationContent;
  reflection: ReflectionContent;
  task: TaskContent;
}

export interface CurriculumBlock {
  block: number;
  name: string;
  focus: string;
  meditation_focus: string;
  reflection_focus: string;
  task_focus: string;
  color: string;
}

export interface DailyCompletion {
  day: number;
  completion_date: string;
  meditation: boolean;
  meditation_duration: number | null;
  task: boolean;
  reflection: boolean;
}

export interface JourneyBlockProgress {
  block: number;
  name: string;
  total_days: number;
  completed_days: number;
}

export interface Journey {
  current_day: number;
  total_days: number;
  streak: number;
  completed_days: number;
  blocks: JourneyBlockProgress[];
  last_completed_at: string | null;
}

export interface CompletionUpdate {
  day: number;
  meditation?: boolean;
  meditation_duration?: number;
  task?: boolean;
  reflection?: boolean;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

// --- Curriculum (global content) ---
export async function getCurriculum(): Promise<CurriculumDay[]> {
  return json(await apiFetch("/mindful/curriculum"));
}

export async function getCurriculumBlocks(): Promise<CurriculumBlock[]> {
  return json(await apiFetch("/mindful/curriculum/blocks"));
}

export async function getCurriculumDay(day: number): Promise<CurriculumDay> {
  return json(await apiFetch(`/mindful/curriculum/${day}`));
}

// --- Daily completions (per user) ---
export async function getCompletions(): Promise<DailyCompletion[]> {
  return json(await apiFetch("/mindful/completions"));
}

export async function getCompletion(
  day: number,
): Promise<DailyCompletion | null> {
  return json(await apiFetch(`/mindful/completions/${day}`));
}

export async function markCompletion(
  update: CompletionUpdate,
): Promise<DailyCompletion> {
  return json(
    await apiFetch("/mindful/completions", {
      method: "POST",
      body: JSON.stringify(update),
    }),
  );
}

// --- Journey / progress ---
export async function getJourney(): Promise<Journey> {
  return json(await apiFetch("/mindful/journey"));
}
