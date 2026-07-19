"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/Toast";
import {
  type CreateInviteResponse,
  type Invitation,
  type InviteRole,
  createInvite,
  listInvites,
  revokeInvite,
  resendInvite,
} from "@/lib/api/invitations";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_BASE = typeof window !== "undefined" ? window.location.origin : "";

function buildInviteLink(token: string): string {
  return `${INVITE_BASE}/join/${token}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function InvitesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("user");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newInvite, setNewInvite] = useState<CreateInviteResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const isAllowed =
    user?.role === "admin" || user?.role === "hr_manager";

  const loadInvites = useCallback(async () => {
    try {
      const data = await listInvites();
      setInvites(data);
      setListError(null);
    } catch {
      setListError("Could not load invitations.");
    }
  }, []);

  useEffect(() => {
    if (isAllowed) void loadInvites();
  }, [isAllowed, loadInvites]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEmailError(null);
    setCreateError(null);
    setNewInvite(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Email is required");
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError("Enter a valid email address");
      return;
    }

    setIsCreating(true);
    try {
      const inv = await createInvite(trimmed, role);
      setNewInvite(inv);
      setEmail("");
      await loadInvites();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create invitation";
      if (msg.toLowerCase().includes("already exists")) {
        setCreateError("A pending invitation for this email already exists.");
      } else if (msg.toLowerCase().includes("member")) {
        setCreateError("This person is already a member of your organization.");
      } else {
        setCreateError(msg);
      }
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    try {
      await revokeInvite(id);
      await loadInvites();
      if (newInvite?.id === id) setNewInvite(null);
    } catch {
      // Keep going - the list will still show the invite
    } finally {
      setRevokingId(null);
    }
  }

  async function handleResend(id: string) {
    setResendingId(id);
    try {
      await resendInvite(id);
      addToast("Invitation resent successfully", "success");
      await loadInvites();
    } catch {
      addToast("Failed to resend invitation", "error");
    } finally {
      setResendingId(null);
    }
  }

  async function handleCopy(token: string) {
    await navigator.clipboard.writeText(buildInviteLink(token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isAllowed) {
    return (
      <div className="text-sm text-text-secondary">
        You do not have permission to manage invitations.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold text-text-primary">Invite teammates</h1>

      <Card>
        <div className="p-6">
          <form onSubmit={handleCreate} noValidate aria-label="Send invitation form">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <FormField id="invite-email" label="Email address" error={emailError ?? undefined} required>
                  <Input
                    id="invite-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isCreating}
                    placeholder="colleague@company.com"
                  />
                </FormField>
              </div>
              <div>
                <FormField id="invite-role" label="Role" required>
                  <select
                    id="invite-role"
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    value={role}
                    onChange={(e) => setRole(e.target.value as InviteRole)}
                    disabled={isCreating}
                  >
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="therapist">Therapist (Placeholder)</option>
                    <option value="admin">Admin</option>
                  </select>
                </FormField>
              </div>
            </div>
            {createError && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {createError}
              </p>
            )}
            <Button
              type="submit"
              className="mt-4"
              isLoading={isCreating}
              disabled={isCreating}
            >
              Send invite
            </Button>
          </form>

          {newInvite && (
            <div className="mt-4 rounded-md border border-border bg-surface p-4 space-y-2">
              <p className="text-sm text-text-secondary">
                Invite created for <span className="font-medium text-text-primary">{newInvite.email}</span>.
                Share this link:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-xs bg-bg rounded px-2 py-1 text-text-primary border border-border">
                  {buildInviteLink(newInvite.token)}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(newInvite.token)}
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-text-muted">
                Expires {formatDate(newInvite.expires_at)}. The link works only once.
              </p>
            </div>
          )}
        </div>
      </Card>

      <div>
        <h2 className="text-base font-medium text-text-primary mb-3">
          Invitation History
        </h2>
        {listError && (
          <p className="text-sm text-destructive">{listError}</p>
        )}
        {!listError && invites.length === 0 && (
          <p className="text-sm text-text-muted">No invitations found.</p>
        )}
        {invites.length > 0 && (
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {inv.email}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        inv.status === "accepted"
                          ? "bg-success-subtle text-success"
                          : inv.status === "pending"
                          ? "bg-brand-subtle text-brand"
                          : "bg-surface-raised text-text-muted border border-border"
                      }`}
                    >
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">
                    {inv.invited_role} &bull; sent {formatDate(inv.created_at)} 
                    {inv.status === "pending" && ` (expires ${formatDate(inv.expires_at)})`}
                  </p>
                </div>
                {inv.status === "pending" && (
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      isLoading={resendingId === inv.id}
                      disabled={resendingId === inv.id || revokingId === inv.id}
                      onClick={() => handleResend(inv.id)}
                    >
                      Resend
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      isLoading={revokingId === inv.id}
                      disabled={revokingId === inv.id || resendingId === inv.id}
                      onClick={() => handleRevoke(inv.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
