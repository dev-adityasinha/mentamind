"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Check, Circle, Activity, AlertTriangle, Calendar, Heart, FileText, MessageSquare, Award } from "lucide-react";
import { fetchNotifications, markNotificationRead, NotificationResponse } from "@/lib/api/notifications";

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(() => {
      loadNotifications();
    }, 30000); // 30 seconds polling
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  async function loadNotifications() {
    try {
      const data = await fetchNotifications();
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch (error) {
      console.error("Failed to load notifications", error);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      const updated = await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? updated : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark read", error);
    }
  }

  function getIconForCategory(category: string) {
    switch (category) {
      case "checkin_reminder":
        return <Activity className="w-5 h-5 text-blue-500" />;
      case "burnout_alert":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "appointment_reminder":
        return <Calendar className="w-5 h-5 text-purple-500" />;
      case "wellness_tip":
        return <Heart className="w-5 h-5 text-pink-500" />;
      case "consent_update":
        return <FileText className="w-5 h-5 text-orange-500" />;
      case "journal_prompt":
        return <MessageSquare className="w-5 h-5 text-green-500" />;
      case "coach_session":
        return <Activity className="w-5 h-5 text-indigo-500" />;
      case "streak_milestone":
        return <Award className="w-5 h-5 text-yellow-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus rounded-full transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-surface border border-border shadow-2xl z-50 overflow-hidden backdrop-blur-xl bg-opacity-95">
          <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-surface/50">
            <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full font-medium">
                {unreadCount} new
              </span>
            )}
          </div>
          
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-text-muted text-sm">
                No notifications right now.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border/50">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-bg transition-colors flex gap-3 ${
                      !notification.is_read ? 'bg-brand/5' : ''
                    }`}
                  >
                    <div className="shrink-0 mt-1">
                      {getIconForCategory(notification.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.is_read ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">
                        {notification.body}
                      </p>
                      <p className="text-[10px] text-text-muted mt-2 opacity-80">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <button
                        onClick={() => handleMarkRead(notification.id)}
                        className="shrink-0 self-center p-1.5 text-text-muted hover:text-brand hover:bg-brand/10 rounded-full transition-colors group"
                        title="Mark as read"
                      >
                        <Circle className="w-4 h-4 fill-brand text-brand group-hover:hidden" />
                        <Check className="w-4 h-4 hidden group-hover:block" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
