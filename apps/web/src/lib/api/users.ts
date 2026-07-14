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
