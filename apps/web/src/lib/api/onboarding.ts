import type { User } from "@/lib/auth/types";
import { ApiError, apiFetch } from "./client";

export interface OnboardingCompletePayload {
  consent_analytics: boolean;
  consent_ai_coaching: boolean;
  display_name?: string;
}

export interface ConsentUpdatePayload {
  consent_analytics?: boolean;
  consent_ai_coaching?: boolean;
}

export async function completeOnboarding(
  payload: OnboardingCompletePayload,
): Promise<User> {
  const res = await apiFetch("/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const detail =
      typeof data.detail === "string" ? data.detail : "Onboarding failed";
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<User>;
}

export async function updateConsent(payload: ConsentUpdatePayload): Promise<User> {
  const res = await apiFetch("/me/consent", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const detail =
      typeof data.detail === "string" ? data.detail : "Consent update failed";
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<User>;
}
