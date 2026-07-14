import { apiFetch } from './client';

export interface AdminStats {
    total_users: number;
    total_posts: number;
    active_reports: number;
    total_ai_sessions: number;
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

export async function fetchAdminStats(): Promise<AdminStats> {
    const res = await apiFetch('/admin/stats');
    if (!res.ok) throw new Error('Failed to fetch admin stats');
    return res.json();
}

export async function fetchAdminReports(status?: string, limit = 50, offset = 0): Promise<AdminReport[]> {
    const params = new URLSearchParams();
    if (status) params.append('status_filter', status);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    const res = await apiFetch(`/admin/reports?${params.toString()}`);
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
    const res = await apiFetch(`/admin/posts/${postId}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete post');
}

export async function deleteAdminComment(commentId: string): Promise<void> {
    const res = await apiFetch(`/admin/comments/${commentId}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete comment');
}

export async function suspendUser(userId: string): Promise<void> {
    const res = await apiFetch(`/admin/users/${userId}/suspend`, {
        method: 'PATCH',
    });
    if (!res.ok) throw new Error('Failed to suspend user');
}
