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
    return apiFetch('/admin/stats');
}

export async function fetchAdminReports(status?: string, limit = 50, offset = 0): Promise<AdminReport[]> {
    const params = new URLSearchParams();
    if (status) params.append('status_filter', status);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    return apiFetch(`/admin/reports?${params.toString()}`);
}

export async function updateReportStatus(reportId: string, status: 'resolved' | 'dismissed'): Promise<void> {
    return apiFetch(`/admin/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}

export async function deleteAdminPost(postId: string): Promise<void> {
    return apiFetch(`/admin/posts/${postId}`, {
        method: 'DELETE',
    });
}

export async function deleteAdminComment(commentId: string): Promise<void> {
    return apiFetch(`/admin/comments/${commentId}`, {
        method: 'DELETE',
    });
}

export async function suspendUser(userId: string): Promise<void> {
    return apiFetch(`/admin/users/${userId}/suspend`, {
        method: 'PATCH',
    });
}
