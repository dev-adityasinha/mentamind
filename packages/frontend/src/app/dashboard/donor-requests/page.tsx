'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface AssignedRequest {
  id: string;
  bloodGroup: string;
  unitsNeeded: number;
  urgency: string;
  status: string;
  notes: string | null;
  appointmentDate: string | null;
  assignedAt: string | null;
  donorResponseStatus: string;
  hospitalName: string | null;
  department: string | null;
  treatingDoctor: string | null;
  bedNumber: string | null;
  patient: { city: string | null; address: string | null; user: { name: string } };
  hospital: { hospitalName: string; address: string; phone: string; latitude: number | null; longitude: number | null } | null;
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const URGENCY_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444', URGENT: '#f59e0b', NORMAL: '#22c55e',
};

const RESPONSE_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:  { label: 'Awaiting Your Response', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  ACCEPTED: { label: 'Accepted',               color: '#22c55e', bg: 'rgba(34,197,94,0.1)'   },
  DECLINED: { label: 'Declined',               color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
};

function fmtBG(bg: string) { return bg.replace('_POS', '+').replace('_NEG', '−'); }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ─── Decline Modal ──────────────────────────────────────────────────────────── */

function DeclineModal({ onConfirm, onCancel, loading }: { onConfirm: (reason: string) => void; onCancel: () => void; loading: boolean }) {
  const [reason, setReason] = useState('');
  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        width: '100%', maxWidth: '440px', borderRadius: '16px', padding: '24px',
        backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px' }}>
          Decline this request?
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
          Please let us know why you can't donate right now. This helps the patient understand and find another donor quickly.
        </p>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. I am travelling, unwell, recently donated…"
            rows={3}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px', fontSize: '13px',
              backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
              border: '1px solid var(--color-border)', resize: 'none', boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '6px' }}>
            ⚠ Your availability will be marked as <strong>Unavailable</strong> after declining.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: '1px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: 'none', backgroundColor: '#ef4444', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Declining…' : 'Confirm Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */

export default function DonorRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<AssignedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState('');
  const [declineTarget, setDeclineTarget] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ requests: AssignedRequest[] }>('/blood-requests/my-assignments');
      setRequests(data.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const respond = async (id: string, response: 'ACCEPTED' | 'DECLINED', declineReason?: string) => {
    setRespondingId(id);
    try {
      await apiFetch(`/blood-requests/${id}/donor-response`, {
        method: 'POST',
        body: JSON.stringify({ response, declineReason }),
      });
      // Refresh
      const data = await apiFetch<{ requests: AssignedRequest[] }>('/blood-requests/my-assignments');
      setRequests(data.requests);
      setDeclineTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Response failed');
    } finally {
      setRespondingId('');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '32px' }}>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading your assignments…</p>
      </div>
    );
  }

  const pending   = requests.filter(r => r.donorResponseStatus === 'PENDING');
  const responded = requests.filter(r => r.donorResponseStatus !== 'PENDING');

  return (
    <>
      {declineTarget && (
        <DeclineModal
          onConfirm={(reason) => respond(declineTarget, 'DECLINED', reason)}
          onCancel={() => setDeclineTarget(null)}
          loading={respondingId === declineTarget}
        />
      )}

      <div style={{ padding: '32px', maxWidth: '720px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            My Assignments
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Blood requests assigned to you by hospitals. Please respond as soon as possible.
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px 14px', borderRadius: '8px', marginBottom: '16px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p style={{ fontSize: '13px', color: '#ef4444' }}>⚠ {error}</p>
          </div>
        )}

        {requests.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <p style={{ fontSize: '32px', marginBottom: '10px' }}>🩸</p>
            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '4px' }}>No assignments yet</p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>When a hospital assigns you to a patient, it will appear here.</p>
          </div>
        ) : (
          <>
            {/* Pending — needs response */}
            {pending.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f59e0b' }}>
                    Needs Your Response
                  </p>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                    {pending.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pending.map(req => (
                    <RequestCard
                      key={req.id}
                      req={req}
                      onAccept={() => respond(req.id, 'ACCEPTED')}
                      onDecline={() => setDeclineTarget(req.id)}
                      responding={respondingId === req.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Already responded */}
            {responded.length > 0 && (
              <div>
                <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                  Past Responses
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {responded.map(req => (
                    <RequestCard key={req.id} req={req} responding={false} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ─── Request Card ───────────────────────────────────────────────────────────── */

function RequestCard({
  req, onAccept, onDecline, responding,
}: {
  req: AssignedRequest;
  onAccept?: () => void;
  onDecline?: () => void;
  responding: boolean;
}) {
  const isPending   = req.donorResponseStatus === 'PENDING';
  const isAccepted  = req.donorResponseStatus === 'ACCEPTED';
  const respMeta    = RESPONSE_META[req.donorResponseStatus] ?? RESPONSE_META.PENDING;
  const hospitalStr = req.hospital?.hospitalName ?? req.hospitalName ?? 'Hospital not specified';
  const hospitalAddr = req.hospital?.address ?? '';

  return (
    <div style={{
      borderRadius: '14px', overflow: 'hidden',
      border: `1px solid ${isPending ? 'rgba(245,158,11,0.3)' : 'var(--color-border)'}`,
      backgroundColor: 'var(--color-surface)',
    }}>
      {/* Urgency accent + response badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: `${URGENCY_COLOR[req.urgency]}08`, borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: URGENCY_COLOR[req.urgency], display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: URGENCY_COLOR[req.urgency], letterSpacing: '0.04em' }}>
            {req.urgency} URGENCY
          </span>
        </div>
        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', backgroundColor: respMeta.bg, color: respMeta.color }}>
          {respMeta.label}
        </span>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Blood group + patient */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '12px', flexShrink: 0,
            backgroundColor: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 800, color: '#ef4444',
          }}>
            {fmtBG(req.bloodGroup)}
          </div>
          <div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '3px' }}>
              {req.unitsNeeded} unit{req.unitsNeeded > 1 ? 's' : ''} needed
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Patient: <strong style={{ color: 'var(--color-text)' }}>{req.patient.user.name}</strong>
            </p>
          </div>
        </div>

        {/* Detail grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
          padding: '12px', borderRadius: '10px', backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)', marginBottom: req.notes || isPending || isAccepted ? '12px' : 0,
        }}>
          {req.appointmentDate && (
            <DetailItem icon="📅" label="Appointment" value={fmtDateTime(req.appointmentDate)} wide />
          )}
          <DetailItem icon="🏥" label="Hospital" value={hospitalStr} />
          {hospitalAddr && <DetailItem icon="📍" label="Hospital Address" value={hospitalAddr} />}
          {req.department && <DetailItem icon="🏢" label="Department" value={req.department} />}
          {req.treatingDoctor && <DetailItem icon="👨‍⚕️" label="Doctor" value={req.treatingDoctor} />}
          {req.bedNumber && <DetailItem icon="🛏" label="Bed No." value={req.bedNumber} />}
          {req.patient.city && <DetailItem icon="📍" label="Patient City" value={req.patient.city} />}
          {req.assignedAt && <DetailItem icon="🕐" label="Assigned At" value={fmtDate(req.assignedAt)} />}
        </div>

        {/* Notes */}
        {req.notes && (
          <div style={{ padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', backgroundColor: req.urgency === 'CRITICAL' ? 'rgba(239,68,68,0.05)' : 'var(--color-bg)', border: `1px solid ${req.urgency === 'CRITICAL' ? 'rgba(239,68,68,0.15)' : 'var(--color-border)'}` }}>
            <p style={{ fontSize: '12px', color: 'var(--color-text)', lineHeight: 1.6 }}>
              {req.urgency === 'CRITICAL' ? '🚨 ' : '📝 '}{req.notes}
            </p>
          </div>
        )}

        {/* Accept / Decline buttons (pending only) */}
        {isPending && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onAccept}
              disabled={responding}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: responding ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: 700, backgroundColor: '#22c55e', color: '#fff',
                opacity: responding ? 0.7 : 1, transition: 'opacity 150ms ease',
              }}
            >
              {responding ? 'Saving…' : '✓  I Am Available — Accept'}
            </button>
            <button
              onClick={onDecline}
              disabled={responding}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', cursor: responding ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: 700, backgroundColor: 'transparent', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.3)', opacity: responding ? 0.7 : 1,
              }}
            >
              ✕  Not Available — Decline
            </button>
          </div>
        )}

        {/* Accepted confirmation */}
        {isAccepted && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>✅</span>
            <p style={{ fontSize: '12px', fontWeight: 500, color: '#22c55e' }}>
              You accepted this request. Please arrive at the hospital on the appointment date.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value, wide }: { icon: string; label: string; value: string; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined }}>
      <p style={{ fontSize: '10px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '2px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {icon} {label}
      </p>
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.4 }}>{value}</p>
    </div>
  );
}
