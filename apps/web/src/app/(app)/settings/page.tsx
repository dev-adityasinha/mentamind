"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  getSettings,
  updateSettings,
  exportUserData,
  deleteAccount,
  updateConsent,
  type UserSettings,
  type UpdateSettingsData,
} from "@/lib/api/settings";
import {
  getMyProfile,
  updateMyProfile,
  type UserProfile,
} from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/Context";
import { useTheme } from "next-themes";

const GOAL_OPTIONS = [
  "Reduce stress",
  "Sleep better",
  "Manage anxiety",
  "Build focus",
  "Improve mood",
  "Work-life balance",
  "Practice gratitude",
  "Feel more connected",
];

const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { logout, isLoading: authLoading } = useAuth();
  const { addToast } = useToast();
  const { setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (authLoading || hasLoadedRef.current) return;
    async function load() {
      try {
        hasLoadedRef.current = true;
        const [data, prof] = await Promise.all([getSettings(), getMyProfile()]);
        setSettings(data);
        setProfile(prof);
        // NOTE: do NOT call setTheme(data.theme) here. next-themes already
        // restores the user's chosen theme (from its own localStorage) on every
        // page load. Overriding it with the server value forced the theme back
        // to the DB default ("system") every time the Settings tab opened.
      } catch {
        addToast("Failed to load settings", "error");
        hasLoadedRef.current = false;
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, addToast, setTheme]);

  const handleSave = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await updateSettings(settings as UpdateSettingsData);
      setSettings(updated);
      addToast("Settings saved!", "success");
    } catch {
      addToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }, [settings, addToast]);

  const handleSaveProfile = useCallback(async () => {
    if (!profile) return;
    setSavingProfile(true);
    try {
      const updated = await updateMyProfile({
        display_name: profile.display_name?.trim() || undefined,
        username: profile.username?.trim() || undefined,
        age: profile.age,
        gender: profile.gender,
        country: profile.country,
        avatar_url: profile.avatar_url,
        mental_health_goals: profile.mental_health_goals,
      });
      setProfile(updated);
      setEditingProfile(false);
      addToast("Profile saved!", "success");
    } catch (err) {
      addToast(
        err instanceof ApiError ? err.message : "Failed to save profile",
        "error",
      );
    } finally {
      setSavingProfile(false);
    }
  }, [profile, addToast]);

  const handleCancelProfile = useCallback(async () => {
    try {
      const fresh = await getMyProfile();
      setProfile(fresh);
    } catch {
      // Keep the current values if the reload fails; the user can retry.
    } finally {
      setEditingProfile(false);
    }
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await exportUserData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mentamind-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast("Data exported successfully!", "success");
    } catch {
      addToast("Failed to export data", "error");
    } finally {
      setExporting(false);
    }
  }, [addToast]);

  const handleDeleteAccount = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      await logout();
      addToast("Account deleted. Sorry to see you go.", "info");
      router.replace("/login");
    } catch {
      addToast("Failed to delete account", "error");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [logout, addToast, router]);

  const handleConsentChange = useCallback(
    async (key: "analytics" | "ai_coaching" | "community", value: boolean) => {
      if (!settings) return;
      const updated = { ...settings };
      if (key === "analytics") updated.privacy_analytics = value;
      if (key === "ai_coaching") updated.privacy_ai_coaching = value;
      if (key === "community") updated.privacy_community = value;
      setSettings(updated);
      try {
        await updateConsent({
          analytics: updated.privacy_analytics,
          ai_coaching: updated.privacy_ai_coaching,
          community: updated.privacy_community,
        });
        addToast("Consent updated", "success");
      } catch {
        addToast("Failed to update consent", "error");
        setSettings(settings);
      }
    },
    [settings, addToast],
  );

  if (authLoading || loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-surface-raised border-t-brand" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex h-[400px] items-center justify-center text-text-muted">
        Could not load settings.
      </div>
    );
  }

  const toggle = (key: keyof UserSettings) => {
    setSettings((prev) => (prev ? { ...prev, [key]: !prev[key] } : prev));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-muted">Manage your preferences and privacy.</p>
      </div>

      {/* Profile */}
      {profile && (
        <Card>
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">Profile</h2>
            <p className="text-sm text-text-muted">
              This information personalises your experience. Only your display
              name and (if set) username are visible to others.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-text-secondary">Display name</label>
                <input
                  type="text"
                  value={profile.display_name ?? ""}
                  onChange={(e) =>
                    setProfile((p) => (p ? { ...p, display_name: e.target.value } : p))
                  }
                  disabled={!editingProfile}
                  className="mt-2 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Username</label>
                <input
                  type="text"
                  value={profile.username ?? ""}
                  onChange={(e) =>
                    setProfile((p) => (p ? { ...p, username: e.target.value } : p))
                  }
                  disabled={!editingProfile}
                  className="mt-2 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="jane_smith"
                />
                <p className="mt-1 text-xs text-text-muted">
                  3–30 characters: letters, numbers, _ or -.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Age</label>
                <input
                  type="number"
                  min={13}
                  max={120}
                  value={profile.age ?? ""}
                  onChange={(e) =>
                    setProfile((p) =>
                      p ? { ...p, age: e.target.value ? Number(e.target.value) : null } : p,
                    )
                  }
                  disabled={!editingProfile}
                  className="mt-2 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="—"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Gender</label>
                <select
                  value={profile.gender ?? ""}
                  onChange={(e) =>
                    setProfile((p) => (p ? { ...p, gender: e.target.value || null } : p))
                  }
                  disabled={!editingProfile}
                  className="mt-2 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Prefer not to say</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Country</label>
                <input
                  type="text"
                  maxLength={2}
                  value={profile.country ?? ""}
                  onChange={(e) =>
                    setProfile((p) =>
                      p ? { ...p, country: e.target.value.toUpperCase() || null } : p,
                    )
                  }
                  disabled={!editingProfile}
                  className="mt-2 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="IN"
                />
                <p className="mt-1 text-xs text-text-muted">2-letter country code.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Avatar URL</label>
                <input
                  type="url"
                  value={profile.avatar_url ?? ""}
                  onChange={(e) =>
                    setProfile((p) => (p ? { ...p, avatar_url: e.target.value || null } : p))
                  }
                  disabled={!editingProfile}
                  className="mt-2 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="https://…"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-text-secondary">
                Mental health goals
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((goal) => {
                  const selected = profile.mental_health_goals.includes(goal);
                  return (
                    <button
                      key={goal}
                      type="button"
                      disabled={!editingProfile}
                      onClick={() =>
                        setProfile((p) =>
                          p
                            ? {
                                ...p,
                                mental_health_goals: selected
                                  ? p.mental_health_goals.filter((g) => g !== goal)
                                  : [...p.mental_health_goals, goal],
                              }
                            : p,
                        )
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        selected
                          ? "border-brand bg-brand-subtle text-brand"
                          : "border-border bg-surface text-text-secondary enabled:hover:bg-surface-raised"
                      }`}
                    >
                      {goal}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              {editingProfile ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={handleCancelProfile}
                    disabled={savingProfile}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSaveProfile}
                    isLoading={savingProfile}
                  >
                    Save profile
                  </Button>
                </>
              ) : (
                <Button variant="primary" onClick={() => setEditingProfile(true)}>
                  Edit
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Appearance */}
      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Appearance</h2>
          <div>
            <label className="text-sm font-medium text-text-secondary">Theme</label>
            <div className="mt-2 flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setSettings((s) => (s ? { ...s, theme: t.value } : s));
                    setTheme(t.value);
                    updateSettings({ theme: t.value }).catch(() => {});
                  }}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                    theme === t.value
                      ? "border-brand bg-brand-subtle text-brand"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-raised"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary">Language</label>
            <select
              value={settings.language}
              onChange={(e) => {
                const val = e.target.value as "en" | "es";
                setSettings((s) => (s ? { ...s, language: val } : s));
                setLocale(val);
                updateSettings({ language: val }).catch(() => {});
              }}
              className="mt-2 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Notifications</h2>
          <div className="space-y-3">
            {([
              ["notifications_enabled", "Enable notifications"],
              ["email_notifications", "Email notifications"],
              ["push_notifications", "Push notifications"],
              ["slack_notifications", "Slack notifications"],
              ["teams_notifications", "Teams notifications"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between">
                <span className="text-sm text-text-primary">{label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!settings[key]}
                  onClick={() => toggle(key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings[key] ? "bg-brand" : "bg-border-strong"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings[key] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary">Reminder time</label>
            <input
              type="time"
              value={settings.reminder_time ?? ""}
              onChange={(e) =>
                setSettings((s) =>
                  s ? { ...s, reminder_time: e.target.value || null } : s,
                )
              }
              className="mt-2 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
            />
          </div>
        </div>
      </Card>

      {/* Privacy & Consent */}
      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Privacy & Consent</h2>
          <p className="text-sm text-text-muted">
            You can withdraw or grant consent at any time. Changes are logged for compliance.
          </p>
          <div className="space-y-3">
            {([
              ["privacy_analytics", "Analytics & insights", "Allow anonymous data analysis to improve your experience"],
              ["privacy_ai_coaching", "AI coaching", "Allow AI to analyze your mood patterns for personalized coaching"],
              ["privacy_community", "Community features", "Allow you to participate in the anonymous community forum"],
            ] as const).map(([key, title, desc]) => (
              <div key={key} className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{title}</p>
                  <p className="text-xs text-text-muted">{desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!settings[key as keyof UserSettings]}
                  onClick={() => {
                    if (key === "privacy_analytics") handleConsentChange("analytics", !settings.privacy_analytics);
                    if (key === "privacy_ai_coaching") handleConsentChange("ai_coaching", !settings.privacy_ai_coaching);
                    if (key === "privacy_community") handleConsentChange("community", !settings.privacy_community);
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    settings[key as keyof UserSettings] ? "bg-brand" : "bg-border-strong"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings[key as keyof UserSettings] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave} isLoading={saving}>
          Save changes
        </Button>
      </div>

      {/* GDPR */}
      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Your Data</h2>
          <p className="text-sm text-text-muted">
            You can export all your data or permanently delete your account.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={handleExport} isLoading={exporting}>
              Export my data
            </Button>
            {!showDeleteConfirm ? (
              <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                Delete account
              </Button>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive-subtle p-3 w-full">
                <p className="text-sm text-destructive flex-1">
                  Are you sure? This cannot be undone.
                </p>
                <Button variant="destructive" size="sm" onClick={handleDeleteAccount} isLoading={deleting}>
                  Confirm delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
