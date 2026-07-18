"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  listTracks,
  listFavorites,
  getMeditationStats,
  completeSession,
  addFavorite,
  removeFavorite,
  createTrack,
  updateTrack,
  deleteTrack,
  uploadAudio,
  type MeditationTrack,
  type MeditationStats,
  type MeditationCategory,
  type MeditationDifficulty,
  type TrackInput,
} from "@/lib/api/meditation";

const CATEGORIES: { value: MeditationCategory; label: string }[] = [
  { value: "guided", label: "Guided meditation" },
  { value: "sleep", label: "Sleep stories" },
  { value: "relaxation", label: "Relaxation" },
  { value: "focus", label: "Focus" },
  { value: "stress", label: "Stress relief" },
  { value: "anxiety", label: "Anxiety reduction" },
];

const DIFFICULTIES: MeditationDifficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
);

export default function MeditationPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { addToast } = useToast();

  const isManager = user?.role === "admin" || user?.role === "hr_manager";

  const [tracks, setTracks] = useState<MeditationTrack[]>([]);
  const [stats, setStats] = useState<MeditationStats | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<MeditationCategory | "all">("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nowPlaying, setNowPlaying] = useState<MeditationTrack | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  // Guards against double-recording a completion for a single playthrough.
  const completedRef = useRef(false);

  const loadTracks = useCallback(async () => {
    try {
      const data = await listTracks(category === "all" ? {} : { category });
      setTracks(data);
    } catch {
      addToast("Failed to load meditation library", "error");
    }
  }, [category, addToast]);

  const loadSidebar = useCallback(async () => {
    try {
      const [s, favs] = await Promise.all([
        getMeditationStats(),
        listFavorites(),
      ]);
      setStats(s);
      setFavoriteIds(new Set(favs.map((f) => f.track_id)));
    } catch {
      // Non-fatal: the library is still usable without stats/favorites.
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    Promise.all([loadTracks(), loadSidebar()]).finally(() => setLoading(false));
  }, [authLoading, loadTracks, loadSidebar]);

  const toggleFavorite = useCallback(
    async (track: MeditationTrack) => {
      const isFav = favoriteIds.has(track.id);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(track.id);
        else next.add(track.id);
        return next;
      });
      try {
        if (isFav) await removeFavorite(track.id);
        else await addFavorite(track.id);
      } catch {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (isFav) next.add(track.id);
          else next.delete(track.id);
          return next;
        });
        addToast("Could not update favorite", "error");
      }
    },
    [favoriteIds, addToast],
  );

  const play = (track: MeditationTrack) => {
    completedRef.current = false;
    setNowPlaying(track);
  };

  const handleFinished = useCallback(async () => {
    if (!nowPlaying || completedRef.current) return;
    completedRef.current = true;
    try {
      await completeSession(nowPlaying.id, nowPlaying.duration_minutes);
      addToast(
        `Session complete — ${nowPlaying.duration_minutes} min logged`,
        "success",
      );
      await loadSidebar();
    } catch {
      addToast("Session played but could not be recorded", "error");
    }
  }, [nowPlaying, addToast, loadSidebar]);

  const refreshLibrary = useCallback(async () => {
    await Promise.all([loadTracks(), loadSidebar()]);
  }, [loadTracks, loadSidebar]);

  const visibleTracks = showFavoritesOnly
    ? tracks.filter((t) => favoriteIds.has(t.id))
    : tracks;

  if (authLoading || loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-surface-raised border-t-brand" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Meditation</h1>
          <p className="mt-1 text-sm text-text-muted">
            Guided sessions, sleep stories, and more to help you unwind and focus.
          </p>
        </div>
        {isManager && (
          <Button
            variant={manageOpen ? "secondary" : "primary"}
            onClick={() => setManageOpen((v) => !v)}
          >
            {manageOpen ? "Done managing" : "Manage library"}
          </Button>
        )}
      </div>

      {/* Progress dashboard */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <ProgressStat label="Minutes meditated" value={stats?.total_minutes ?? 0} />
        <ProgressStat label="Daily streak" value={stats?.current_streak ?? 0} suffix="d" />
        <ProgressStat label="Weekly streak" value={stats?.weekly_streak ?? 0} suffix="w" />
        <ProgressStat label="Total sessions" value={stats?.total_sessions ?? 0} />
        <ProgressStat label="Favorites" value={favoriteIds.size} />
      </div>

      {/* Admin library manager */}
      {isManager && manageOpen && (
        <LibraryManager tracks={tracks} onChanged={refreshLibrary} />
      )}

      {/* Player */}
      {nowPlaying && (
        <Card className="border-brand/30">
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-brand font-semibold">
                  Now playing · {CATEGORY_LABEL[nowPlaying.category] ?? nowPlaying.category}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-text-primary truncate">
                  {nowPlaying.title}
                </h3>
                <p className="text-sm text-text-muted">
                  {nowPlaying.duration_minutes} min · {nowPlaying.difficulty}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setNowPlaying(null)}>
                Close
              </Button>
            </div>
            <audio
              key={nowPlaying.id}
              src={nowPlaying.audio_url}
              controls
              autoPlay
              onEnded={handleFinished}
              className="mt-4 w-full"
            >
              Your browser does not support the audio element.
            </audio>
            <p className="mt-2 text-xs text-text-muted">
              Your progress is recorded automatically when the track finishes.
            </p>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
          All
        </FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip
            key={c.value}
            active={category === c.value}
            onClick={() => setCategory(c.value)}
          >
            {c.label}
          </FilterChip>
        ))}
        <div className="ml-auto">
          <FilterChip
            active={showFavoritesOnly}
            onClick={() => setShowFavoritesOnly((v) => !v)}
          >
            ★ Favorites
          </FilterChip>
        </div>
      </div>

      {/* Library */}
      {visibleTracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <p className="text-lg">
            {showFavoritesOnly ? "No favorites yet." : "No sessions in this category yet."}
          </p>
          <p className="mt-1 text-sm">
            {showFavoritesOnly
              ? "Tap the star on any session to save it here."
              : "Check back soon — new sessions are added regularly."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              isFavorite={favoriteIds.has(track.id)}
              isPlaying={nowPlaying?.id === track.id}
              onPlay={() => play(track)}
              onToggleFavorite={() => toggleFavorite(track)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <Card>
      <div className="p-4">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold text-text-primary">
          {value.toLocaleString()}
          {suffix && <span className="ml-0.5 text-base font-medium text-text-muted">{suffix}</span>}
        </p>
      </div>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
        active
          ? "bg-brand-subtle text-brand border-brand/30"
          : "bg-surface-raised text-text-secondary hover:bg-border border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

function TrackCard({
  track,
  isFavorite,
  isPlaying,
  onPlay,
  onToggleFavorite,
}: {
  track: MeditationTrack;
  isFavorite: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <Card className={isPlaying ? "border-brand/40" : ""}>
      <div className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center rounded-full bg-brand-subtle px-2 py-0.5 text-xs font-medium text-brand">
            {CATEGORY_LABEL[track.category] ?? track.category}
          </span>
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={isFavorite}
            className={`text-lg leading-none transition-colors ${
              isFavorite ? "text-brand" : "text-text-muted hover:text-brand"
            }`}
          >
            {isFavorite ? "★" : "☆"}
          </button>
        </div>
        <h3 className="mt-3 text-base font-semibold text-text-primary">{track.title}</h3>
        <p className="mt-1 flex-1 text-sm text-text-secondary leading-relaxed">
          {track.description}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-text-muted capitalize">
            {track.duration_minutes} min · {track.difficulty}
          </span>
          <Button variant="primary" size="sm" onClick={onPlay}>
            {isPlaying ? "Playing" : "Play"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Admin: library manager                                                     */
/* -------------------------------------------------------------------------- */

const EMPTY_FORM: TrackInput = {
  title: "",
  description: "",
  audio_url: "",
  duration_minutes: 10,
  category: "guided",
  difficulty: "beginner",
};

function LibraryManager({
  tracks,
  onChanged,
}: {
  tracks: MeditationTrack[];
  onChanged: () => Promise<void>;
}) {
  const { addToast } = useToast();
  const [form, setForm] = useState<TrackInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (t: MeditationTrack) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description,
      audio_url: t.audio_url,
      duration_minutes: t.duration_minutes,
      category: t.category,
      difficulty: t.difficulty,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { audio_url } = await uploadAudio(file);
      setForm((f) => ({ ...f, audio_url }));
      addToast("Audio uploaded", "success");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.audio_url.trim()) {
      addToast("Title, description and audio are required", "error");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateTrack(editingId, form);
        addToast("Session updated", "success");
      } else {
        await createTrack(form);
        addToast("Session added", "success");
      }
      resetForm();
      await onChanged();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: MeditationTrack) => {
    if (!confirm(`Delete "${t.title}"? This cannot be undone.`)) return;
    try {
      await deleteTrack(t.id);
      addToast("Session deleted", "success");
      if (editingId === t.id) resetForm();
      await onChanged();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  };

  return (
    <Card className="border-brand/30">
      <div className="p-6 space-y-5">
        <h2 className="text-lg font-semibold text-text-primary">
          {editingId ? "Edit session" : "Add a session"}
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Title">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
              placeholder="Morning Grounding"
            />
          </Field>
          <Field label="Duration (minutes)">
            <input
              type="number"
              min={1}
              max={600}
              value={form.duration_minutes}
              onChange={(e) =>
                setForm({ ...form, duration_minutes: Number(e.target.value) })
              }
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
            />
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as MeditationCategory })
              }
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Difficulty">
            <select
              value={form.difficulty}
              onChange={(e) =>
                setForm({ ...form, difficulty: e.target.value as MeditationDifficulty })
              }
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary capitalize focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
            placeholder="A gentle guided meditation to center yourself…"
          />
        </Field>

        <Field label="Audio">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={form.audio_url}
              onChange={(e) => setForm({ ...form, audio_url: e.target.value })}
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
              placeholder="Paste an audio URL, or upload a file →"
            />
            <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised">
              {uploading ? "Uploading…" : "Upload file"}
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleUpload(e.target.files?.[0])}
              />
            </label>
          </div>
        </Field>

        <div className="flex justify-end gap-2">
          {editingId && (
            <Button variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          )}
          <Button variant="primary" onClick={handleSave} isLoading={saving}>
            {editingId ? "Save changes" : "Add session"}
          </Button>
        </div>

        {/* Existing sessions list */}
        <div className="border-t border-border pt-4">
          <h3 className="mb-3 text-sm font-semibold text-text-secondary">
            Existing sessions ({tracks.length})
          </h3>
          {tracks.length === 0 ? (
            <p className="text-sm text-text-muted">No sessions yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tracks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {t.title}
                    </p>
                    <p className="text-xs text-text-muted">
                      {CATEGORY_LABEL[t.category] ?? t.category} · {t.duration_minutes} min ·{" "}
                      {t.difficulty}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(t)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(t)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}
