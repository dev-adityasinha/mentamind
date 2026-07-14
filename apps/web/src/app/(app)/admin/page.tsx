'use client';

import React, { useEffect, useState } from 'react';
import {
    fetchAdminStats,
    fetchAdminReports,
    updateReportStatus,
    deleteAdminPost,
    deleteAdminComment,
    AdminStats,
    AdminReport
} from '@/lib/api/admin';

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [reports, setReports] = useState<AdminReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [statsData, reportsData] = await Promise.all([
                fetchAdminStats(),
                fetchAdminReports('pending')
            ]);
            setStats(statsData);
            setReports(reportsData);
        } catch (err: any) {
            setError(err.message || 'Failed to load admin data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleResolve = async (reportId: string) => {
        try {
            await updateReportStatus(reportId, 'resolved');
            setReports((prev) => prev.filter(r => r.id !== reportId));
        } catch (e) {
            alert('Failed to resolve report');
        }
    };

    const handleDismiss = async (reportId: string) => {
        try {
            await updateReportStatus(reportId, 'dismissed');
            setReports((prev) => prev.filter(r => r.id !== reportId));
        } catch (e) {
            alert('Failed to dismiss report');
        }
    };

    const handleDeleteContent = async (report: AdminReport) => {
        if (!confirm('Are you sure you want to delete this content?')) return;
        try {
            if (report.target_type === 'post') {
                await deleteAdminPost(report.target_id);
            } else {
                await deleteAdminComment(report.target_id);
            }
            // Auto resolve after delete
            await updateReportStatus(report.id, 'resolved');
            setReports((prev) => prev.filter(r => r.id !== report.id));
        } catch (e) {
            alert('Failed to delete content');
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-bg">
                <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-destructive bg-destructive-subtle rounded-xl m-8">
                Error: {error}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg p-8 text-text-primary">
            <header className="mb-10 animate-fade-slide">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand to-purple-500 mb-2">
                    Admin Moderation
                </h1>
                <p className="text-text-secondary text-lg">
                    Platform safety and community management overview.
                </p>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <StatCard title="Total Users" value={stats?.total_users || 0} icon="👤" />
                <StatCard title="Active Reports" value={stats?.active_reports || 0} icon="⚠️" highlight={stats && stats.active_reports > 0} />
                <StatCard title="Total Posts" value={stats?.total_posts || 0} icon="📝" />
                <StatCard title="AI Sessions" value={stats?.total_ai_sessions || 0} icon="🤖" />
            </div>

            {/* Reports Queue */}
            <div className="bg-surface border border-border rounded-3xl p-6 shadow-xl backdrop-blur-md animate-fade-slide" style={{ animationDelay: '0.1s' }}>
                <h2 className="text-2xl font-bold mb-6">Pending Reports Queue</h2>
                
                {reports.length === 0 ? (
                    <div className="text-center p-12 text-text-secondary bg-surface-raised rounded-2xl border border-border border-dashed">
                        🎉 All caught up! No pending reports.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {reports.map((report) => (
                            <div key={report.id} className="p-6 bg-surface-raised rounded-2xl border border-border shadow-sm flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="inline-block px-3 py-1 bg-destructive-subtle text-destructive text-sm font-semibold rounded-full mb-2 uppercase tracking-wide">
                                            {report.target_type}
                                        </span>
                                        <h3 className="font-semibold text-lg">Reason: {report.reason}</h3>
                                        <p className="text-text-secondary text-sm">
                                            Reported by: {report.reporter_name || 'Unknown'} • {new Date(report.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleDismiss(report.id)}
                                            className="px-4 py-2 bg-surface border border-border hover:bg-surface-active rounded-xl transition-colors font-medium text-text-primary"
                                        >
                                            Dismiss
                                        </button>
                                        <button 
                                            onClick={() => handleResolve(report.id)}
                                            className="px-4 py-2 bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 rounded-xl transition-colors font-medium"
                                        >
                                            Mark Resolved
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-bg rounded-xl border border-border mt-2">
                                    <p className="text-xs text-text-secondary uppercase tracking-wider mb-2 font-semibold">
                                        Reported Content (Author: {report.target_author_name || 'Anonymous'})
                                    </p>
                                    <p className="text-text-primary mb-4 italic">
                                        "{report.target_content || 'Content not available (deleted?)'}"
                                    </p>
                                    
                                    <button 
                                        onClick={() => handleDeleteContent(report)}
                                        className="px-4 py-2 bg-destructive text-white hover:bg-destructive-hover rounded-lg transition-colors text-sm font-medium shadow-md shadow-destructive/20 flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete {report.target_type} & Resolve
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, highlight = false }: { title: string, value: number, icon: string, highlight?: boolean }) {
    return (
        <div className={`p-6 rounded-3xl border transition-transform hover:-translate-y-1 ${highlight ? 'bg-destructive/5 border-destructive/20 shadow-lg shadow-destructive/5' : 'bg-surface border-border shadow-xl backdrop-blur-md'}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-text-secondary font-medium">{title}</h3>
                <span className="text-3xl">{icon}</span>
            </div>
            <p className={`text-4xl font-bold ${highlight ? 'text-destructive' : 'text-text-primary'}`}>
                {value.toLocaleString()}
            </p>
        </div>
    );
}
