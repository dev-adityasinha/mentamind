'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface RankedDonor {
  donorId: string;
  bloodGroup: string;
  score: number;
  reasons: string[];
  donorName?: string;
}

interface AssignedDonor {
  id: string;
  user: { id: string; name: string };
  bloodGroup: string;
  city: string | null;
}

interface BloodRequest {
  id: string;
  bloodGroup: string;
  unitsNeeded: number;
  urgency: string;
  priorityLevel?: string;
  status: string;
  notes: string | null;
  matchedDonors: RankedDonor[] | null;
  assignedDonorId: string | null;
  assignedDonor: AssignedDonor | null;
  assignedAt: string | null;
  hospitalName?: string | null;
  department?: string | null;
  treatingDoctor?: string | null;
  bedNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: { user: { id: string; name: string; email: string } };
  hospital?: { hospitalName: string; address: string } | null;
}

interface EligibleDonor {
  donorId: string;
  name: string;
  bloodGroup: string;
  compatibility: 'exact' | 'compatible';
  city: string | null;
  totalDonations: number;
  responseScore: number;
  daysSinceDonation: number | null;
  donationEligible: boolean;
  location: { isSame: boolean; reason: string; distanceKm?: number };
  isEligible: boolean;
}

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const STATUS_META: Record<string, { color: string; bg: string; label: string; step: number }> = {
  DRAFT:                { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', label: 'Draft',                step: 0 },
  PENDING_VERIFICATION: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Pending Verification', step: 1 },
  VERIFIED:             { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  label: 'Verified',             step: 2 },
  MATCHING:             { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  label: 'Matching',             step: 3 },
  MATCHED:              { color: '#0d9488', bg: 'rgba(13,148,136,0.12)',  label: 'Matched',              step: 4 },
  IN_PROGRESS:          { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  label: 'In Progress',          step: 5 },
  FULFILLED:            { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   label: 'Fulfilled',            step: 6 },
  CANCELLED:            { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Cancelled',            step: -1 },
  REJECTED:             { color: '#dc2626', bg: 'rgba(220,38,38,0.12)',   label: 'Rejected',             step: -1 },
};

const URGENCY_META: Record<string, { color: string; bg: string; dot: string }> = {
  CRITICAL: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   dot: '#ef4444' },
  URGENT:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', dot: '#f59e0b' },
  NORMAL:   { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  dot: '#22c55e' },
};

const WORKFLOW_STEPS = [
  { key: 'DRAFT',                label: 'Draft' },
  { key: 'PENDING_VERIFICATION', label: 'Verification' },
  { key: 'VERIFIED',             label: 'Verified' },
  { key: 'MATCHING',             label: 'Matching' },
  { key: 'MATCHED',              label: 'Matched' },
  { key: 'IN_PROGRESS',          label: 'In Progress' },
  { key: 'FULFILLED',            label: 'Fulfilled' },
];

const NEXT_ACTIONS: Record<string, { label: string; status: string; color: string; icon: string }[]> = {
  DRAFT:                [{ label: 'Submit for Verification', status: 'PENDING_VERIFICATION', color: '#f59e0b', icon: '📋' },
                         { label: 'Cancel', status: 'CANCELLED', color: '#ef4444', icon: '✕' }],
  PENDING_VERIFICATION: [{ label: 'Approve & Verify', status: 'VERIFIED', color: '#3b82f6', icon: '✓' },
                         { label: 'Reject', status: 'REJECTED', color: '#dc2626', icon: '✕' }],
  VERIFIED:             [{ label: 'Cancel', status: 'CANCELLED', color: '#ef4444', icon: '✕' }],
  MATCHED:              [{ label: 'Begin Processing', status: 'IN_PROGRESS', color: '#f97316', icon: '▶' },
                         { label: 'Cancel', status: 'CANCELLED', color: '#ef4444', icon: '✕' }],
  IN_PROGRESS:          [{ label: 'Mark Fulfilled', status: 'FULFILLED', color: '#22c55e', icon: '✓' },
                         { label: 'Cancel', status: 'CANCELLED', color: '#ef4444', icon: '✕' }],
};

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function fmtBG(bg: string) { return bg.replace('_POS', '+').replace('_NEG', '−'); }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/* ─── Sub-components ────────────────────────────────────────────────────────── */

function InfoChip({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: accent ?? 'var(--color-text)' }}>
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
      {children}
    </p>
  );
}

/* ─── Main component ────────────────────────────────────────────────────────── */

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [request, setRequest] = useState<BloodRequest | null>(null);
  const [matchResults, setMatchResults] = useState<RankedDonor[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');

  const [eligibleDonors, setEligibleDonors] = useState<EligibleDonor[] | null>(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState('');
  const [assignError, setAssignError] = useState('');
  const [showAssignPanel, setShowAssignPanel] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (user) loadRequest();
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRequest = async () => {
    try {
      const data = await apiFetch<{ request: BloodRequest }>(`/blood-requests/${id}`);
      setRequest(data.request);
      if (data.request.matchedDonors) setMatchResults(data.request.matchedDonors as unknown as RankedDonor[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load request');
    } finally { setLoading(false); }
  };

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(newStatus); setError('');
    try {
      const data = await apiFetch<{ request: BloodRequest }>(`/blood-requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      setRequest(data.request);
    } catch (err) { setError(err instanceof Error ? err.message : 'Status update failed'); }
    finally { setActionLoading(''); }
  };

  const handleMatch = async () => {
    setActionLoading('MATCHING'); setError('');
    try {
      const data = await apiFetch<{ request: BloodRequest; matching: { rankedDonors: RankedDonor[] } }>(`/blood-requests/${id}/match`, { method: 'POST' });
      setRequest(data.request); setMatchResults(data.matching.rankedDonors);
    } catch (err) { setError(err instanceof Error ? err.message : 'Matching failed'); }
    finally { setActionLoading(''); }
  };

  const loadEligibleDonors = async () => {
    setEligibleLoading(true); setAssignError('');
    try {
      const data = await apiFetch<{ donors: EligibleDonor[] }>(`/blood-requests/${id}/eligible-donors`);
      setEligibleDonors(data.donors);
    } catch (err) { setAssignError(err instanceof Error ? err.message : 'Failed to load donors'); }
    finally { setEligibleLoading(false); }
  };

  const handleOpenAssignPanel = () => { setShowAssignPanel(true); if (!eligibleDonors) loadEligibleDonors(); };

  const handleAssignDonor = async (donorId: string) => {
    setAssignLoading(donorId); setAssignError('');
    try {
      const data = await apiFetch<{ request: BloodRequest }>(`/blood-requests/${id}/assign-donor`, { method: 'POST', body: JSON.stringify({ donorId }) });
      setRequest(data.request); setShowAssignPanel(false);
    } catch (err) { setAssignError(err instanceof Error ? err.message : 'Assignment failed'); }
    finally { setAssignLoading(''); }
  };

  const handleRemoveAssignment = async () => {
    setActionLoading('REMOVE_ASSIGN'); setError('');
    try {
      const data = await apiFetch<{ request: BloodRequest }>(`/blood-requests/${id}/assign-donor`, { method: 'DELETE' });
      setRequest(data.request); setEligibleDonors(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to remove assignment'); }
    finally { setActionLoading(''); }
  };

  /* ── Loading / error states ── */
  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading request…</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!request) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backgroundColor: 'var(--color-bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🩸</div>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '6px' }}>{error || 'Request not found'}</p>
          <button onClick={() => router.push('/dashboard/requests')} style={{ fontSize: '13px', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
            ← Back to Requests
          </button>
        </div>
      </div>
    );
  }

  const isAdmin    = user?.role === 'ADMIN' || user?.role === 'VOLUNTEER';
  const isHospital = user?.role === 'HOSPITAL' || user?.role === 'ADMIN';
  const actions    = NEXT_ACTIONS[request.status] ?? [];
  const canAssign  = isHospital && !['FULFILLED', 'CANCELLED', 'REJECTED'].includes(request.status);
  const statusMeta = STATUS_META[request.status] ?? STATUS_META.DRAFT;
  const urgencyMeta = URGENCY_META[request.urgency] ?? URGENCY_META.NORMAL;
  const currentStep = statusMeta.step;
  const isTerminal  = ['FULFILLED', 'CANCELLED', 'REJECTED'].includes(request.status);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* ── Back ── */}
        <button
          onClick={() => router.push('/dashboard/requests')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', padding: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          Back to Requests
        </button>

        {/* ── Error Banner ── */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span style={{ fontSize: '14px' }}>⚠</span>
            <p style={{ fontSize: '13px', color: '#ef4444', fontWeight: 500 }}>{error}</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            HERO CARD — blood group + key info
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{
          borderRadius: '16px', overflow: 'hidden', marginBottom: '12px',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}>
          {/* Urgency accent bar */}
          <div style={{ height: '3px', backgroundColor: urgencyMeta.dot, opacity: 0.9 }} />

          <div style={{ padding: '24px' }}>
            {/* Row 1: blood group + status */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Blood group badge */}
                <div style={{
                  width: '72px', height: '72px', borderRadius: '16px', flexShrink: 0,
                  backgroundColor: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', fontWeight: 800, color: '#ef4444', letterSpacing: '-0.02em',
                }}>
                  {fmtBG(request.bloodGroup)}
                </div>
                <div>
                  <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', marginBottom: '4px' }}>
                    {request.unitsNeeded} unit{request.unitsNeeded > 1 ? 's' : ''} of blood needed
                  </h1>
                  {request.patient?.user && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#fff',
                      }}>
                        {initials(request.patient.user.name)}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                        {request.patient.user.name}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status pill */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                <span style={{
                  fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
                  padding: '5px 12px', borderRadius: '20px',
                  backgroundColor: statusMeta.bg, color: statusMeta.color,
                  border: `1px solid ${statusMeta.color}30`,
                }}>
                  {statusMeta.label.toUpperCase()}
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
                  backgroundColor: urgencyMeta.bg, color: urgencyMeta.color,
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: urgencyMeta.dot, display: 'inline-block' }} />
                  {request.urgency}
                </span>
              </div>
            </div>

            {/* Info grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '16px',
              padding: '16px', borderRadius: '10px', backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)', marginBottom: request.notes ? '16px' : 0,
            }}>
              <InfoChip label="Units" value={`${request.unitsNeeded}`} />
              <InfoChip label="Urgency" value={request.urgency} accent={urgencyMeta.color} />
              {(request.hospitalName || request.hospital?.hospitalName) && (
                <InfoChip label="Hospital" value={request.hospitalName ?? request.hospital?.hospitalName ?? ''} />
              )}
              {request.department && <InfoChip label="Department" value={request.department} />}
              {request.treatingDoctor && <InfoChip label="Doctor" value={request.treatingDoctor} />}
              {request.bedNumber && <InfoChip label="Bed No." value={request.bedNumber} />}
              <InfoChip label="Created" value={fmtDate(request.createdAt)} />
              <InfoChip label="Updated" value={fmtDate(request.updatedAt)} />
              <InfoChip label="Request ID" value={`#${request.id.slice(0, 8).toUpperCase()}`} />
            </div>

            {/* Notes */}
            {request.notes && (
              <div style={{
                display: 'flex', gap: '10px', padding: '12px 14px', borderRadius: '10px',
                backgroundColor: request.urgency === 'CRITICAL' ? 'rgba(239,68,68,0.05)' : 'var(--color-bg)',
                border: `1px solid ${request.urgency === 'CRITICAL' ? 'rgba(239,68,68,0.2)' : 'var(--color-border)'}`,
              }}>
                <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>
                  {request.urgency === 'CRITICAL' ? '🚨' : request.urgency === 'URGENT' ? '⚠️' : '📝'}
                </span>
                <p style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.6, fontWeight: request.urgency === 'CRITICAL' ? 500 : 400 }}>
                  {request.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            STATUS PROGRESS TIMELINE
        ══════════════════════════════════════════════════════════════════ */}
        {!isTerminal && (
          <div style={{
            padding: '16px 20px', borderRadius: '12px', marginBottom: '12px',
            border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
          }}>
            <SectionTitle>Request Progress</SectionTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {WORKFLOW_STEPS.map((step, idx) => {
                const done    = currentStep > idx;
                const active  = currentStep === idx;
                const isLast  = idx === WORKFLOW_STEPS.length - 1;
                const color   = done || active ? 'var(--color-primary)' : 'var(--color-border)';
                return (
                  <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 0 : 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${color}`,
                        backgroundColor: done ? 'var(--color-primary)' : active ? 'var(--color-primary)' : 'var(--color-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 700,
                        color: done || active ? '#fff' : 'var(--color-text-muted)',
                        boxShadow: active ? `0 0 0 3px ${statusMeta.color}30` : 'none',
                      }}>
                        {done ? '✓' : idx + 1}
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: 500, color: active ? 'var(--color-text)' : 'var(--color-text-muted)', whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>
                        {step.label}
                      </span>
                    </div>
                    {!isLast && (
                      <div style={{ flex: 1, height: '2px', backgroundColor: done ? 'var(--color-primary)' : 'var(--color-border)', margin: '0 4px', marginBottom: '16px', borderRadius: '1px' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ADMIN / VOLUNTEER ACTIONS
        ══════════════════════════════════════════════════════════════════ */}
        {isAdmin && !isTerminal && (
          <div style={{
            padding: '16px 20px', borderRadius: '12px', marginBottom: '12px',
            border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
          }}>
            <SectionTitle>Admin Actions</SectionTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {request.status === 'VERIFIED' && (
                <button
                  onClick={handleMatch}
                  disabled={!!actionLoading}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    fontSize: '13px', fontWeight: 600, color: '#fff', backgroundColor: '#8b5cf6',
                    opacity: actionLoading ? 0.6 : 1, transition: 'opacity 150ms ease',
                  }}
                >
                  <span>🔍</span>
                  {actionLoading === 'MATCHING' ? 'Finding Donors…' : 'Find Matching Donors'}
                </button>
              )}
              {actions.map((action) => (
                <button
                  key={action.status}
                  onClick={() => handleStatusChange(action.status)}
                  disabled={!!actionLoading}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', borderRadius: '8px', border: `1px solid ${action.color}40`, cursor: 'pointer',
                    fontSize: '13px', fontWeight: 600,
                    color: action.status === 'CANCELLED' || action.status === 'REJECTED' ? action.color : '#fff',
                    backgroundColor: action.status === 'CANCELLED' || action.status === 'REJECTED' ? 'transparent' : action.color,
                    opacity: actionLoading ? 0.6 : 1, transition: 'opacity 150ms ease',
                  }}
                >
                  <span>{action.icon}</span>
                  {actionLoading === action.status ? 'Updating…' : action.label}
                </button>
              ))}
              {actions.length === 0 && request.status !== 'VERIFIED' && (
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No actions available at this stage.</p>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            HOSPITAL: ASSIGNED DONOR (when set)
        ══════════════════════════════════════════════════════════════════ */}
        {canAssign && request.assignedDonor && (
          <div style={{
            padding: '16px 20px', borderRadius: '12px', marginBottom: '12px',
            border: '1px solid rgba(34,197,94,0.25)', backgroundColor: 'var(--color-surface)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <SectionTitle>Assigned Donor</SectionTitle>
              <button
                onClick={handleRemoveAssignment}
                disabled={!!actionLoading}
                style={{
                  fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '6px',
                  border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'transparent',
                  color: '#ef4444', cursor: 'pointer', opacity: actionLoading ? 0.5 : 1,
                }}
              >
                {actionLoading === 'REMOVE_ASSIGN' ? 'Removing…' : 'Remove'}
              </button>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '10px',
              backgroundColor: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)',
            }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: '#fff',
              }}>✓</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
                  {request.assignedDonor.user.name}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                    {fmtBG(request.assignedDonor.bloodGroup)}
                  </span>
                  {request.assignedDonor.city && (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      📍 {request.assignedDonor.city}
                    </span>
                  )}
                  {request.assignedAt && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Assigned {fmtDateTime(request.assignedAt)}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', backgroundColor: 'rgba(34,197,94,0.12)', color: '#22c55e', flexShrink: 0 }}>
                CONFIRMED
              </span>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            HOSPITAL: ASSIGN DONOR PANEL (when no donor assigned yet)
        ══════════════════════════════════════════════════════════════════ */}
        {canAssign && !request.assignedDonor && (
          <div style={{
            borderRadius: '12px', marginBottom: '12px', overflow: 'hidden',
            border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
          }}>
            {/* Panel header */}
            <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: showAssignPanel ? '1px solid var(--color-border)' : 'none' }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '2px' }}>Assign Donor</p>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Only donors in the same city with a compatible blood group are shown
                </p>
              </div>
              <button
                onClick={showAssignPanel ? () => setShowAssignPanel(false) : handleOpenAssignPanel}
                style={{
                  padding: '7px 16px', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 600, flexShrink: 0,
                  backgroundColor: showAssignPanel ? 'var(--color-bg)' : 'var(--color-primary)',
                  color: showAssignPanel ? 'var(--color-text-muted)' : '#fff',
                  border: showAssignPanel ? '1px solid var(--color-border)' : '1px solid transparent',
                }}
              >
                {showAssignPanel ? 'Close' : '＋ Find Donor'}
              </button>
            </div>

            {/* Panel body */}
            {showAssignPanel && (
              <div style={{ padding: '16px 20px' }}>
                {assignError && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500 }}>⚠ {assignError}</p>
                  </div>
                )}

                {eligibleLoading ? (
                  <div style={{ padding: '32px 0', textAlign: 'center' }}>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Searching eligible donors…</p>
                  </div>
                ) : eligibleDonors && eligibleDonors.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', borderRadius: '10px', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                    <p style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</p>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>No eligible donors found</p>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      No available donors with a matching blood group in the same city.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Summary line */}
                    {eligibleDonors && (
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px', fontWeight: 500 }}>
                        {eligibleDonors.filter(d => d.isEligible).length} eligible · {eligibleDonors.filter(d => !d.isEligible).length} ineligible
                      </p>
                    )}

                    {(eligibleDonors ?? []).map((donor) => (
                      <div
                        key={donor.donorId}
                        style={{
                          borderRadius: '10px', overflow: 'hidden',
                          border: `1px solid ${donor.isEligible ? 'rgba(34,197,94,0.2)' : 'var(--color-border)'}`,
                          backgroundColor: donor.isEligible ? 'rgba(34,197,94,0.03)' : 'rgba(107,114,128,0.03)',
                        }}
                      >
                        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                          {/* Avatar + Info */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                            <div style={{
                              width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                              backgroundColor: donor.isEligible ? 'var(--color-primary)' : '#9ca3af',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '13px', fontWeight: 700, color: '#fff',
                            }}>
                              {initials(donor.name)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              {/* Name + badges row */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{donor.name}</span>
                                <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                                  {fmtBG(donor.bloodGroup)}
                                </span>
                                {donor.compatibility === 'exact'
                                  ? <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>Exact match</span>
                                  : <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>Compatible</span>
                                }
                              </div>
                              {/* Metadata row */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                <span style={{ fontSize: '11px', color: donor.location.isSame ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  📍 {donor.location.reason}
                                </span>
                                <span style={{ fontSize: '11px', color: donor.donationEligible ? 'var(--color-text-muted)' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  🩸 {donor.daysSinceDonation === null ? 'Never donated' : `${donor.daysSinceDonation}d since donation`}
                                  {!donor.donationEligible && <span style={{ color: '#f59e0b', fontWeight: 600 }}> · too soon</span>}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                  {donor.totalDonations} donation{donor.totalDonations !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Assign button */}
                          <button
                            onClick={() => handleAssignDonor(donor.donorId)}
                            disabled={!donor.isEligible || !!assignLoading}
                            style={{
                              flexShrink: 0, padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                              cursor: donor.isEligible ? 'pointer' : 'not-allowed',
                              backgroundColor: donor.isEligible ? '#22c55e' : 'transparent',
                              color: donor.isEligible ? '#fff' : '#9ca3af',
                              border: donor.isEligible ? 'none' : '1px solid var(--color-border)',
                              opacity: assignLoading === donor.donorId ? 0.7 : 1,
                              transition: 'opacity 150ms ease',
                            }}
                          >
                            {assignLoading === donor.donorId ? '…' : donor.isEligible ? 'Assign' : 'Ineligible'}
                          </button>
                        </div>

                        {/* Ineligibility reason bar */}
                        {!donor.isEligible && (
                          <div style={{ padding: '6px 14px 8px', backgroundColor: 'rgba(245,158,11,0.06)', borderTop: '1px solid rgba(245,158,11,0.15)' }}>
                            <p style={{ fontSize: '10px', fontWeight: 600, color: '#f59e0b' }}>
                              ⚠ Not eligible: {!donor.location.isSame ? 'donor city not matching patient city' : 'donated less than 56 days ago'}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ALGORITHM-MATCHED DONORS (from auto-match)
        ══════════════════════════════════════════════════════════════════ */}
        {matchResults && matchResults.length > 0 && (
          <div style={{
            padding: '16px 20px', borderRadius: '12px', marginBottom: '12px',
            border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
          }}>
            <SectionTitle>Algorithm-Matched Donors ({matchResults.length})</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {matchResults.map((donor, i) => (
                <div
                  key={donor.donorId || i}
                  style={{
                    padding: '12px 14px', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
                    backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
                    {/* Rank badge */}
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
                      backgroundColor: i < 3 ? 'var(--color-primary)' : 'var(--color-surface)',
                      border: i >= 3 ? '1px solid var(--color-border)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700,
                      color: i < 3 ? '#fff' : 'var(--color-text-muted)',
                    }}>#{i + 1}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                          {donor.donorName || `Donor ${donor.donorId?.slice(0, 6)}`}
                        </p>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                          {fmtBG(donor.bloodGroup)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {donor.reasons.map((reason, j) => (
                          <p key={j} style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: 'var(--color-primary)', fontSize: '8px' }}>●</span> {reason}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '20px', fontWeight: 800, color: i < 3 ? 'var(--color-primary)' : 'var(--color-text-muted)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {typeof donor.score === 'number' ? donor.score.toFixed(0) : donor.score}
                    </p>
                    <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>SCORE</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── No matches message ── */}
        {request.status === 'MATCHED' && (!matchResults || matchResults.length === 0) && (
          <div style={{ padding: '32px 16px', textAlign: 'center', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <p style={{ fontSize: '28px', marginBottom: '8px' }}>🩸</p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              No matching donors found. Try again when more donors are registered in the area.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
