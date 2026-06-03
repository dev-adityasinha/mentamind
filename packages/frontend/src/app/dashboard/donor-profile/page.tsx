'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

interface DonorProfile {
  id: string;
  bloodGroup: string;
  lastDonationDate: string | null;
  isAvailable: boolean;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  totalDonations: number;
  responseScore: number;
}

interface ProfileData {
  user: {
    id: string;
    email: string;
    name: string;
    phone: string;
    identityVerified: boolean;
    maskedAadhaarRef: string | null;
  };
  donor: DonorProfile;
}

const BG_LABELS: Record<string, string> = {
  A_POS: 'A+', A_NEG: 'A−', B_POS: 'B+', B_NEG: 'B−',
  AB_POS: 'AB+', AB_NEG: 'AB−', O_POS: 'O+', O_NEG: 'O−',
};

export default function DonorProfilePage() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isAvailable, setIsAvailable] = useState(true);
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [lastDonation, setLastDonation] = useState('');

  useEffect(() => {
    if (user) loadProfile();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProfile = async () => {
    try {
      const data = await apiFetch<ProfileData>('/donors/me');
      setProfile(data);
      setIsAvailable(data.donor.isAvailable);
      setCity(data.donor.city || '');
      setLatitude(data.donor.latitude?.toString() || '');
      setLongitude(data.donor.longitude?.toString() || '');
      setLastDonation(data.donor.lastDonationDate ? data.donor.lastDonationDate.slice(0, 10) : '');
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
      const updateData: Record<string, unknown> = { isAvailable };
      if (city !== (profile?.donor.city || '')) updateData.city = city;
      if (latitude) updateData.latitude = parseFloat(latitude);
      if (longitude) updateData.longitude = parseFloat(longitude);
      if (lastDonation) updateData.lastDonationDate = new Date(lastDonation).toISOString();

      const data = await apiFetch<{ donor: DonorProfile }>('/donors/me', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      setProfile((prev) => (prev ? { ...prev, donor: data.donor } : prev));
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
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
        Donor Profile
      </h1>

      {/* Missing city warning */}
      {!profile.donor.city && (
        <div style={{
          padding: '14px 16px', borderRadius: '10px', marginBottom: '16px',
          backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
            ⚠ City not set — you won't appear in donor matching
          </p>
          <p style={{ fontSize: '12px', marginTop: '3px', color: 'var(--color-text-muted)' }}>
            Set your city below so hospitals can assign you to nearby patients.
          </p>
        </div>
      )}

      {/* Account summary */}
      <div style={{
        padding: '20px 24px', borderRadius: '14px', marginBottom: '12px',
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}>
        <p className="section-label">Account</p>
        <div className="grid grid-cols-2" style={{ gap: '16px' }}>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>Name</p>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{profile.user.name}</p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>Blood Group</p>
            <span style={{
              display: 'inline-block', fontSize: '14px', fontWeight: 600,
              padding: '1px 8px', borderRadius: '4px',
              backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444',
            }}>
              {BG_LABELS[profile.donor.bloodGroup] || profile.donor.bloodGroup}
            </span>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>Total Donations</p>
            <p style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
              {profile.donor.totalDonations}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>City</p>
            <p style={{ fontSize: '13px', fontWeight: 500, color: profile.donor.city ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
              {profile.donor.city || 'Not set'}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>Response Score</p>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
              {profile.donor.responseScore.toFixed(1)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>Identity</p>
            {profile.user.identityVerified ? (
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-success)' }}>Verified</p>
            ) : (
              <Link href="/dashboard/verify" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-warning)' }}>
                Not Verified
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Editable settings */}
      <div style={{
        padding: '20px 24px', borderRadius: '14px',
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}>
        <p className="section-label">Donor Settings</p>

        {error && <div className="error-box" style={{ marginBottom: '16px' }}>{error}</div>}
        {success && <div className="success-box" style={{ marginBottom: '16px' }}>{success}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Availability toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>Available for Donation</p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Toggle off if temporarily unavailable</p>
            </div>
            <button
              onClick={() => setIsAvailable(!isAvailable)}
              style={{
                width: '40px', height: '22px', borderRadius: '11px',
                position: 'relative', flexShrink: 0,
                backgroundColor: isAvailable ? 'var(--color-primary)' : 'var(--color-border)',
                border: 'none', transition: 'background-color 150ms ease',
              }}
            >
              <div style={{
                width: '16px', height: '16px', borderRadius: '50%',
                backgroundColor: '#fff', position: 'absolute', top: '3px',
                left: isAvailable ? '21px' : '3px',
                transition: 'left 150ms ease',
              }} />
            </button>
          </div>

          {/* City — used for location-based donor matching */}
          <div>
            <label htmlFor="donor-city" style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
              City <span style={{ color: '#ef4444', fontWeight: 600 }}>*</span>
            </label>
            <input
              id="donor-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Mumbai, Delhi, Bangalore…"
              className="input-field"
            />
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Required for hospital-to-donor matching. Must match the patient's city exactly.
            </p>
          </div>

          <div>
            <label htmlFor="donor-lastdon" style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
              Last Donation Date
            </label>
            <input id="donor-lastdon" type="date" value={lastDonation} onChange={(e) => setLastDonation(e.target.value)} className="input-field" />
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ width: '100%', padding: '8px 16px' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
