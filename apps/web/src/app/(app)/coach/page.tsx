"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import {
  listCoachSessions,
  getCoachSession,
  createCoachSession,
  sendCoachMessage,
  listCoachMessages,
  endCoachSession,
  type CoachSession,
  type CoachMessage,
} from "@/lib/api/coach";
import { MicrophoneButton } from "@/components/ui/MicrophoneButton";
import { Volume2, VolumeX, RefreshCw, Sparkles } from "lucide-react";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CoachPage() {
  const { isLoading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [activeSession, setActiveSession] = useState<CoachSession | null>(null);
  const [readAloud, setReadAloud] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice synthesis effect
  useEffect(() => {
    if (readAloud && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "assistant" && typeof window !== "undefined") {
        const synth = window.speechSynthesis;
        if (synth && !synth.speaking) {
          const utterance = new SpeechSynthesisUtterance(lastMsg.content || "");
          utterance.lang = "en-US";
          synth.speak(utterance);
        }
      }
    }
  }, [messages, readAloud]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSessions = useCallback(async () => {
    try {
      const data = await listCoachSessions();
      setSessions(data);
    } catch {
      addToast("Failed to load sessions", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (authLoading) return;
    loadSessions();
  }, [authLoading, loadSessions]);

  const loadMessages = useCallback(async (sessionId: string) => {
    setMessagesLoading(true);
    try {
      const [msgs, session] = await Promise.all([
        listCoachMessages(sessionId),
        getCoachSession(sessionId),
      ]);
      setMessages(msgs);
      setActiveSession(session);
    } catch {
      addToast("Failed to load messages", "error");
    } finally {
      setMessagesLoading(false);
    }
  }, [addToast]);

  const selectSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    await loadMessages(sessionId);
  }, [loadMessages]);

  const handleNewSession = useCallback(async () => {
    setCreatingSession(true);
    try {
      const session = await createCoachSession();
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      setMessages([]);
      setActiveSession(session);
    } catch {
      addToast("Failed to create session", "error");
    } finally {
      setCreatingSession(false);
    }
  }, [addToast]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeSessionId) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    const optimistic: CoachMessage = {
      id: "temp-" + Date.now(),
      session_id: activeSessionId,
      role: "user",
      content: text,
      sentiment_score: null,
      emotion_tags: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const aiMsg = await sendCoachMessage(activeSessionId, { content: text });
      setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), {
        id: optimistic.id,
        session_id: optimistic.session_id,
        role: "user",
        content: text,
        sentiment_score: null,
        emotion_tags: [],
        created_at: optimistic.created_at,
      }, aiMsg]);
      setActiveSession((s) => s ? { ...s, message_count: (s.message_count || 0) + 2 } : s);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      addToast("Failed to send message", "error");
    } finally {
      setSending(false);
    }
  }, [input, activeSessionId, addToast]);

  const handleEndSession = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const updated = await endCoachSession(activeSessionId);
      setActiveSession(updated);
      setSessions((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
      addToast("Session ended", "info");
    } catch {
      addToast("Failed to end session", "error");
    }
  }, [activeSessionId, addToast]);

  if (authLoading || loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-surface-raised border-t-brand" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-text-primary">
            AI{" "}
            <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">
              Companion
            </span>
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            A supportive listener, available 24/7
          </p>
        </div>
        <button
          type="button"
          onClick={handleNewSession}
          disabled={creatingSession}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-violet-600 disabled:opacity-50"
        >
          <RefreshCw size={16} className={creatingSession ? "animate-spin" : ""} />
          New Chat
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Sessions sidebar (kept) */}
        <div className="md:col-span-1">
          <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Sessions
            </h2>
            {sessions.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-muted">
                No sessions yet.
              </p>
            ) : (
              <div className="max-h-[500px] space-y-1 overflow-y-auto">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectSession(s.id)}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      activeSessionId === s.id
                        ? "bg-violet-500/10 text-violet-600"
                        : "text-text-secondary hover:bg-surface-raised"
                    }`}
                  >
                    <div className="truncate font-medium">
                      {formatDate(s.started_at)}
                    </div>
                    <div className="mt-0.5 text-xs text-text-muted">
                      {s.message_count} messages
                      {s.ended_at && " · Ended"}
                      {s.crisis_detected && " ⚠️"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="md:col-span-2">
          {!activeSessionId ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-surface py-16 text-text-muted shadow-sm">
              <p className="text-lg">Select a session or start a new one.</p>
              <p className="mt-1 text-sm">Your conversations are private and encrypted.</p>
            </div>
          ) : (
            <div className="flex h-[600px] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div>
                  <span className="text-sm font-medium text-text-primary">
                    Session {formatDate(activeSession?.started_at ?? activeSessionId)}
                  </span>
                  {activeSession?.ended_at && (
                    <span className="ml-2 text-xs text-text-muted">(ended)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReadAloud(!readAloud);
                      if (readAloud && typeof window !== "undefined") {
                        window.speechSynthesis?.cancel();
                      }
                    }}
                    className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-raised hover:text-violet-600"
                    aria-label={readAloud ? "Disable read aloud" : "Enable read aloud"}
                    title="Read AI messages aloud"
                  >
                    {readAloud ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>
                  {activeSession && !activeSession.ended_at && (
                    <Button variant="ghost" size="sm" onClick={handleEndSession}>
                      End session
                    </Button>
                  )}
                </div>
              </div>

              {/* Disclaimer banner */}
              <div className="mx-4 mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                <span aria-hidden className="mt-0.5 text-amber-500">⚠️</span>
                <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                  I&apos;m an AI companion, not a therapist. For professional help, please
                  consult a mental health professional. In crisis? Call iCall: 9152987821
                </p>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {messagesLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-raised border-t-violet-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                      <Sparkles size={18} />
                    </div>
                    <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary shadow-sm">
                      <p className="whitespace-pre-wrap leading-relaxed">
                        Hi, I&apos;m Mentamind. I&apos;m here to listen and support you through
                        whatever you&apos;re feeling. Just to be clear: I&apos;m an AI companion,
                        not a therapist or doctor, and I can&apos;t diagnose or replace
                        professional care. But I&apos;m here for you. How are you feeling today?
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2.5 ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                          <Sparkles size={18} />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                          msg.role === "user"
                            ? "rounded-br-sm bg-gradient-to-br from-violet-500 to-purple-600 text-white"
                            : "rounded-tl-sm border border-border bg-surface-raised text-text-primary"
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content || "Message"}</p>
                        <p
                          className={`mt-1 text-xs ${
                            msg.role === "user" ? "text-white/60" : "text-text-muted"
                          }`}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {activeSession && !activeSession.ended_at && (
                <div className="border-t border-border p-4">
                  <div className="flex items-center gap-2 rounded-full border border-border bg-surface-raised/60 py-1.5 pl-2 pr-1.5">
                    <MicrophoneButton
                      onTranscript={(text) => setInput((prev) => prev ? prev + " " + text : text)}
                    />
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type your message..."
                      className="flex-1 bg-transparent px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                      disabled={sending}
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition-all hover:shadow-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    >
                      {sending ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="m22 2-7 20-4-9-9-4Z" />
                          <path d="M22 2 11 13" />
                        </svg>
                      )}
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
