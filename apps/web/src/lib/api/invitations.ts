import { apiFetch } from "./client";

export type InviteRole =
  | "user"
  | "moderator"
  | "therapist"
  | "admin";

export interface Invitation {
  id: string;
  email: string;
  invited_role: InviteRole;
  status: "pending" | "accepted" | "revoked";
  expires_at: string;
  created_at: string;
}

export interface CreateInviteResponse extends Invitation {
  token: string;
}

export async function createInvite(
  email: string,
  role: InviteRole = "user",
): Promise<CreateInviteResponse> {
  const res = await apiFetch("/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(data.detail ?? "Failed to create invitation");
  }
  return res.json() as Promise<CreateInviteResponse>;
}

export async function listInvites(): Promise<Invitation[]> {
  const res = await apiFetch("/invitations");
  if (!res.ok) throw new Error("Failed to load invitations");
  return res.json() as Promise<Invitation[]>;
}

export async function revokeInvite(id: string): Promise<void> {
  const res = await apiFetch(`/invitations/${id}/revoke`, { method: "POST" });
  if (!res.ok && res.status !== 204) throw new Error("Failed to revoke invitation");
}

export async function resendInvite(id: string): Promise<void> {
  const res = await apiFetch(`/invitations/${id}/resend`, { method: "POST" });
  if (!res.ok && res.status !== 204) throw new Error("Failed to resend invitation");
}
