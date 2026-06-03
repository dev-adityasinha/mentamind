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
  appointmentDate: string | null;
  hospitalName: string | null;
  assignedDonorId: string | null;
  donorResponseStatus: string;
  patient?: { user: { name: string } };
}

/* ─── helpers ─────────────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280', PENDING_VERIFICATION: '#f59e0b', VERIFIED: '#3b82f6',
  MATCHING: '#8b5cf6', MATCHED: '#10b981', IN_PROGRESS: '#f97316',
  FULFILLED: '#22c55e', CANCELLED: '#ef4444', REJECTED: '#dc2626',
};

const URGENCY_DOT: Record<string, string> = {
  NORMAL: '#22c55e', URGENT: '#f59e0b', CRITICAL: '#ef4444',
};

const DONOR_RESP_COLOR: Record<string, string> = {
  PENDING: '#f59e0b', ACCEPTED: '#22c55e', DECLINED: '#ef4444',
};

function fmtBG(bg: string) { return bg.replace('_POS', '+').replace('_NEG', '−'); }

function fmtStatus(s: string) { return s.replace(/_/g, ' '); }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${Math.floor(m % 60)}m ago`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h ago`;
}

function fmtExact(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const FILTER_TABS = ['ALL', 'ACTIVE', 'FULFILLED', 'CANCELLED'] as const;

/* ─── Page ───────────────────────────────────────────────────────────────────── */

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

  const isHospital = user?.role === 'HOSPITAL';

  if (loading) {
    return (
      <div style={{ padding: '32px' }}>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading requests...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '820px' }}>
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
            {tab !== 'ALL' && (
              <span style={{ marginLeft: '5px', fontSize: '10px', opacity: 0.7 }}>
                ({requests.filter(r => {
                  if (tab === 'ACTIVE') return !['FULFILLED','CANCELLED','REJECTED'].includes(r.status);
                  if (tab === 'FULFILLED') return r.status === 'FULFILLED';
                  if (tab === 'CANCELLED') return ['CANCELLED','REJECTED'].includes(r.status);
                  return true;
                }).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', borderRadius: '10px',
          border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
        }}>
          <p style={{ fontSize: '28px', marginBottom: '8px' }}>🩸</p>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((req) => (
            <button
              key={req.id}
              onClick={() => router.push(`/dashboard/requests/${req.id}`)}
              style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
            >
              <div style={{
                borderRadius: '12px', overflow: 'hidden',
                border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
                transition: 'border-color 150ms ease',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
              >
                {/* Urgency accent line */}
                <div style={{ height: '2px', backgroundColor: URGENCY_DOT[req.urgency] ?? '#6b7280' }} />

                <div style={{ padding: '14px 16px' }}>
                  {/* Row 1: blood group + right-side badges */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Blood group */}
                      <span style={{
                        fontSize: '13px', fontWeight: 700, padding: '3px 9px', borderRadius: '6px',
                        backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', flexShrink: 0,
                      }}>
                        {fmtBG(req.bloodGroup)}
                      </span>

                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '2px' }}>
                          {req.unitsNeeded} unit{req.unitsNeeded > 1 ? 's' : ''} needed
                        </p>
                        {req.patient?.user && (
                          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            {req.patient.user.name}
                          </p>
                        )}
                        {isHospital && req.hospitalName && (
                          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            🏥 {req.hospitalName}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right badges */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      {/* Status */}
                      <span style={{
                        fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                        backgroundColor: `${STATUS_COLORS[req.status]}15`, color: STATUS_COLORS[req.status],
                      }}>
                        {fmtStatus(req.status)}
                      </span>

                      {/* Urgency dot + label */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 500, color: URGENCY_DOT[req.urgency] }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: URGENCY_DOT[req.urgency], display: 'inline-block' }} />
                        {req.urgency}
                      </span>

                      {/* Donor response badge */}
                      {req.assignedDonorId && (
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '10px', backgroundColor: `${DONOR_RESP_COLOR[req.donorResponseStatus] ?? '#6b7280'}15`, color: DONOR_RESP_COLOR[req.donorResponseStatus] ?? '#6b7280' }}>
                          Donor: {req.donorResponseStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: timestamp section — prominent for hospital, secondary for others */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
                    paddingTop: '10px', borderTop: '1px solid var(--color-border)',
                  }}>
                    {isHospital ? (
                      /* Hospital: very prominent creation time */
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '14px' }}>🕐</span>
                          <div>
                            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: '1px' }}>Request Created</p>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>{timeAgo(req.createdAt)}</p>
                            <p style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{fmtExact(req.createdAt)}</p>
                          </div>
                        </div>
                        {req.appointmentDate && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '14px' }}>📅</span>
                            <div>
                              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: '1px' }}>Appointment</p>
                              <p style={{ fontSize: '13px', fontWeight: 700, color: '#3b82f6' }}>
                                {new Date(req.appointmentDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Other roles: compact date */
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {req.appointmentDate && (
                          <span style={{ marginLeft: '12px', color: '#3b82f6', fontWeight: 500 }}>
                            📅 {new Date(req.appointmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </p>
                    )}

                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      View details →
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
