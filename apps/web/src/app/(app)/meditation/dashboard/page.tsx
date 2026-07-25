"use client";

export default function MeditationDashboardPage() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8">
      <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
      <p className="mt-2 text-text-secondary">Your streak, minutes meditated, and progress at a glance.</p>
      <p className="mt-6 inline-flex items-center rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-text-muted">
        Dashboard — wired to the backend in a later stage.
      </p>
    </div>
  );
}
