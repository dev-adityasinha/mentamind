'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import {
    fetchAdminStats,
    fetchAdminReports,
    fetchAdminUsers,
    fetchAdminAnalytics,
    updateReportStatus,
    deleteAdminPost,
    deleteAdminComment,
    banUser,
    unbanUser,
    deleteUser,
    AdminStats,
    AdminReport,
    AdminUser,
    AdminAnalytics,
    TimeSeriesPoint,
    UserStatusFilter,
} from '@/lib/api/admin';

type Tab = 'users' | 'moderation' | 'analytics';

export default function AdminDashboardPage() {
    const { user } = useAuth();
    // Full admins (and HR) get user management + analytics. Moderators get
    // community moderation only.
    const isFullAdmin = user?.role === 'admin' || user?.role === 'hr_manager';
    const isModerator = user?.role === 'moderator';

    const [tab, setTab] = useState<Tab>(isFullAdmin ? 'users' : 'moderation');
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadStats = useCallback(async () => {
        if (!isFullAdmin) {
            // Moderators cannot read /admin/stats; skip it.
            setLoading(false);
            return;
        }
        try {
            const s = await fetchAdminStats();
            setStats(s);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load stats');
        } finally {
            setLoading(false);
        }
    }, [isFullAdmin]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    if (!isFullAdmin && !isModerator) {
        return (
            <div className="p-8 text-text-secondary">
                You don&apos;t have access to this area.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center bg-bg">
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
        <div className="min-h-screen bg-bg text-text-primary">
            <header className="mb-8 animate-fade-slide">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand"></span>
                    </span>
                    {isFullAdmin ? 'Admin workspace' : 'Moderation workspace'}
                </div>
                <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand via-purple-500 to-pink-500 mb-2">
                    {isFullAdmin ? 'Admin Panel' : 'Moderation'}
                </h1>
                <p className="text-text-secondary text-lg">
                    {isFullAdmin
                        ? 'Manage users, moderate the community, and monitor platform analytics.'
                        : 'Review reports and keep the community safe.'}
                </p>
            </header>

            {/* Top-line stats (admins only) */}
            {isFullAdmin && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    <StatCard title="Total Users" value={stats?.total_users ?? 0} icon="👤" accent="blue" />
                    <StatCard title="Active (30d)" value={stats?.active_users ?? 0} icon="🟢" accent="green" />
                    <StatCard title="Banned" value={stats?.banned_users ?? 0} icon="🚫" accent="red" highlight={Boolean(stats && stats.banned_users > 0)} />
                    <StatCard title="Reports" value={stats?.active_reports ?? 0} icon="⚠️" accent="amber" highlight={Boolean(stats && stats.active_reports > 0)} />
                    <StatCard title="Posts" value={stats?.total_posts ?? 0} icon="📝" accent="purple" />
                    <StatCard title="Comments" value={stats?.total_comments ?? 0} icon="💬" accent="pink" />
                </div>
            )}

            {/* Tabs (admins see all; moderators see moderation only) */}
            {isFullAdmin && (
                <div className="mb-6 inline-flex flex-wrap gap-1 rounded-xl border border-border bg-surface-raised/60 p-1 shadow-sm">
                    <TabButton active={tab === 'users'} onClick={() => setTab('users')}>User Management</TabButton>
                    <TabButton active={tab === 'moderation'} onClick={() => setTab('moderation')}>Community Moderation</TabButton>
                    <TabButton active={tab === 'analytics'} onClick={() => setTab('analytics')}>Analytics</TabButton>
                </div>
            )}

            {isFullAdmin && tab === 'users' && <UserManagement onChanged={loadStats} />}
            {(isModerator || (isFullAdmin && tab === 'moderation')) && <Moderation onChanged={loadStats} />}
            {isFullAdmin && tab === 'analytics' && <Analytics stats={stats} />}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* User Management                                                            */
/* -------------------------------------------------------------------------- */

function UserManagement({ onChanged }: { onChanged: () => void }) {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<UserStatusFilter | ''>('');
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchAdminUsers({
                search: search || undefined,
                status: statusFilter || undefined,
            });
            setUsers(res.users);
            setTotal(res.total);
        } catch {
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter]);

    useEffect(() => {
        const t = setTimeout(load, 250);
        return () => clearTimeout(t);
    }, [load]);

    const handleBan = async (u: AdminUser) => {
        const reason = prompt(`Ban ${u.display_name}? Optionally enter a reason:`);
        if (reason === null) return;
        setBusyId(u.id);
        try {
            await banUser(u.id, reason || undefined);
            await load();
            onChanged();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to ban user');
        } finally {
            setBusyId(null);
        }
    };

    const handleUnban = async (u: AdminUser) => {
        setBusyId(u.id);
        try {
            await unbanUser(u.id);
            await load();
            onChanged();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to unban user');
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (u: AdminUser) => {
        if (!confirm(`Permanently delete ${u.display_name}? This revokes their access.`)) return;
        setBusyId(u.id);
        try {
            await deleteUser(u.id);
            await load();
            onChanged();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Failed to delete user');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="bg-surface border border-border rounded-3xl p-6 shadow-xl animate-fade-slide">
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users by name…"
                    className="flex-1 px-4 py-2 rounded-xl bg-bg border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as UserStatusFilter | '')}
                    className="px-4 py-2 rounded-xl bg-bg border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
                >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="banned">Banned</option>
                    <option value="deleted">Deleted</option>
                </select>
            </div>

            <p className="text-sm text-text-secondary mb-4">{total} user{total === 1 ? '' : 's'} found</p>

            {loading ? (
                <div className="text-center p-12 text-text-secondary">Loading users…</div>
            ) : users.length === 0 ? (
                <div className="text-center p-12 text-text-secondary bg-surface-raised rounded-2xl border border-border border-dashed">
                    No users match your filters.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-text-secondary uppercase text-xs tracking-wider border-b border-border">
                                <th className="py-3 pr-4">Name</th>
                                <th className="py-3 pr-4">Role</th>
                                <th className="py-3 pr-4">Status</th>
                                <th className="py-3 pr-4">Joined</th>
                                <th className="py-3 pr-4">Last active</th>
                                <th className="py-3 pr-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => {
                                const deleted = Boolean(u.deleted_at);
                                return (
                                    <tr key={u.id} className="border-b border-border/60 hover:bg-surface-raised/50">
                                        <td className="py-3 pr-4 font-medium">{u.display_name}</td>
                                        <td className="py-3 pr-4 capitalize text-text-secondary">{u.role.replace('_', ' ')}</td>
                                        <td className="py-3 pr-4">
                                            {deleted ? (
                                                <Badge tone="muted">Deleted</Badge>
                                            ) : u.is_banned ? (
                                                <Badge tone="danger" title={u.ban_reason || undefined}>Banned</Badge>
                                            ) : (
                                                <Badge tone="ok">Active</Badge>
                                            )}
                                        </td>
                                        <td className="py-3 pr-4 text-text-secondary">{new Date(u.created_at).toLocaleDateString()}</td>
                                        <td className="py-3 pr-4 text-text-secondary">
                                            {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="py-3 pr-4">
                                            <div className="flex gap-2 justify-end">
                                                {!deleted && (u.is_banned ? (
                                                    <button
                                                        disabled={busyId === u.id}
                                                        onClick={() => handleUnban(u)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 disabled:opacity-50"
                                                    >
                                                        Unban
                                                    </button>
                                                ) : (
                                                    <button
                                                        disabled={busyId === u.id || u.role === 'admin'}
                                                        onClick={() => handleBan(u)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border hover:bg-surface-active disabled:opacity-40"
                                                    >
                                                        Ban
                                                    </button>
                                                ))}
                                                {!deleted && (
                                                    <button
                                                        disabled={busyId === u.id || u.role === 'admin'}
                                                        onClick={() => handleDelete(u)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 disabled:opacity-40"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Community Moderation                                                       */
/* -------------------------------------------------------------------------- */

function Moderation({ onChanged }: { onChanged: () => void }) {
    const [reports, setReports] = useState<AdminReport[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setReports(await fetchAdminReports('pending'));
        } catch {
            setReports([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const remove = (id: string) => {
        setReports((prev) => prev.filter((r) => r.id !== id));
        onChanged();
    };

    const handleResolve = async (id: string) => {
        try { await updateReportStatus(id, 'resolved'); remove(id); }
        catch { alert('Failed to resolve report'); }
    };

    const handleDismiss = async (id: string) => {
        try { await updateReportStatus(id, 'dismissed'); remove(id); }
        catch { alert('Failed to dismiss report'); }
    };

    const handleDeleteContent = async (report: AdminReport) => {
        if (!confirm('Delete this content and resolve the report?')) return;
        try {
            if (report.target_type === 'post') await deleteAdminPost(report.target_id);
            else await deleteAdminComment(report.target_id);
            await updateReportStatus(report.id, 'resolved');
            remove(report.id);
        } catch {
            alert('Failed to delete content');
        }
    };

    return (
        <div className="bg-surface border border-border rounded-3xl p-6 shadow-xl animate-fade-slide">
            <h2 className="text-2xl font-bold mb-6">Pending Reports Queue</h2>

            {loading ? (
                <div className="text-center p-12 text-text-secondary">Loading reports…</div>
            ) : reports.length === 0 ? (
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
                                    &quot;{report.target_content || 'Content not available (deleted?)'}&quot;
                                </p>
                                <button
                                    onClick={() => handleDeleteContent(report)}
                                    className="px-4 py-2 bg-destructive text-white hover:bg-destructive-hover rounded-lg transition-colors text-sm font-medium shadow-md shadow-destructive/20 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete {report.target_type} &amp; Resolve
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                  */
/* -------------------------------------------------------------------------- */

function Analytics({ stats }: { stats: AdminStats | null }) {
    const [data, setData] = useState<AdminAnalytics | null>(null);
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        setLoading(true);
        fetchAdminAnalytics(days)
            .then((d) => { if (active) setData(d); })
            .catch(() => { if (active) setData(null); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [days]);

    return (
        <div className="space-y-6 animate-fade-slide">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="Assessments" value={stats?.total_assessments ?? 0} icon="📋" />
                <StatCard title="Meditation min" value={stats?.total_meditation_minutes ?? 0} icon="🧘" />
                <StatCard title="AI Sessions" value={stats?.total_ai_sessions ?? 0} icon="🤖" />
                <StatCard title="New today" value={stats?.daily_registrations ?? 0} icon="✨" />
            </div>

            <div className="flex justify-end">
                <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="px-4 py-2 rounded-xl bg-bg border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
                >
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                </select>
            </div>

            {loading ? (
                <div className="text-center p-12 text-text-secondary">Loading analytics…</div>
            ) : !data ? (
                <div className="p-8 text-destructive bg-destructive-subtle rounded-xl">Failed to load analytics.</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard title="Daily Registrations" series={data.daily_registrations} color="#7c3aed" />
                    <ChartCard title="Community Growth (cumulative)" series={data.community_growth} color="#22c55e" />
                    <ChartCard title="Assessments Completed" series={data.assessments_per_day} color="#3b82f6" />
                    <ChartCard title="Meditation Minutes" series={data.meditation_minutes_per_day} color="#f59e0b" />
                    <DistributionCard title="Assessments by Type" data={data.assessment_by_type} />
                    <DistributionCard title="Mood Tracking (by score)" data={data.mood_tracking_stats} />
                </div>
            )}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Reusable UI                                                                */
/* -------------------------------------------------------------------------- */

type StatAccent = 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'pink';

const STAT_ACCENTS: Record<StatAccent, { chip: string; bar: string; glow: string }> = {
    blue: { chip: 'bg-blue-500/15 text-blue-500', bar: 'from-blue-500/60', glow: 'hover:shadow-blue-500/10' },
    green: { chip: 'bg-emerald-500/15 text-emerald-500', bar: 'from-emerald-500/60', glow: 'hover:shadow-emerald-500/10' },
    red: { chip: 'bg-red-500/15 text-red-500', bar: 'from-red-500/60', glow: 'hover:shadow-red-500/10' },
    amber: { chip: 'bg-amber-500/15 text-amber-500', bar: 'from-amber-500/60', glow: 'hover:shadow-amber-500/10' },
    purple: { chip: 'bg-purple-500/15 text-purple-500', bar: 'from-purple-500/60', glow: 'hover:shadow-purple-500/10' },
    pink: { chip: 'bg-pink-500/15 text-pink-500', bar: 'from-pink-500/60', glow: 'hover:shadow-pink-500/10' },
};

function StatCard({ title, value, icon, accent = 'blue', highlight = false }: { title: string; value: number; icon: string; accent?: StatAccent; highlight?: boolean }) {
    const a = STAT_ACCENTS[accent];
    return (
        <div
            className={`group relative overflow-hidden rounded-2xl border p-5 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${a.glow} ${
                highlight ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-surface'
            }`}
        >
            {/* accent bar along the top edge */}
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r to-transparent ${a.bar}`} />
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-transform duration-300 group-hover:scale-110 ${a.chip}`}>
                    {icon}
                </span>
            </div>
            <p className={`text-3xl font-bold tracking-tight tabular-nums ${highlight ? 'text-destructive' : 'text-text-primary'}`}>
                {value.toLocaleString()}
            </p>
        </div>
    );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                active
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
            }`}
        >
            {children}
        </button>
    );
}

function Badge({ tone, children, title }: { tone: 'ok' | 'danger' | 'muted'; children: React.ReactNode; title?: string }) {
    const cls =
        tone === 'ok'
            ? 'bg-brand/10 text-brand border-brand/20'
            : tone === 'danger'
                ? 'bg-destructive/10 text-destructive border-destructive/20'
                : 'bg-surface-raised text-text-muted border-border';
    return (
        <span title={title} className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
            {children}
        </span>
    );
}

function ChartCard({ title, series, color }: { title: string; series: TimeSeriesPoint[]; color: string }) {
    const max = Math.max(1, ...series.map((p) => p.count));
    const total = series.reduce((s, p) => s + p.count, 0);
    return (
        <div className="bg-surface border border-border rounded-3xl p-6 shadow-lg">
            <div className="flex items-baseline justify-between mb-4">
                <h3 className="font-semibold text-lg">{title}</h3>
                <span className="text-text-secondary text-sm">{total.toLocaleString()} total</span>
            </div>
            <div className="flex items-end gap-[2px] h-40">
                {series.map((p) => (
                    <div key={p.date} className="flex-1 group relative flex items-end" style={{ height: '100%' }}>
                        <div
                            className="w-full rounded-t-sm transition-all"
                            style={{ height: `${(p.count / max) * 100}%`, backgroundColor: color, minHeight: p.count > 0 ? '2px' : '0' }}
                            title={`${p.date}: ${p.count}`}
                        />
                    </div>
                ))}
            </div>
            <div className="flex justify-between text-xs text-text-muted mt-2">
                <span>{series[0]?.date.slice(5)}</span>
                <span>{series[series.length - 1]?.date.slice(5)}</span>
            </div>
        </div>
    );
}

function DistributionCard({ title, data }: { title: string; data: Record<string, number> }) {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map(([, v]) => v));
    return (
        <div className="bg-surface border border-border rounded-3xl p-6 shadow-lg">
            <h3 className="font-semibold text-lg mb-4">{title}</h3>
            {entries.length === 0 ? (
                <p className="text-text-secondary text-sm">No data yet.</p>
            ) : (
                <div className="space-y-3">
                    {entries.map(([label, value]) => (
                        <div key={label}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-text-primary capitalize">{label.replace('-', ' ')}</span>
                                <span className="text-text-secondary">{value.toLocaleString()}</span>
                            </div>
                            <div className="h-2 rounded-full bg-surface-raised overflow-hidden">
                                <div className="h-full rounded-full bg-brand" style={{ width: `${(value / max) * 100}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
