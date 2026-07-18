import type { User } from "@/lib/auth/types";
import { ApiError, apiFetch } from "./client";

export async function getMe(): Promise<User> {
  const res = await apiFetch("/me");
  if (!res.ok) {
    throw new ApiError(res.status, "Failed to load user");
  }
  return res.json() as Promise<User>;
}

export async function listUsers(): Promise<User[]> {
  const res = await apiFetch("/users");
  if (!res.ok) {
    throw new ApiError(res.status, "Failed to load users");
  }
  return res.json() as Promise<User[]>;
}

export interface UserProfile {
  id: string;
  display_name: string;
  username: string | null;
  age: number | null;
  gender: string | null;
  country: string | null;
  avatar_url: string | null;
  mental_health_goals: string[];
}

export interface UpdateProfileData {
  display_name?: string;
  username?: string;
  age?: number | null;
  gender?: string | null;
  country?: string | null;
  avatar_url?: string | null;
  mental_health_goals?: string[];
}

export async function getMyProfile(): Promise<UserProfile> {
  const res = await apiFetch("/me/profile");
  if (!res.ok) throw new ApiError(res.status, "Failed to load profile");
  return res.json() as Promise<UserProfile>;
}

export async function updateMyProfile(
  data: UpdateProfileData,
): Promise<UserProfile> {
  const res = await apiFetch("/me/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let detail = "Failed to update profile";
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // keep default message
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<UserProfile>;
}
