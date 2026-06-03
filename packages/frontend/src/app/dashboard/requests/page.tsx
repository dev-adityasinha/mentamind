'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

interface BloodRequest {
  id: string;
  bloodGroup: string;
  unitsNeeded: number;
  urgency: string;
  status: string;
  notes: string | null;
  createdAt: string;
  patient?: { user: { name: string } };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',
  PENDING_VERIFICATION: '#f59e0b',
  VERIFIED: '#3b82f6',
  MATCHING: '#8b5cf6',
  MATCHED: '#10b981',
  IN_PROGRESS: '#f97316',
  FULFILLED: '#22c55e',
  CANCELLED: '#ef4444',
  REJECTED: '#dc2626',
};

const URGENCY_DOT: Record<string, string> = {
  NORMAL: '#22c55e',
  URGENT: '#f59e0b',
  CRITICAL: '#ef4444',
};

function formatBloodGroup(bg: string) {
  return bg.replace('_POS', '+').replace('_NEG', '−');
}

function formatStatus(s: string) {
  return s.replace(/_/g, ' ');
}

const FILTER_TABS = ['ALL', 'ACTIVE', 'FULFILLED', 'CANCELLED'] as const;

export default function RequestsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTER_TABS)[number]>('ALL');

  useEffect(() => {
    if (user) loadRequests();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRequests = async () => {
    try {
      const data = await apiFetch<{ requests: BloodRequest[] }>('/blood-requests');
      setRequests(data.requests);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const filtered = requests.filter((r) => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return !['FULFILLED', 'CANCELLED', 'REJECTED'].includes(r.status);
    if (filter === 'FULFILLED') return r.status === 'FULFILLED';
    if (filter === 'CANCELLED') return ['CANCELLED', 'REJECTED'].includes(r.status);
    return true;
  });

  if (loading) {
    return (
      <div style={{ padding: '32px' }}>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading requests...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
          Blood Requests
        </h1>
        {user?.role === 'PATIENT' && (
          <Link href="/dashboard/requests/new" className="btn-primary">
            New Request
          </Link>
        )}
      </div>

      {/* Filter tabs */}
      <div className="tab-bar" style={{ marginBottom: '16px' }}>
        {FILTER_TABS.map((tab) => (
          <button key={tab} onClick={() => setFilter(tab)} className={`tab-item${filter === tab ? ' active' : ''}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', borderRadius: '10px',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {filter === 'ALL' ? 'No blood requests yet' : `No ${filter.toLowerCase()} requests`}
          </p>
          {user?.role === 'PATIENT' && filter === 'ALL' && (
            <Link href="/dashboard/requests/new" style={{ display: 'inline-block', marginTop: '12px', fontSize: '13px', fontWeight: 500, color: 'var(--color-primary)' }}>
              Create your first request →
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.map((req) => (
            <button
              key={req.id}
              onClick={() => router.push(`/dashboard/requests/${req.id}`)}
              className="list-row"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
                    backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', flexShrink: 0,
                  }}>
                    {formatBloodGroup(req.bloodGroup)}
                  </span>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                      {req.unitsNeeded} unit{req.unitsNeeded > 1 ? 's' : ''} needed
                    </p>
                    {req.patient?.user && (
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                        {req.patient.user.name}
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: URGENCY_DOT[req.urgency] ?? '#6b7280', flexShrink: 0 }} />
                  <span style={{
                    fontSize: '11px', fontWeight: 500, padding: '2px 7px', borderRadius: '4px',
                    backgroundColor: `${STATUS_COLORS[req.status]}18`,
                    color: STATUS_COLORS[req.status],
                  }}>
                    {formatStatus(req.status)}
                  </span>
                </div>
              </div>
              <p style={{ fontSize: '11px', marginTop: '8px', color: 'var(--color-text-muted)' }}>
                {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
