'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

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

interface PatientProfile {
  id: string;
  bloodGroup: string | null;
  medicalNotes: string | null;
  address: string | null;
  emergencyContact: string | null;
}

interface ProfileData {
  user: {
    id: string;
    email: string;
    name: string;
    phone: string;
    role: string;
    identityVerified: boolean;
    maskedAadhaarRef: string | null;
  };
  patient: PatientProfile;
}

export default function ProfilePage() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [bloodGroup, setBloodGroup] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  useEffect(() => {
    if (user) loadProfile();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProfile = async () => {
    try {
      const data = await apiFetch<ProfileData>('/patients/me');
      setProfile(data);
      setBloodGroup(data.patient.bloodGroup || '');
      setMedicalNotes(data.patient.medicalNotes || '');
      setAddress(data.patient.address || '');
      setEmergencyContact(data.patient.emergencyContact || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updateData: Record<string, string> = {};
      if (bloodGroup) updateData.bloodGroup = bloodGroup;
      if (medicalNotes !== (profile?.patient.medicalNotes || '')) updateData.medicalNotes = medicalNotes;
      if (address !== (profile?.patient.address || '')) updateData.address = address;
      if (emergencyContact !== (profile?.patient.emergencyContact || '')) updateData.emergencyContact = emergencyContact;

      if (Object.keys(updateData).length === 0) {
        setSuccess('No changes to save.');
        setSaving(false);
        return;
      }

      const data = await apiFetch<{ patient: PatientProfile }>('/patients/me', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      setProfile((prev) => (prev ? { ...prev, patient: data.patient } : prev));
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '32px' }}>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading profile...</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div style={{ padding: '32px', maxWidth: '600px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '24px', letterSpacing: '-0.02em' }}>
        My Profile
      </h1>

      {/* Account info (read-only) */}
      <div style={{
        padding: '20px 24px', borderRadius: '14px', marginBottom: '12px',
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}>
        <p className="section-label">Account</p>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '16px' }}>
          {[
            { label: 'Name', value: profile.user.name },
            { label: 'Email', value: profile.user.email },
            { label: 'Phone', value: profile.user.phone },
          ].map((f) => (
            <div key={f.label}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>{f.label}</p>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{f.value}</p>
            </div>
          ))}
          <div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>Identity</p>
            {profile.user.identityVerified ? (
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-success)' }}>
                Verified — {profile.user.maskedAadhaarRef}
              </p>
            ) : (
              <Link href="/dashboard/verify" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-warning)' }}>
                Not verified — click to verify
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Editable patient details */}
      <div style={{
        padding: '20px 24px', borderRadius: '14px',
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}>
        <p className="section-label">Patient Details</p>

        {error && <div className="error-box" style={{ marginBottom: '16px' }}>{error}</div>}
        {success && <div className="success-box" style={{ marginBottom: '16px' }}>{success}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="prof-blood" style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
              Blood Group
            </label>
            <select id="prof-blood" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="input-field" style={{ appearance: 'none' }}>
              <option value="" style={{ backgroundColor: 'var(--color-surface)' }}>Not specified</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg.value} value={bg.value} style={{ backgroundColor: 'var(--color-surface)' }}>{bg.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="prof-notes" style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
              Medical Notes
            </label>
            <textarea
              id="prof-notes"
              value={medicalNotes}
              onChange={(e) => setMedicalNotes(e.target.value)}
              placeholder="Any relevant medical conditions, allergies, etc."
              rows={3}
              className="input-field"
              style={{ resize: 'none' }}
            />
          </div>

          <div>
            <label htmlFor="prof-address" style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
              Address
            </label>
            <input id="prof-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Your address" className="input-field" />
          </div>

          <div>
            <label htmlFor="prof-emergency" style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
              Emergency Contact
            </label>
            <input id="prof-emergency" type="tel" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="+91 98765 43210" className="input-field" />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ width: '100%', padding: '8px 16px' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
