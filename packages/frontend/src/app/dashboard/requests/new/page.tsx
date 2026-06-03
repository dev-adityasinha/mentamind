'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import DateTimePicker from '@/lib/DateTimePicker';

const BLOOD_GROUPS = [
  { value: 'A_POS', label: 'A+' },
  { value: 'A_NEG', label: 'A−' },
  { value: 'B_POS', label: 'B+' },
  { value: 'B_NEG', label: 'B−' },
  { value: 'AB_POS', label: 'AB+' },
  { value: 'AB_NEG', label: 'AB−' },
  { value: 'O_POS', label: 'O+' },
  { value: 'O_NEG', label: 'O−' },
];

const URGENCY_LEVELS = [
  { value: 'NORMAL', label: 'Normal', color: '#22c55e' },
  { value: 'URGENT', label: 'Urgent', color: '#f59e0b' },
  { value: 'CRITICAL', label: 'Critical', color: '#ef4444' },
];

export default function NewRequestPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [bloodGroup, setBloodGroup] = useState('');
  const [unitsNeeded, setUnitsNeeded] = useState(1);
  const [urgency, setUrgency] = useState('NORMAL');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const today = new Date();

  if (!user) return null;

  if (!user.identityVerified) {
    return (
      <div style={{ padding: '32px', maxWidth: '400px' }}>
        <div style={{
          padding: '24px', borderRadius: '14px', textAlign: 'center',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '8px' }}>
            Identity Verification Required
          </p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
            You must verify your identity before creating a blood request.
          </p>
          <Link href="/dashboard/verify" className="btn-primary">
            Verify Identity
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bloodGroup) { setError('Please select a blood group'); return; }

    setLoading(true);
    setError('');
    try {
      await apiFetch('/blood-requests', {
        method: 'POST',
        body: JSON.stringify({
          bloodGroup, unitsNeeded, urgency,
          notes: notes || undefined,
          appointmentDate: appointmentDate ? new Date(appointmentDate).toISOString() : undefined,
        }),
      });
      router.push('/dashboard/requests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '520px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '24px', letterSpacing: '-0.02em' }}>
        New Blood Request
      </h1>

      <form onSubmit={handleSubmit}>
        <div style={{
          padding: '20px 24px', borderRadius: '14px', marginBottom: '12px',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          display: 'flex', flexDirection: 'column', gap: '20px',
        }}>
          {error && <div className="error-box">{error}</div>}

          {/* Blood group */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
              Blood Group Needed
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {BLOOD_GROUPS.map((bg) => (
                <button
                  key={bg.value}
                  type="button"
                  onClick={() => setBloodGroup(bg.value)}
                  style={{
                    padding: '8px 0', borderRadius: '6px',
                    fontSize: '13px', fontWeight: 600,
                    border: '1px solid',
                    borderColor: bloodGroup === bg.value ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor: bloodGroup === bg.value ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: bloodGroup === bg.value ? '#fff' : 'var(--color-text)',
                    transition: 'border-color 150ms ease, background-color 150ms ease, color 150ms ease',
                    cursor: 'pointer',
                  }}
                >
                  {bg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Units */}
          <div>
            <label htmlFor="req-units" style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
              Units Needed
            </label>
            <input
              id="req-units"
              type="number"
              min={1}
              max={20}
              value={unitsNeeded}
              onChange={(e) => setUnitsNeeded(Number(e.target.value))}
              className="input-field"
            />
          </div>

          {/* Urgency */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
              Urgency Level
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {URGENCY_LEVELS.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setUrgency(u.value)}
                  style={{
                    padding: '8px 0', borderRadius: '6px',
                    fontSize: '13px', fontWeight: 500,
                    border: '1px solid',
                    borderColor: urgency === u.value ? u.color : 'var(--color-border)',
                    backgroundColor: 'transparent',
                    color: urgency === u.value ? u.color : 'var(--color-text-secondary)',
                    transition: 'border-color 150ms ease, color 150ms ease',
                    cursor: 'pointer',
                  }}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          {/* Appointment Date — visual calendar + clock */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
              Appointment Date & Time <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <DateTimePicker
              value={appointmentDate}
              onChange={setAppointmentDate}
              minDate={today}
              placeholder="Choose date & time for transfusion"
            />
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              When you need the blood transfusion. Minutes snap to 5-min intervals.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="req-notes" style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
              Additional Notes
            </label>
            <textarea
              id="req-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information..."
              rows={3}
              className="input-field"
              style={{ resize: 'none' }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !bloodGroup || !appointmentDate}
          className="btn-primary"
          style={{ width: '100%', padding: '9px 16px' }}
        >
          {loading ? 'Creating...' : 'Create Blood Request'}
        </button>
      </form>
    </div>
  );
}
