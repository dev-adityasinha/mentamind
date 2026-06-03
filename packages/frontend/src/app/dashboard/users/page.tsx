'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

interface UserEntry {
  id: string;
  email: string;
  name: string;
  role: string;
  identityVerified: boolean;
  isActive: boolean;
  createdAt: string;
  _count: { auditLogs: number; notifications: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#f59e0b',
  PATIENT: '#3b82f6',
  DONOR: '#ef4444',
  VOLUNTEER: '#22c55e',
  HOSPITAL: '#a78bfa',
};

const ROLE_TABS = ['ALL', 'PATIENT', 'DONOR', 'ADMIN', 'VOLUNTEER', 'HOSPITAL'] as const;

export default function UsersPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState('');

  useEffect(() => {
    if (user && user.role !== 'ADMIN') { router.push('/dashboard'); return; }
    if (user) loadUsers();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) loadUsers();
  }, [roleFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUsers = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '20');

      const data = await apiFetch<{ users: UserEntry[]; pagination: Pagination }>(`/admin/users?${params}`);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (userId: string, isActive: boolean) => {
    setToggling(userId);
    try {
      await apiFetch(`/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive } : u)));
    } catch {
      // silent
    } finally {
      setToggling('');
    }
  };

  if (!user) return null;

  return (
    <div style={{ padding: '32px', maxWidth: '960px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '20px', letterSpacing: '-0.02em' }}>
        User Management
      </h1>

      {/* Search */}
      <div style={{ marginBottom: '12px' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="input-field"
          style={{ maxWidth: '320px' }}
        />
      </div>

      {/* Role filter */}
      <div className="tab-bar" style={{ marginBottom: '16px', overflowX: 'auto' }}>
        {ROLE_TABS.map((tab) => (
          <button key={tab} onClick={() => setRoleFilter(tab)} className={`tab-item${roleFilter === tab ? ' active' : ''}`} style={{ flexShrink: 0 }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{
        borderRadius: '10px', overflow: 'hidden',
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['User', 'Role', 'Verified', 'Status', 'Joined', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', letterSpacing: '0.02em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ fontWeight: 500, fontSize: '13px', color: 'var(--color-text)' }}>{u.name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{u.email}</p>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 500, padding: '2px 7px', borderRadius: '4px',
                        backgroundColor: `${ROLE_COLORS[u.role] ?? '#6b7280'}18`,
                        color: ROLE_COLORS[u.role] ?? '#6b7280',
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: u.identityVerified ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                        {u.identityVerified ? 'Yes' : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 500, padding: '2px 7px', borderRadius: '4px',
                        backgroundColor: u.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        color: u.isActive ? '#22c55e' : '#ef4444',
                      }}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <DeactivateButton
                        onClick={() => toggleActive(u.id, !u.isActive)}
                        disabled={toggling === u.id || u.id === user?.id}
                        label={toggling === u.id ? '...' : u.isActive ? 'Deactivate' : 'Activate'}
                        isActive={u.isActive}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--color-border)' }}>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div style={{ display: 'flex', gap: '4px' }}>
              {Array.from({ length: pagination.totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => loadUsers(i + 1)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer',
                    backgroundColor: pagination.page === i + 1 ? 'var(--color-primary)' : 'transparent',
                    color: pagination.page === i + 1 ? '#fff' : 'var(--color-text-muted)',
                    transition: 'background-color 150ms ease, color 150ms ease',
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DeactivateButton({ onClick, disabled, label, isActive }: { onClick: () => void; disabled: boolean; label: string; isActive: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: '12px', fontWeight: 500, padding: '4px 10px', borderRadius: '6px',
        border: '1px solid var(--color-border)',
        backgroundColor: hovered ? 'var(--color-surface-hover)' : 'transparent',
        color: isActive ? '#ef4444' : '#22c55e',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background-color 150ms ease',
      }}
    >
      {label}
    </button>
  );
}
