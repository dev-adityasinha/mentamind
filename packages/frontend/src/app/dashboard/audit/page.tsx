'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  timestamp: string;
  user: { name: string; email: string; role: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ACTION_COLORS: Record<string, string> = {
  CREATED: '#22c55e',
  UPDATED: '#3b82f6',
  STATUS: '#f59e0b',
  MATCHED: '#8b5cf6',
  DELETED: '#ef4444',
  ACTIVATED: '#22c55e',
  DEACTIVATED: '#ef4444',
  COMPLETED: '#10b981',
  VERIFIED: '#22c55e',
};

function getActionColor(action: string): string {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return color;
  }
  return '#6b7280';
}

const ENTITY_TABS = ['ALL', 'User', 'BloodRequest', 'MedicineRequest', 'Donor', 'Patient'] as const;

export default function AuditPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [actionSearch, setActionSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') { router.push('/dashboard'); return; }
    if (user) loadLogs();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) loadLogs();
  }, [entityFilter, actionSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityFilter !== 'ALL') params.set('entityType', entityFilter);
      if (actionSearch) params.set('action', actionSearch);
      params.set('page', String(page));
      params.set('limit', '25');

      const data = await apiFetch<{ logs: AuditEntry[]; pagination: Pagination }>(`/admin/audit?${params}`);
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{ padding: '32px', maxWidth: '960px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '20px', letterSpacing: '-0.02em' }}>
        Audit Log
      </h1>

      {/* Search */}
      <div style={{ marginBottom: '12px' }}>
        <input
          value={actionSearch}
          onChange={(e) => setActionSearch(e.target.value)}
          placeholder="Filter by action..."
          className="input-field"
          style={{ maxWidth: '320px' }}
        />
      </div>

      {/* Entity filter */}
      <div className="tab-bar" style={{ marginBottom: '16px', overflowX: 'auto' }}>
        {ENTITY_TABS.map((tab) => (
          <button key={tab} onClick={() => setEntityFilter(tab)} className={`tab-item${entityFilter === tab ? ' active' : ''}`} style={{ flexShrink: 0 }}>
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', padding: '20px 0' }}>Loading...</p>
      ) : logs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', borderRadius: '10px',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No audit entries found</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {logs.map((log) => {
            const color = getActionColor(log.action);
            const isExpanded = expandedId === log.id;
            return (
              <AuditRow
                key={log.id}
                log={log}
                color={color}
                isExpanded={isExpanded}
                onToggle={() => setExpandedId(isExpanded ? null : log.id)}
              />
            );
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px' }}>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} entries)
          </p>
          <div style={{ display: 'flex', gap: '4px' }}>
            <GhostPageButton label="← Prev" onClick={() => loadLogs(pagination.page - 1)} disabled={pagination.page <= 1} />
            <GhostPageButton label="Next →" onClick={() => loadLogs(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} />
          </div>
        </div>
      )}
    </div>
  );
}

function AuditRow({ log, color, isExpanded, onToggle }: { log: AuditEntry; color: string; isExpanded: boolean; onToggle: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: '8px',
        border: `1px solid ${isExpanded ? color : 'var(--color-border)'}`,
        backgroundColor: isExpanded ? 'var(--color-surface)' : hovered ? 'var(--color-surface-hover)' : 'var(--color-surface)',
        transition: 'border-color 150ms ease, background-color 150ms ease',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
          <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: `${color}18`, color }}>
            {log.action}
          </span>
          <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}>
            {log.entityType}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          {new Date(log.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
        by {log.user.name} ({log.user.role}) · {log.entityId.slice(0, 8)}...
      </p>

      {isExpanded && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          {Boolean(log.oldValue) && (
            <div style={{ padding: '10px 12px', borderRadius: '6px', fontSize: '12px', backgroundColor: 'rgba(239,68,68,0.05)' }}>
              <p style={{ fontWeight: 600, marginBottom: '4px', color: '#ef4444' }}>Previous:</p>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                {JSON.stringify(log.oldValue, null, 2)}
              </pre>
            </div>
          )}
          {Boolean(log.newValue) && (
            <div style={{ padding: '10px 12px', borderRadius: '6px', fontSize: '12px', backgroundColor: 'rgba(34,197,94,0.05)' }}>
              <p style={{ fontWeight: 600, marginBottom: '4px', color: '#22c55e' }}>New:</p>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                {JSON.stringify(log.newValue, null, 2)}
              </pre>
            </div>
          )}
          {log.ipAddress && (
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>IP: {log.ipAddress}</p>
          )}
        </div>
      )}
    </button>
  );
}

function GhostPageButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
        border: '1px solid var(--color-border)',
        backgroundColor: hovered ? 'var(--color-surface-hover)' : 'transparent',
        color: 'var(--color-text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
        transition: 'background-color 150ms ease',
      }}
    >
      {label}
    </button>
  );
}
