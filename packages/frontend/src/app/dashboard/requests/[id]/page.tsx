'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

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
  status: string;
  notes: string | null;
  matchedDonors: RankedDonor[] | null;
  assignedDonorId: string | null;
  assignedDonor: AssignedDonor | null;
  assignedAt: string | null;
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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6B7280',
  PENDING_VERIFICATION: '#F59E0B',
  VERIFIED: '#3B82F6',
  MATCHING: '#8B5CF6',
  MATCHED: '#0D9488',
  IN_PROGRESS: '#F97316',
  FULFILLED: '#22C55E',
  CANCELLED: '#EF4444',
  REJECTED: '#DC2626',
};

// Transitions available from each status (for admin buttons)
const NEXT_ACTIONS: Record<string, { label: string; status: string; color: string }[]> = {
  DRAFT: [
    { label: 'Submit for Verification', status: 'PENDING_VERIFICATION', color: '#F59E0B' },
    { label: 'Cancel', status: 'CANCELLED', color: '#EF4444' },
  ],
  PENDING_VERIFICATION: [
    { label: 'Approve (Verify)', status: 'VERIFIED', color: '#3B82F6' },
    { label: 'Reject', status: 'REJECTED', color: '#DC2626' },
  ],
  VERIFIED: [
    { label: 'Cancel', status: 'CANCELLED', color: '#EF4444' },
  ],
  MATCHED: [
    { label: 'Begin Processing', status: 'IN_PROGRESS', color: '#F97316' },
    { label: 'Cancel', status: 'CANCELLED', color: '#EF4444' },
  ],
  IN_PROGRESS: [
    { label: 'Mark Fulfilled', status: 'FULFILLED', color: '#22C55E' },
    { label: 'Cancel', status: 'CANCELLED', color: '#EF4444' },
  ],
};

function formatBloodGroup(bg: string) {
  return bg.replace('_POS', '+').replace('_NEG', '−');
}

function formatStatus(s: string) {
  return s.replace(/_/g, ' ');
}

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [request, setRequest] = useState<BloodRequest | null>(null);
  const [matchResults, setMatchResults] = useState<RankedDonor[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');

  // Assign-donor state (hospital role)
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
      if (data.request.matchedDonors) {
        // matchedDonors might be the full RankedDonor array or a simplified version
        setMatchResults(data.request.matchedDonors as unknown as RankedDonor[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load request');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(newStatus);
    setError('');
    try {
      const data = await apiFetch<{ request: BloodRequest }>(`/blood-requests/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setRequest(data.request);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setActionLoading('');
    }
  };

  const handleMatch = async () => {
    setActionLoading('MATCHING');
    setError('');
    try {
      const data = await apiFetch<{
        request: BloodRequest;
        matching: { eligibleDonorsFound: number; rankedDonors: RankedDonor[] };
      }>(`/blood-requests/${id}/match`, { method: 'POST' });
      setRequest(data.request);
      setMatchResults(data.matching.rankedDonors);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Matching failed');
    } finally {
      setActionLoading('');
    }
  };

  const loadEligibleDonors = async () => {
    setEligibleLoading(true);
    setAssignError('');
    try {
      const data = await apiFetch<{ donors: EligibleDonor[]; patientCity: string | null; eligibleCount: number }>(
        `/blood-requests/${id}/eligible-donors`,
      );
      setEligibleDonors(data.donors);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to load eligible donors');
    } finally {
      setEligibleLoading(false);
    }
  };

  const handleOpenAssignPanel = () => {
    setShowAssignPanel(true);
    if (!eligibleDonors) loadEligibleDonors();
  };

  const handleAssignDonor = async (donorId: string) => {
    setAssignLoading(donorId);
    setAssignError('');
    try {
      const data = await apiFetch<{ request: BloodRequest; assignment: { donorName: string; donorBloodGroup: string; locationReason: string } }>(
        `/blood-requests/${id}/assign-donor`,
        { method: 'POST', body: JSON.stringify({ donorId }) },
      );
      setRequest(data.request);
      setShowAssignPanel(false);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setAssignLoading('');
    }
  };

  const handleRemoveAssignment = async () => {
    setActionLoading('REMOVE_ASSIGN');
    setError('');
    try {
      const data = await apiFetch<{ request: BloodRequest }>(
        `/blood-requests/${id}/assign-donor`,
        { method: 'DELETE' },
      );
      setRequest(data.request);
      setEligibleDonors(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove assignment');
    } finally {
      setActionLoading('');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--color-primary)' }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span style={{ color: 'var(--color-text-muted)' }}>Loading...</span>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-center">
          <p className="text-lg mb-4" style={{ color: 'var(--color-error)' }}>{error || 'Request not found'}</p>
          <button onClick={() => router.push('/dashboard/requests')} className="text-sm font-medium" style={{ color: 'var(--color-primary-light)' }}>
            ← Back to Requests
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'VOLUNTEER';
  const isHospital = user?.role === 'HOSPITAL' || user?.role === 'ADMIN';
  const actions = NEXT_ACTIONS[request.status] || [];
  const canAssign = isHospital && !['FULFILLED', 'CANCELLED', 'REJECTED'].includes(request.status);

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.push('/dashboard/requests')} className="text-sm mb-6 inline-block" style={{ color: 'var(--color-text-muted)' }}>
          ← Back to Requests
        </button>

        {error && (
          <div className="px-4 py-3 rounded-xl text-sm mb-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {error}
          </div>
        )}

        {/* Request header */}
        <div className="p-6 rounded-2xl border mb-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold px-4 py-2 rounded-xl" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
                {formatBloodGroup(request.bloodGroup)}
              </span>
              <div>
                <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
                  {request.unitsNeeded} unit{request.unitsNeeded > 1 ? 's' : ''} needed
                </h1>
                {request.patient?.user && (
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Requested by {request.patient.user.name}
                  </p>
                )}
              </div>
            </div>
            <span
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: `${STATUS_COLORS[request.status]}20`,
                color: STATUS_COLORS[request.status],
              }}
            >
              {formatStatus(request.status)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Urgency</p>
              <p className="font-medium" style={{ color: 'var(--color-text)' }}>{request.urgency}</p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Created</p>
              <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                {new Date(request.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Updated</p>
              <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                {new Date(request.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>ID</p>
              <p className="font-mono text-xs truncate" style={{ color: 'var(--color-text)' }}>{request.id.slice(0, 8)}...</p>
            </div>
          </div>

          {request.notes && (
            <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Notes</p>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>{request.notes}</p>
            </div>
          )}
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="p-5 rounded-2xl border mb-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Actions
            </h2>
            <div className="flex flex-wrap gap-2">
              {/* Match donors button (only when VERIFIED) */}
              {request.status === 'VERIFIED' && (
                <button
                  onClick={handleMatch}
                  disabled={!!actionLoading}
                  className="px-4 py-2 rounded-xl text-white text-sm font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{ backgroundColor: '#8B5CF6' }}
                >
                  {actionLoading === 'MATCHING' ? 'Finding Donors...' : '🔍 Find Matching Donors'}
                </button>
              )}

              {/* Status transition buttons */}
              {actions.map((action) => (
                <button
                  key={action.status}
                  onClick={() => handleStatusChange(action.status)}
                  disabled={!!actionLoading}
                  className="px-4 py-2 rounded-xl text-white text-sm font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{ backgroundColor: action.color }}
                >
                  {actionLoading === action.status ? 'Updating...' : action.label}
                </button>
              ))}

              {actions.length === 0 && request.status !== 'VERIFIED' && (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  No actions available for this status.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Hospital: Assigned Donor ──────────────────────────────────── */}
        {canAssign && request.assignedDonor && (
          <div className="p-5 rounded-2xl border mb-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'rgba(34,197,94,0.3)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Assigned Donor
              </h2>
              <button
                onClick={handleRemoveAssignment}
                disabled={!!actionLoading}
                className="text-xs font-medium px-3 py-1 rounded-lg border"
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'transparent', cursor: 'pointer', opacity: actionLoading ? 0.5 : 1 }}
              >
                {actionLoading === 'REMOVE_ASSIGN' ? 'Removing…' : 'Remove Assignment'}
              </button>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ backgroundColor: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: '#22c55e' }}>
                ✓
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{request.assignedDonor.user.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                    {formatBloodGroup(request.assignedDonor.bloodGroup)}
                  </span>
                  {request.assignedDonor.city && (
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>📍 {request.assignedDonor.city}</span>
                  )}
                  {request.assignedAt && (
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Assigned {new Date(request.assignedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Hospital: Assign Donor Button / Panel ─────────────────────── */}
        {canAssign && !request.assignedDonor && (
          <div className="p-5 rounded-2xl border mb-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  Assign Donor
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Only donors in the same city with a compatible blood group are shown.
                </p>
              </div>
              {!showAssignPanel && (
                <button
                  onClick={handleOpenAssignPanel}
                  className="px-4 py-2 rounded-xl text-white text-sm font-medium"
                  style={{ backgroundColor: 'var(--color-primary)', cursor: 'pointer', border: 'none' }}
                >
                  Find & Assign Donor
                </button>
              )}
            </div>

            {showAssignPanel && (
              <>
                {assignError && (
                  <div className="mb-3 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {assignError}
                  </div>
                )}

                {eligibleLoading ? (
                  <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>Searching eligible donors…</p>
                ) : eligibleDonors && eligibleDonors.length === 0 ? (
                  <div className="text-center py-6 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>No eligible donors found</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      No available donors with a compatible blood group in the same city.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(eligibleDonors ?? []).map((donor) => (
                      <div
                        key={donor.donorId}
                        className="p-4 rounded-xl border flex items-center justify-between gap-3"
                        style={{
                          backgroundColor: donor.isEligible ? 'var(--color-bg)' : 'rgba(107,114,128,0.04)',
                          borderColor: donor.isEligible ? 'var(--color-border)' : 'rgba(107,114,128,0.15)',
                          opacity: donor.isEligible ? 1 : 0.6,
                        }}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: donor.isEligible ? 'var(--color-primary)' : '#9ca3af' }}
                          >
                            {donor.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{donor.name}</p>
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                                {formatBloodGroup(donor.bloodGroup)}
                              </span>
                              {donor.compatibility === 'exact' ? (
                                <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>Exact match</span>
                              ) : (
                                <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>Compatible</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              <p className="text-xs" style={{ color: donor.location.isSame ? '#22c55e' : '#ef4444' }}>
                                📍 {donor.location.reason}
                              </p>
                              <p className="text-xs" style={{ color: donor.donationEligible ? 'var(--color-text-muted)' : '#ef4444' }}>
                                🩸 {donor.daysSinceDonation === null ? 'Never donated' : `${donor.daysSinceDonation}d since donation`}
                                {!donor.donationEligible && ' (not eligible yet)'}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {donor.totalDonations} donation{donor.totalDonations !== 1 ? 's' : ''} · score {donor.responseScore.toFixed(1)}
                              </p>
                            </div>
                            {!donor.isEligible && (
                              <p className="text-xs mt-1 font-medium" style={{ color: '#f59e0b' }}>
                                ⚠ Not eligible: {!donor.location.isSame ? 'different location' : 'recent donation'}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleAssignDonor(donor.donorId)}
                          disabled={!donor.isEligible || !!assignLoading}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                          style={{
                            backgroundColor: donor.isEligible ? 'var(--color-primary)' : 'transparent',
                            color: donor.isEligible ? '#fff' : 'var(--color-text-muted)',
                            border: donor.isEligible ? 'none' : '1px solid var(--color-border)',
                            cursor: donor.isEligible ? 'pointer' : 'not-allowed',
                            opacity: assignLoading === donor.donorId ? 0.6 : 1,
                          }}
                        >
                          {assignLoading === donor.donorId ? 'Assigning…' : donor.isEligible ? 'Assign' : 'Ineligible'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setShowAssignPanel(false)}
                  className="mt-3 text-xs"
                  style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}

        {/* Matched donors */}
        {matchResults && matchResults.length > 0 && (
          <div className="p-5 rounded-2xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Matched Donors ({matchResults.length})
            </h2>
            <div className="space-y-3">
              {matchResults.map((donor, i) => (
                <div
                  key={donor.donorId || i}
                  className="p-4 rounded-xl border flex items-start justify-between"
                  style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: i < 3 ? 'var(--color-primary)' : '#6B7280' }}
                    >
                      #{i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {donor.donorName || `Donor ${donor.donorId?.slice(0, 6)}`}
                      </p>
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
                        {formatBloodGroup(donor.bloodGroup)}
                      </span>
                      <div className="mt-1.5 space-y-0.5">
                        {donor.reasons.map((reason, j) => (
                          <p key={j} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            • {reason}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold" style={{ color: 'var(--color-primary-light)' }}>
                      {donor.score}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>score</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No matches message */}
        {request.status === 'MATCHED' && (!matchResults || matchResults.length === 0) && (
          <div className="text-center py-8 rounded-2xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No matching donors found. Try again later when more donors are available.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
