import { apiFetch } from './client';

export interface AdminStats {
    total_users: number;
    total_posts: number;
    active_reports: number;
    total_ai_sessions: number;
    total_assessments: number;
    total_meditation_minutes: number;
    daily_registrations: number;
    active_users: number;
    banned_users: number;
    total_comments: number;
    mood_tracking_stats: Record<string, number>;
}

export interface AdminReport {
    id: string;
    reporter_id: string;
    target_type: 'post' | 'comment';
    target_id: string;
    reason: string;
    status: 'pending' | 'resolved' | 'dismissed';
    created_at: string;
    target_content: string | null;
    target_author_id: string | null;
    target_author_name: string | null;
    reporter_name: string | null;
}

export interface AdminUser {
    id: string;
    display_name: string;
    role: string;
    is_banned: boolean;
    banned_at: string | null;
    ban_reason: string | null;
    is_verified: boolean;
    onboarding_completed_at: string | null;
    created_at: string;
    last_active_at: string | null;
    deleted_at: string | null;
}

export interface AdminUserList {
    users: AdminUser[];
    total: number;
}

export interface TimeSeriesPoint {
    date: string;
    count: number;
}

export interface AdminAnalytics {
    days: number;
    daily_registrations: TimeSeriesPoint[];
    community_growth: TimeSeriesPoint[];
    assessments_per_day: TimeSeriesPoint[];
    assessment_by_type: Record<string, number>;
    meditation_minutes_per_day: TimeSeriesPoint[];
    mood_tracking_stats: Record<string, number>;
}

export type UserStatusFilter = 'active' | 'banned' | 'deleted';

// ---------------------------------------------------------------------------
// Stats & Analytics (admin / HR only)
// ---------------------------------------------------------------------------

// Admin dashboard data changes as soon as a moderator acts (delete/resolve),
// so these GETs must never be served from the HTTP cache or the PWA service
// worker — otherwise counts show stale, already-deleted content. `no-store`
// forces a fresh network fetch every time.
export async function fetchAdminStats(): Promise<AdminStats> {
    const res = await apiFetch('/admin/stats', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch admin stats');
    return res.json();
}

export async function fetchAdminAnalytics(days = 30): Promise<AdminAnalytics> {
    const res = await apiFetch(`/admin/analytics?days=${days}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
}

// ---------------------------------------------------------------------------
// Community Moderation (moderators + admins)
// ---------------------------------------------------------------------------

export async function fetchAdminReports(status?: string, limit = 50, offset = 0): Promise<AdminReport[]> {
    const params = new URLSearchParams();
    if (status) params.append('status_filter', status);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    const res = await apiFetch(`/admin/reports?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch reports');
    return res.json();
}

export async function updateReportStatus(reportId: string, status: 'resolved' | 'dismissed'): Promise<void> {
    const res = await apiFetch(`/admin/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update report status');
}

export async function deleteAdminPost(postId: string): Promise<void> {
    const res = await apiFetch(`/admin/posts/${postId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete post');
}

export async function deleteAdminComment(commentId: string): Promise<void> {
    const res = await apiFetch(`/admin/comments/${commentId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete comment');
}

// ---------------------------------------------------------------------------
// User Management (admin / HR only)
// ---------------------------------------------------------------------------

export async function fetchAdminUsers(
    opts: { search?: string; status?: UserStatusFilter; limit?: number; offset?: number } = {}
): Promise<AdminUserList> {
    const params = new URLSearchParams();
    if (opts.search) params.append('search', opts.search);
    if (opts.status) params.append('status_filter', opts.status);
    params.append('limit', (opts.limit ?? 50).toString());
    params.append('offset', (opts.offset ?? 0).toString());
    const res = await apiFetch(`/admin/users?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
}

export async function banUser(userId: string, reason?: string): Promise<AdminUser> {
    const res = await apiFetch(`/admin/users/${userId}/ban`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: reason ?? null }),
    });
    if (!res.ok) throw new Error('Failed to ban user');
    return res.json();
}

export async function unbanUser(userId: string): Promise<AdminUser> {
    const res = await apiFetch(`/admin/users/${userId}/unban`, { method: 'PATCH' });
    if (!res.ok) throw new Error('Failed to unban user');
    return res.json();
}

export async function deleteUser(userId: string): Promise<void> {
    const res = await apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete user');
}

// Deprecated alias kept for backwards compatibility (soft-delete a user).
export async function suspendUser(userId: string): Promise<void> {
    const res = await apiFetch(`/admin/users/${userId}/suspend`, { method: 'PATCH' });
    if (!res.ok) throw new Error('Failed to suspend user');
}
