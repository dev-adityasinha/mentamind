"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/Toast";
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
import { Volume2, VolumeX, Sparkles, ChevronDown, Plus, History, Check } from "lucide-react";

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

// Quick-reply prompts shown under the greeting. Tapping one fills the input;
// it does not send on its own, so nothing about the chat flow changes.
const QUICK_REPLIES = [
  "I'm feeling anxious",
  "I just want to talk",
  "Help me relax",
  "I'm having a good day",
];

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
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const sessionsRef = useRef<HTMLDivElement>(null);

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
    // Scroll only the messages panel itself (never scrollIntoView, which can
    // yank the whole page up when the panel mounts on an empty chat). Only
    // scroll once there is something to scroll to.
    if (messages.length === 0) return;
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Close the sessions dropdown when clicking outside it.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (sessionsRef.current && !sessionsRef.current.contains(e.target as Node)) {
        setSessionsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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
    setSessionsOpen(false);
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
      setSessionsOpen(false);
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-surface-raised border-t-violet-500" />
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex h-[calc(100vh-8rem)] w-full max-w-3xl flex-col">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-500/15 blur-[100px]" />

      {/* Header */}
      <div className="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-text-primary">
              AI{" "}
              <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">
                Companion
              </span>
            </h1>
            <p className="text-sm text-text-muted">A supportive listener, available 24/7</p>
          </div>
        </div>

        {/* Sessions dropdown + New chat */}
        <div className="flex items-center gap-2">
          <div className="relative" ref={sessionsRef}>
            <button
              type="button"
              onClick={() => setSessionsOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-violet-600"
            >
              <History size={16} />
              History
              <ChevronDown
                size={16}
                className={`transition-transform ${sessionsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {sessionsOpen && (
              <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-bg shadow-xl">
                <div className="border-b border-border px-4 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Your sessions
                  </p>
                </div>
                {sessions.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-text-muted">
                    No sessions yet.
                  </p>
                ) : (
                  <div className="max-h-80 overflow-y-auto p-1.5">
                    {sessions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectSession(s.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                          activeSessionId === s.id
                            ? "bg-violet-500/10 text-violet-600"
                            : "text-text-secondary hover:bg-surface-raised"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {formatDate(s.started_at)}
                          </span>
                          <span className="block text-xs text-text-muted">
                            {s.message_count} messages
                            {s.ended_at && " · Ended"}
                            {s.crisis_detected && " ⚠️"}
                          </span>
                        </span>
                        {activeSessionId === s.id && (
                          <Check size={16} className="shrink-0 text-violet-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleNewSession}
            disabled={creatingSession}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition-all hover:shadow-violet-500/40 disabled:opacity-50"
          >
            <Plus size={16} className={creatingSession ? "animate-spin" : ""} />
            New Chat
          </button>
        </div>
      </div>

      {/* Chat panel */}
      {!activeSessionId ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border border-border bg-surface/70 text-center shadow-sm backdrop-blur">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30">
            <Sparkles size={30} />
          </div>
          <p className="text-lg font-semibold text-text-primary">Ready when you are</p>
          <p className="mt-1 max-w-xs text-sm text-text-muted">
            Start a new chat or open one from your history. Your conversations are private and encrypted.
          </p>
          <button
            type="button"
            onClick={handleNewSession}
            disabled={creatingSession}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition-all hover:shadow-violet-500/40 disabled:opacity-50"
          >
            <Plus size={16} />
            Start a new chat
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border bg-surface/80 shadow-sm backdrop-blur">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="text-sm font-medium text-text-primary">
              {formatDate(activeSession?.started_at ?? activeSessionId)}
              {activeSession?.ended_at && (
                <span className="ml-2 text-xs text-text-muted">(ended)</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setReadAloud(!readAloud);
                  if (readAloud && typeof window !== "undefined") {
                    window.speechSynthesis?.cancel();
                  }
                }}
                className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface-raised hover:text-violet-600"
                aria-label={readAloud ? "Disable read aloud" : "Enable read aloud"}
                title="Read AI messages aloud"
              >
                {readAloud ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              {activeSession && !activeSession.ended_at && (
                <button
                  type="button"
                  onClick={handleEndSession}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
                >
                  End session
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div ref={messagesContainerRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {messagesLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-raised border-t-violet-500" />
              </div>
            ) : (
              <>
                {/* Greeting — always shown at the top of the conversation */}
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/25">
                    <Sparkles size={20} />
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

                {/* Quick replies — only before the first message is sent */}
                {messages.length === 0 && activeSession && !activeSession.ended_at && (
                  <div className="flex flex-wrap gap-2 pl-[52px]">
                    {QUICK_REPLIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setInput(q)}
                        className="rounded-full border border-violet-200 bg-violet-500/5 px-3.5 py-1.5 text-sm text-violet-600 transition-colors hover:bg-violet-500/10 dark:border-violet-500/30"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Conversation */}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2.5 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/25">
                        <Sparkles size={20} />
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
                ))}
              </>
            )}

            {/* Typing indicator while the AI is responding */}
            {sending && (
              <div className="flex items-end gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/25">
                  <Sparkles size={20} />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border bg-surface-raised px-4 py-3 shadow-sm">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {activeSession && !activeSession.ended_at && (
            <div className="border-t border-border p-4">
              <div className="flex items-center gap-2 rounded-full border border-border bg-surface-raised/60 py-1.5 pl-2 pr-1.5 transition-colors focus-within:border-violet-400">
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
                  className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                  disabled={sending}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition-all hover:shadow-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
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
  );
}
