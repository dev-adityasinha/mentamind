'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  useEffect(() => {
    if (user) loadNotifications();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadNotifications = async () => {
    try {
      const data = await apiFetch<{ notifications: Notification[]; unreadCount: number }>('/notifications');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    try {
      await apiFetch('/notifications/mark-all-read', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  const filtered = filter === 'UNREAD' ? notifications.filter((n) => !n.read) : notifications;

  if (loading) {
    return (
      <div style={{ padding: '32px' }}>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading notifications...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '640px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span style={{
              fontSize: '11px', fontWeight: 600, color: '#fff',
              padding: '1px 6px', borderRadius: '10px',
              backgroundColor: 'var(--color-primary)',
            }}>
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="tab-bar" style={{ maxWidth: '200px', marginBottom: '16px' }}>
        {(['ALL', 'UNREAD'] as const).map((tab) => (
          <button key={tab} onClick={() => setFilter(tab)} className={`tab-item${filter === tab ? ' active' : ''}`}>
            {tab}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', borderRadius: '10px',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {filter === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.map((n) => (
            <div
              key={n.id}
              style={{
                padding: '14px 16px', borderRadius: '10px',
                backgroundColor: 'var(--color-surface)',
                borderLeft: n.read ? '1px solid var(--color-border)' : '2px solid var(--color-primary)',
                borderRight: '1px solid var(--color-border)',
                borderTop: '1px solid var(--color-border)',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                    {n.title}
                  </p>
                  <p style={{ fontSize: '12px', marginTop: '2px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    {n.message}
                  </p>
                  <p style={{ fontSize: '11px', marginTop: '6px', color: 'var(--color-text-muted)' }}>
                    {new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {!n.read && (
                  <button
                    onClick={() => markRead(n.id)}
                    style={{ fontSize: '12px', fontWeight: 500, flexShrink: 0, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
