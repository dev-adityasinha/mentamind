"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
import { Volume2, VolumeX } from "lucide-react";

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AI Coach</h1>
          <p className="mt-1 text-sm text-text-muted">
            Talk to your personal AI wellness coach.
          </p>
        </div>
        <Button variant="primary" onClick={handleNewSession} isLoading={creatingSession}>
          New session
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sessions sidebar */}
        <div className="md:col-span-1">
          <Card>
            <div className="p-4 space-y-2">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                Sessions
              </h2>
              {sessions.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">
                  No sessions yet.
                </p>
              ) : (
                <div className="space-y-1 max-h-[500px] overflow-y-auto">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectSession(s.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        activeSessionId === s.id
                          ? "bg-brand-subtle text-brand"
                          : "hover:bg-surface-raised text-text-secondary"
                      }`}
                    >
                      <div className="font-medium truncate">
                        {formatDate(s.started_at)}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {s.message_count} messages
                        {s.ended_at && " · Ended"}
                        {s.crisis_detected && " ⚠️"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Chat area */}
        <div className="md:col-span-2">
          {!activeSessionId ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                <p className="text-lg">Select a session or start a new one.</p>
                <p className="mt-1 text-sm">Your conversations are private and encrypted.</p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex flex-col h-[550px]">
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
                      className="p-1.5 text-text-muted hover:text-brand transition-colors rounded-md hover:bg-surface-raised"
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

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-raised border-t-brand" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-text-muted">
                      <p className="text-sm">Send a message to start the conversation.</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                            msg.role === "user"
                              ? "bg-brand text-brand-foreground rounded-br-sm"
                              : "bg-surface-raised text-text-primary rounded-bl-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content || "Message"}</p>
                          <p className={`mt-1 text-xs ${msg.role === "user" ? "text-brand-foreground/60" : "text-text-muted"}`}>
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
                    <div className="flex gap-2 items-center">
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
                        className="flex-1 rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
                        disabled={sending}
                      />
                      <Button
                        variant="primary"
                        onClick={handleSend}
                        isLoading={sending}
                        disabled={!input.trim()}
                      >
                        Send
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
