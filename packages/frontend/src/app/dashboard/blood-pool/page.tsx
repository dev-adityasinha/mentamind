'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface PoolRequest {
  id: string;
  bloodGroup: string;
  unitsNeeded: number;
  urgency: string;
  priorityLevel: string;
  status: string;
  appointmentDate: string | null;
  hospitalName: string | null;
  department: string | null;
  treatingDoctor: string | null;
  notes: string | null;
  createdAt: string;
  patient: { city: string | null };
  hospital: { hospitalName: string; address: string; latitude: number | null; longitude: number | null } | null;
  assignedDonorId: string | null;
  donorResponseStatus: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────────── */

const BLOOD_GROUPS = [
  { value: 'A_POS', label: 'A+' }, { value: 'A_NEG', label: 'A−' },
  { value: 'B_POS', label: 'B+' }, { value: 'B_NEG', label: 'B−' },
  { value: 'AB_POS', label: 'AB+' }, { value: 'AB_NEG', label: 'AB−' },
  { value: 'O_POS', label: 'O+' }, { value: 'O_NEG', label: 'O−' },
];

const URGENCY_META: Record<string, { color: string; bg: string; border: string; dot: string; label: string }> = {
  CRITICAL: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  dot: '#ef4444', label: 'Critical' },
  URGENT:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', dot: '#f59e0b', label: 'Urgent'   },
  NORMAL:   { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.25)',  dot: '#22c55e', label: 'Normal'   },
};

const STATUS_COLOR: Record<string, string> = {
  PENDING_VERIFICATION: '#f59e0b', VERIFIED: '#3b82f6', MATCHING: '#8b5cf6',
  MATCHED: '#0d9488', IN_PROGRESS: '#f97316',
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function fmtBG(bg: string) { return bg.replace('_POS', '+').replace('_NEG', '−'); }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fmtAppt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */

const URGENCY_TABS = ['ALL', 'CRITICAL', 'URGENT', 'NORMAL'] as const;

export default function BloodPoolPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PoolRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [urgencyTab, setUrgencyTab] = useState<string>('ALL');
  const [bgFilter, setBgFilter] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (urgencyTab !== 'ALL') params.set('urgency', urgencyTab);
      if (bgFilter) params.set('bloodGroup', bgFilter);
      const data = await apiFetch<{ requests: PoolRequest[]; total: number }>(
        `/blood-requests/pool${params.toString() ? '?' + params.toString() : ''}`,
      );
      setRequests(data.requests);
      setLastRefresh(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [urgencyTab, bgFilter]);

  useEffect(() => { if (user) load(); }, [user, load]);

  /* ── Count helpers ── */
  const countByUrgency = (u: string) => requests.filter(r => r.urgency === u).length;
  const criticalCount = countByUrgency('CRITICAL');

  return (
    <div style={{ padding: '32px', maxWidth: '820px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
              Blood Requests Pool
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              All active blood requests in the system. You will be contacted by the hospital if you are a match.
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); load(); }}
            style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span style={{ fontSize: '14px' }}>↻</span> Refresh
          </button>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
          Last updated: {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      </div>

      {/* ── Critical alert bar ── */}
      {criticalCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>🚨</span>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444' }}>
            {criticalCount} CRITICAL request{criticalCount > 1 ? 's' : ''} — blood needed within 2–4 hours
          </p>
        </div>
      )}

      {/* ── Urgency filter tabs ── */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {URGENCY_TABS.map(tab => {
          const active = urgencyTab === tab;
          const meta = tab !== 'ALL' ? URGENCY_META[tab] : null;
          const count = tab === 'ALL' ? requests.length : countByUrgency(tab);
          return (
            <button
              key={tab}
              onClick={() => setUrgencyTab(tab)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${active ? (meta?.border ?? 'var(--color-primary)') : 'var(--color-border)'}`,
                backgroundColor: active ? (meta?.bg ?? 'rgba(99,102,241,0.08)') : 'transparent',
                color: active ? (meta?.color ?? 'var(--color-primary)') : 'var(--color-text-muted)',
                transition: 'all 150ms ease',
              }}
            >
              {meta && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: meta.dot, display: 'inline-block' }} />}
              {tab} {count > 0 && <span style={{ fontSize: '10px', opacity: 0.8 }}>({count})</span>}
            </button>
          );
        })}
      </div>

      {/* ── Blood group filter ── */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button
          onClick={() => setBgFilter('')}
          style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${!bgFilter ? 'var(--color-primary)' : 'var(--color-border)'}`, backgroundColor: !bgFilter ? 'var(--color-primary)' : 'transparent', color: !bgFilter ? '#fff' : 'var(--color-text-muted)', transition: 'all 150ms ease' }}
        >
          All Types
        </button>
        {BLOOD_GROUPS.map(bg => (
          <button
            key={bg.value}
            onClick={() => setBgFilter(bgFilter === bg.value ? '' : bg.value)}
            style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: `1px solid ${bgFilter === bg.value ? '#ef4444' : 'var(--color-border)'}`, backgroundColor: bgFilter === bg.value ? 'rgba(239,68,68,0.1)' : 'transparent', color: bgFilter === bg.value ? '#ef4444' : 'var(--color-text-muted)', transition: 'all 150ms ease' }}
          >
            {bg.label}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading requests…</p>
        </div>
      ) : requests.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', borderRadius: '14px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <p style={{ fontSize: '32px', marginBottom: '10px' }}>🩸</p>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>No active requests</p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {urgencyTab !== 'ALL' || bgFilter
              ? 'No requests match your current filter. Try clearing it.'
              : 'There are no active blood requests right now. Check back soon.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {requests.map(req => <PoolCard key={req.id} req={req} />)}
        </div>
      )}
    </div>
  );
}

/* ─── Pool Card ──────────────────────────────────────────────────────────────── */

function PoolCard({ req }: { req: PoolRequest }) {
  const urgency = URGENCY_META[req.urgency] ?? URGENCY_META.NORMAL;
  const statusColor = STATUS_COLOR[req.status] ?? '#6b7280';
  const hospital = req.hospital?.hospitalName ?? req.hospitalName ?? null;
  const city = req.patient.city ?? req.hospital?.address ?? null;
  const isAssigned = !!req.assignedDonorId;

  return (
    <div style={{
      borderRadius: '14px', overflow: 'hidden',
      border: `1px solid ${urgency.border}`,
      backgroundColor: 'var(--color-surface)',
    }}>
      {/* Top stripe — urgency + time */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', backgroundColor: urgency.bg, borderBottom: `1px solid ${urgency.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: urgency.dot, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: urgency.color, letterSpacing: '0.04em' }}>
            {urgency.label.toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isAssigned && (
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', backgroundColor: 'rgba(13,148,136,0.12)', color: '#0d9488' }}>
              Donor Assigned
            </span>
          )}
          <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '10px', backgroundColor: `${statusColor}15`, color: statusColor }}>
            {req.status.replace(/_/g, ' ')}
          </span>
          {/* Time elapsed */}
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
            🕐 {timeAgo(req.createdAt)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          {/* Left: blood group + details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            {/* Blood group badge */}
            <div style={{
              width: '52px', height: '52px', borderRadius: '12px', flexShrink: 0,
              backgroundColor: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '17px', fontWeight: 800, color: '#ef4444',
            }}>
              {fmtBG(req.bloodGroup)}
            </div>

            {/* Info */}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px' }}>
                {req.unitsNeeded} unit{req.unitsNeeded > 1 ? 's' : ''} of {fmtBG(req.bloodGroup)} blood needed
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {city && (
                  <InfoPill icon="📍" value={city} />
                )}
                {hospital && (
                  <InfoPill icon="🏥" value={hospital} />
                )}
                {req.department && (
                  <InfoPill icon="🏢" value={req.department} />
                )}
              </div>
            </div>
          </div>

          {/* Right: appointment + created */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {req.appointmentDate ? (
              <>
                <p style={{ fontSize: '10px', fontWeight: 500, color: 'var(--color-text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '3px' }}>Appointment</p>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', lineHeight: 1.4 }}>
                  {fmtAppt(req.appointmentDate)}
                </p>
              </>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Date TBD</p>
            )}
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Posted {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Notes (truncated) */}
        {req.notes && (
          <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📝 {req.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoPill({ icon, value }: { icon: string; value: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
      <span>{icon}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </span>
  );
}
