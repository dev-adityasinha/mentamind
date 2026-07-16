import { ApiError } from "./client";

export interface LoginPayload {
  email: string;
  password: string;
}

export type DataResidencyRegion = "in" | "eu" | "us" | "uae";

export interface RegisterOrgPayload {
  org_name: string;
  email: string;
  password: string;
  display_name: string;
  data_residency_region: DataResidencyRegion;
}

export interface AccessTokenResponse {
  access_token: string;
}

async function bffPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    let detail = "Request failed";
    if (typeof data.detail === "string") {
      detail = data.detail;
    } else if (Array.isArray(data.detail) && data.detail.length > 0) {
      detail = data.detail.map((err: any) => err.msg || "Invalid value").join(", ");
    }
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

export function loginApi(payload: LoginPayload): Promise<AccessTokenResponse> {
  return bffPost<AccessTokenResponse>("/api/auth/login", payload);
}

export function registerOrganizationApi(
  payload: RegisterOrgPayload,
): Promise<AccessTokenResponse> {
  return bffPost<AccessTokenResponse>("/api/auth/register-org", payload);
}

export function acceptInviteApi(payload: {
  token: string;
  password: string;
  display_name: string;
}): Promise<AccessTokenResponse> {
  return bffPost<AccessTokenResponse>("/api/auth/accept-invite", payload);
}

export function previewInviteApi(
  token: string,
): Promise<{ org_name: string }> {
  return bffPost<{ org_name: string }>("/api/auth/preview-invite", { token });
}

export async function logoutApi(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
