"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/Button";
import { getAccessToken } from "@/lib/api/client";

type Message = {
  id: string;
  sender_id: string;
  content: string;
  is_read?: boolean;
  created_at: string;
};

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const [chatEndedBy, setChatEndedBy] = useState<"user" | "partner" | null>(null);
  const waitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (waitTimeoutRef.current) clearTimeout(waitTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isWaiting && !isTimeout) {
      interval = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isWaiting, isTimeout]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    
    const markAsRead = () => {
      if (document.visibilityState !== "visible" && !document.hasFocus()) return;
      
      messages.forEach(msg => {
        if (msg.sender_id !== user?.id && !msg.is_read) {
          if (socket && sessionId) {
            socket.send(JSON.stringify({ type: "read", message_id: msg.id, session_id: sessionId }));
            // Optimistically mutate to prevent duplicate sends
            msg.is_read = true; 
          }
        }
      });
    };

    markAsRead(); // Check immediately when messages update

    document.addEventListener("visibilitychange", markAsRead);
    window.addEventListener("focus", markAsRead);

    return () => {
      document.removeEventListener("visibilitychange", markAsRead);
      window.removeEventListener("focus", markAsRead);
    };
  }, [messages, socket, sessionId, user?.id]);

  const joinRandomChat = () => {
    connectWebSocket();
  };

  const connectWebSocket = () => {
    setIsTimeout(false);
    setIsWaiting(true);
    setTimeLeft(120);
    setChatEndedBy(null);

    const token = getAccessToken();
    if (!token) return;

    const wsUrl = process.env.NEXT_PUBLIC_API_URL?.replace("http", "ws") || "ws://localhost:8000";
    const ws = new WebSocket(`${wsUrl}/chat/ws?token=${token}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "waiting") {
        setIsWaiting(true);
        if (waitTimeoutRef.current) clearTimeout(waitTimeoutRef.current);
        waitTimeoutRef.current = setTimeout(() => {
          ws.close();
          setSocket(null);
          setIsWaiting(false);
          setIsTimeout(true);
        }, 120000); // 2 minutes
      } else if (data.type === "matched") {
        if (waitTimeoutRef.current) clearTimeout(waitTimeoutRef.current);
        setIsWaiting(false);
        setIsTimeout(false);
        setSessionId(data.session_id);
      } else if (data.type === "message") {
        setMessages(prev => [...prev, { ...data.message, is_read: false }]);
      } else if (data.type === "typing") {
        setPartnerTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 3000);
      } else if (data.type === "read") {
        setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, is_read: true } : m));
      } else if (data.type === "end") {
        setChatEndedBy("partner");
        ws.close();
        setSocket(null);
      }
    };
    
    setSocket(ws);
  };

  const endChat = () => {
    if (socket && sessionId) {
      socket.send(JSON.stringify({ type: "end", session_id: sessionId }));
      setChatEndedBy("user");
      socket.close();
      setSocket(null);
    }
  };

  const leaveChat = () => {
    setSessionId(null);
    setMessages([]);
    setChatEndedBy(null);
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socket || !sessionId) return;
    
    socket.send(JSON.stringify({ type: "message", session_id: sessionId, content: input }));
    setInput("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (socket && sessionId) {
      socket.send(JSON.stringify({ type: "typing", session_id: sessionId }));
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const [showEndConfirm, setShowEndConfirm] = useState(false);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] border border-border rounded-xl bg-surface overflow-hidden relative">
      {!sessionId ? (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Anonymous Chat</h2>
          <p className="text-text-secondary">Connect with someone who understands.</p>
          {isWaiting ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-brand font-medium animate-pulse">Waiting for a partner...</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums tracking-widest">{formatTime(timeLeft)}</p>
            </div>
          ) : isTimeout ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-red-500 font-medium">Connection timed out. No partner found.</p>
              <Button onClick={joinRandomChat} variant="primary">Retry</Button>
            </div>
          ) : (
            <Button onClick={joinRandomChat} variant="primary">Join a Chat</Button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-bg border-b border-border p-4 flex justify-between items-center">
            <h3 className="font-semibold text-text-primary">Anonymous Chat Session</h3>
            {chatEndedBy ? (
              <Button variant="primary" size="sm" onClick={leaveChat}>
                Leave Chat
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setShowEndConfirm(true)}>
                End Chat
              </Button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex flex-col ${msg.sender_id === user?.id ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[75%] break-words rounded-2xl px-4 py-2 ${
                    msg.sender_id === user?.id
                      ? 'bg-brand text-brand-foreground rounded-br-none'
                      : 'bg-bg border border-border text-text-primary rounded-bl-none'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.sender_id === user?.id && msg.is_read && (
                  <span className="text-[10px] text-text-muted mt-1 mr-1">Read</span>
                )}
              </div>
            ))}
            
            {partnerTyping && !chatEndedBy && (
              <div className="flex justify-start">
                <div className="bg-bg border border-border text-text-primary rounded-2xl rounded-bl-none px-4 py-2 text-sm italic">
                  Partner is typing...
                </div>
              </div>
            )}

            {chatEndedBy && (
              <div className="flex justify-center mt-4">
                <div className="bg-surface border border-border text-text-secondary rounded-full px-4 py-2 text-sm text-center">
                  {chatEndedBy === "user" ? "You ended the chat." : "Partner has ended the chat."}
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-3 sm:p-4 border-t border-border bg-bg flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              className="flex-1 min-w-0 bg-surface text-text-primary border border-border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50"
              placeholder={chatEndedBy ? "Chat has ended" : "Type your message..."}
              disabled={!!chatEndedBy}
            />
            <Button type="submit" variant="primary" className="shrink-0 rounded-full px-4 sm:px-6 disabled:opacity-50" disabled={!!chatEndedBy}>Send</Button>
          </form>

          {showEndConfirm && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="bg-surface border border-border rounded-xl p-6 shadow-xl max-w-sm w-full text-center space-y-4">
                <h3 className="text-xl font-semibold text-text-primary">End Chat?</h3>
                <p className="text-text-secondary">Are you sure you want to end this chat? You won&apos;t be able to send any more messages.</p>
                <div className="flex justify-center gap-3 mt-4">
                  <Button variant="secondary" onClick={() => setShowEndConfirm(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={() => {
                    setShowEndConfirm(false);
                    endChat();
                  }}>End Chat</Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
