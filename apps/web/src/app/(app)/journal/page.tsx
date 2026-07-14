"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  listJournalEntries,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  type JournalEntry,
} from "@/lib/api/journal";

const MOOD_LABELS: Record<number, string> = {
  1: "Very low",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

const ALL_EMOTIONS = [
  "calm", "happy", "anxious", "stressed", "sad", "frustrated",
  "grateful", "excited", "tired", "overwhelmed", "motivated",
  "lonely", "proud", "irritable", "hopeful",
];

export default function JournalPage() {
  const { isLoading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [emotionTags, setEmotionTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      const data = await listJournalEntries();
      setEntries(data);
    } catch {
      addToast("Failed to load journal entries", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (authLoading) return;
    loadEntries();
  }, [authLoading, loadEntries]);

  const resetForm = () => {
    setContent("");
    setMoodScore(null);
    setEmotionTags([]);
    setShowCreate(false);
    setEditingId(null);
  };

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await updateJournalEntry(editingId, { content, mood_score: moodScore, emotion_tags: emotionTags });
        addToast("Entry updated!", "success");
      } else {
        await createJournalEntry({ content, mood_score: moodScore, emotion_tags: emotionTags });
        addToast("Entry created!", "success");
      }
      resetForm();
      await loadEntries();
    } catch {
      addToast("Failed to save entry", "error");
    } finally {
      setSubmitting(false);
    }
  }, [content, moodScore, emotionTags, editingId, addToast, loadEntries]);

  const handleEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setContent("");
    setMoodScore(entry.mood_score);
    setEmotionTags(entry.emotion_tags);
    setShowCreate(true);
  };

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteJournalEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      addToast("Entry deleted", "success");
    } catch {
      addToast("Failed to delete entry", "error");
    }
    setDeleteId(null);
  }, [addToast]);

  const toggleEmotion = (emotion: string) => {
    setEmotionTags((prev) =>
      prev.includes(emotion) ? prev.filter((e) => e !== emotion) : [...prev, emotion],
    );
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-surface-raised border-t-brand" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Journal</h1>
          <p className="mt-1 text-sm text-text-muted">
            Write down your thoughts and reflections.
          </p>
        </div>
        <Button variant="primary" onClick={() => { resetForm(); setShowCreate(true); }}>
          New entry
        </Button>
      </div>

      {/* Create / Edit form */}
      {showCreate && (
        <Card>
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">
              {editingId ? "Edit entry" : "New entry"}
            </h2>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              rows={5}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20 resize-none"
            />
            <div>
              <label className="text-sm font-medium text-text-secondary">Mood (optional)</label>
              <div className="mt-2 flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setMoodScore(moodScore === s ? null : s)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                      moodScore === s
                        ? "bg-brand text-brand-foreground"
                        : "bg-surface-raised text-text-secondary hover:bg-border"
                    }`}
                    title={MOOD_LABELS[s]}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary">Emotions (optional)</label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ALL_EMOTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => toggleEmotion(e)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      emotionTags.includes(e)
                        ? "bg-brand-subtle text-brand border border-brand/30"
                        : "bg-surface-raised text-text-secondary hover:bg-border border border-transparent"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={resetForm}>Cancel</Button>
              <Button variant="primary" onClick={handleSubmit} isLoading={submitting} disabled={!content.trim()}>
                {editingId ? "Update" : "Save"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Entry list */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <p className="text-lg">No journal entries yet.</p>
          <p className="mt-1 text-sm">Click &quot;New entry&quot; to write your first one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-text-muted mb-1.5">
                      <span>{new Date(entry.created_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}</span>
                      <span>·</span>
                      <span>{entry.word_count} words</span>
                      {entry.mood_score && (
                        <>
                          <span>·</span>
                          <span>Mood: {entry.mood_score}/5</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-text-primary leading-relaxed">
                      {entry.entry_type === "text" ? "Journal entry" : entry.entry_type}
                    </p>
                    {entry.emotion_tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {entry.emotion_tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full bg-brand-subtle px-2 py-0.5 text-xs font-medium text-brand"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)}>
                      Edit
                    </Button>
                    {deleteId === entry.id ? (
                      <div className="flex items-center gap-1">
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(entry.id)}>
                          Confirm
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(entry.id)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
