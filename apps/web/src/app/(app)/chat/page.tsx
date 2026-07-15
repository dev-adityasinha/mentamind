"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/Button";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    
    // Mark last received message as read
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.sender_id !== user?.id && !lastMsg.is_read && socket && sessionId) {
      socket.send(JSON.stringify({ type: "read", message_id: lastMsg.id, session_id: sessionId }));
      // Optimistically update local state if needed
    }
  }, [messages, socket, sessionId, user?.id]);

  const joinRandomChat = async () => {
    try {
      const res = await fetch("/api/chat/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session_id);
        connectWebSocket(data.session_id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const connectWebSocket = (sid: string) => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//localhost:8000/chat/ws/${sid}?token=${localStorage.getItem("token")}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "message") {
        setMessages(prev => [...prev, { ...data.message, is_read: false }]);
      } else if (data.type === "typing") {
        setPartnerTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 3000);
      } else if (data.type === "read") {
        setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, is_read: true } : m));
      }
    };
    
    setSocket(ws);
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

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] border border-border rounded-xl bg-surface overflow-hidden">
      {!sessionId ? (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Anonymous Chat</h2>
          <p className="text-text-secondary">Connect with someone who understands.</p>
          <Button onClick={joinRandomChat} variant="primary">Join a Chat</Button>
        </div>
      ) : (
        <>
          <div className="bg-bg border-b border-border p-4">
            <h3 className="font-semibold text-text-primary">Anonymous Chat Session</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex flex-col ${msg.sender_id === user?.id ? 'items-end' : 'items-start'}`}
              >
                <div 
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    msg.sender_id === user?.id 
                      ? 'bg-brand text-white rounded-br-none' 
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
            
            {partnerTyping && (
              <div className="flex justify-start">
                <div className="bg-bg border border-border text-text-primary rounded-2xl rounded-bl-none px-4 py-2 text-sm italic">
                  Partner is typing...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t border-border bg-bg flex gap-2">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              className="flex-1 bg-surface border border-border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="Type your message..."
            />
            <Button type="submit" variant="primary" className="rounded-full px-6">Send</Button>
          </form>
        </>
      )}
    </div>
  );
}
