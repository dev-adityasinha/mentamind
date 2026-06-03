'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

/* ─── shared blood-group label map ────────────────────────────────────────── */
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

/* ─── shared style helpers ─────────────────────────────────────────────────── */
const card: React.CSSProperties = {
  padding: '20px 24px',
  borderRadius: '14px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-surface)',
  marginBottom: '12px',
};

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  marginBottom: '6px',
};

/* ══════════════════════════════════════════════════════════════════════════════
   PATIENT PROFILE
══════════════════════════════════════════════════════════════════════════════ */

interface PatientProfile {
  id: string;
  bloodGroup: string | null;
  age: number | null;
  gender: string | null;
  city: string | null;
  medicalNotes: string | null;
  address: string | null;
  emergencyContact: string | null;
}

function PatientProfileSection({
  user,
}: {
  user: { email: string; name: string; phone: string; identityVerified: boolean; maskedAadhaarRef: string | null };
}) {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [bloodGroup, setBloodGroup] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  useEffect(() => {
    apiFetch<{ patient: PatientProfile }>('/patients/me')
      .then(({ patient }) => {
        setProfile(patient);
        setBloodGroup(patient.bloodGroup || '');
        setAge(patient.age?.toString() || '');
        setGender(patient.gender || '');
        setCity(patient.city || '');
        setMedicalNotes(patient.medicalNotes || '');
        setAddress(patient.address || '');
        setEmergencyContact(patient.emergencyContact || '');
      })
      .catch((err) => setError(err.message || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updateData: Record<string, unknown> = {};
      if (bloodGroup) updateData.bloodGroup = bloodGroup;
      if (age) updateData.age = parseInt(age, 10);
      if (gender) updateData.gender = gender;
      if (city !== (profile?.city || '')) updateData.city = city;
      if (medicalNotes !== (profile?.medicalNotes || '')) updateData.medicalNotes = medicalNotes;
      if (address !== (profile?.address || '')) updateData.address = address;
      if (emergencyContact !== (profile?.emergencyContact || '')) updateData.emergencyContact = emergencyContact;

      if (Object.keys(updateData).length === 0) {
        setSuccess('No changes to save.');
        setSaving(false);
        return;
      }

      const data = await apiFetch<{ patient: PatientProfile }>('/patients/me', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      setProfile(data.patient);
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading profile…</p>;

  return (
    <>
      {/* Account (read-only) */}
      <div style={card}>
        <p className="section-label">Account</p>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '16px' }}>
          {[
            { label: 'Name', value: user.name },
            { label: 'Email', value: user.email },
            { label: 'Phone', value: user.phone },
          ].map((f) => (
            <div key={f.label}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>{f.label}</p>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{f.value}</p>
            </div>
          ))}
          <div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>Identity</p>
            {user.identityVerified ? (
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-success)' }}>
                Verified — {user.maskedAadhaarRef}
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
      <div style={card}>
        <p className="section-label">Patient Details</p>
        {error && <div className="error-box" style={{ marginBottom: '16px' }}>{error}</div>}
        {success && <div className="success-box" style={{ marginBottom: '16px' }}>{success}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '12px' }}>
            <div>
              <label htmlFor="prof-blood" style={fieldLabel}>Blood Group</label>
              <select id="prof-blood" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="input-field" style={{ appearance: 'none' }}>
                <option value="" style={{ backgroundColor: 'var(--color-surface)' }}>Not specified</option>
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg.value} value={bg.value} style={{ backgroundColor: 'var(--color-surface)' }}>{bg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="prof-gender" style={fieldLabel}>Gender</label>
              <select id="prof-gender" value={gender} onChange={(e) => setGender(e.target.value)} className="input-field" style={{ appearance: 'none' }}>
                <option value="" style={{ backgroundColor: 'var(--color-surface)' }}>Not specified</option>
                <option value="MALE" style={{ backgroundColor: 'var(--color-surface)' }}>Male</option>
                <option value="FEMALE" style={{ backgroundColor: 'var(--color-surface)' }}>Female</option>
                <option value="OTHER" style={{ backgroundColor: 'var(--color-surface)' }}>Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '12px' }}>
            <div>
              <label htmlFor="prof-age" style={fieldLabel}>Age</label>
              <input id="prof-age" type="number" min={0} max={150} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 34" className="input-field" />
            </div>
            <div>
              <label htmlFor="prof-city" style={fieldLabel}>City</label>
              <input id="prof-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" className="input-field" />
            </div>
          </div>

          <div>
            <label htmlFor="prof-notes" style={fieldLabel}>Medical Notes</label>
            <textarea id="prof-notes" value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)}
              placeholder="Any relevant medical conditions, allergies, etc." rows={3} className="input-field" style={{ resize: 'none' }} />
          </div>

          <div>
            <label htmlFor="prof-address" style={fieldLabel}>Address</label>
            <input id="prof-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Your address" className="input-field" />
          </div>

          <div>
            <label htmlFor="prof-emergency" style={fieldLabel}>Emergency Contact</label>
            <input id="prof-emergency" type="tel" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="+91 98765 43210" className="input-field" />
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ width: '100%', padding: '8px 16px' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   HOSPITAL PROFILE
══════════════════════════════════════════════════════════════════════════════ */

interface HospitalProfile {
  id: string;
  hospitalName: string;
  address: string;
  phone: string;
  department: string | null;
  isVerified: boolean;
  latitude: number | null;
  longitude: number | null;
}

function HospitalProfileSection({
  user,
}: {
  user: { email: string; name: string; phone: string; identityVerified: boolean };
}) {
  const [profile, setProfile] = useState<HospitalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [hospitalName, setHospitalName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');

  useEffect(() => {
    apiFetch<{ hospital: HospitalProfile }>('/hospitals/me')
      .then(({ hospital }) => {
        setProfile(hospital);
        setHospitalName(hospital.hospitalName);
        setAddress(hospital.address);
        setPhone(hospital.phone);
        setDepartment(hospital.department || '');
      })
      .catch((err) => setError(err.message || 'Failed to load hospital profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updateData: Record<string, unknown> = {};
      if (hospitalName !== profile?.hospitalName) updateData.hospitalName = hospitalName;
      if (address !== profile?.address) updateData.address = address;
      if (phone !== profile?.phone) updateData.phone = phone;
      if (department !== (profile?.department || '')) updateData.department = department;

      if (Object.keys(updateData).length === 0) {
        setSuccess('No changes to save.');
        setSaving(false);
        return;
      }

      const data = await apiFetch<{ hospital: HospitalProfile }>('/hospitals/me', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      setProfile(data.hospital);
      setSuccess('Hospital profile updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading hospital profile…</p>;

  return (
    <>
      {/* Account (read-only) */}
      <div style={card}>
        <p className="section-label">Account</p>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '16px' }}>
          {[
            { label: 'Coordinator Name', value: user.name },
            { label: 'Email', value: user.email },
          ].map((f) => (
            <div key={f.label}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>{f.label}</p>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{f.value}</p>
            </div>
          ))}
          <div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>Verification</p>
            <p style={{ fontSize: '13px', fontWeight: 500, color: profile?.isVerified ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {profile?.isVerified ? 'Verified by Admin' : 'Pending admin verification'}
            </p>
          </div>
        </div>
      </div>

      {/* Editable hospital details */}
      <div style={card}>
        <p className="section-label">Hospital Details</p>
        {error && <div className="error-box" style={{ marginBottom: '16px' }}>{error}</div>}
        {success && <div className="success-box" style={{ marginBottom: '16px' }}>{success}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="hosp-name" style={fieldLabel}>Hospital Name</label>
            <input id="hosp-name" type="text" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label htmlFor="hosp-dept" style={fieldLabel}>Department / Ward</label>
            <input id="hosp-dept" type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Blood Bank & Haematology" className="input-field" />
          </div>
          <div>
            <label htmlFor="hosp-phone" style={fieldLabel}>Hospital Phone</label>
            <input id="hosp-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" />
          </div>
          <div>
            <label htmlFor="hosp-address" style={fieldLabel}>Address</label>
            <input id="hosp-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="input-field" />
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ width: '100%', padding: '8px 16px' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ADMIN / VOLUNTEER — account info only (no role-specific profile endpoint)
══════════════════════════════════════════════════════════════════════════════ */

function AccountOnlySection({
  user,
}: {
  user: { email: string; name: string; phone: string; role: string };
}) {
  return (
    <div style={card}>
      <p className="section-label">Account</p>
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '16px' }}>
        {[
          { label: 'Name', value: user.name },
          { label: 'Email', value: user.email },
          { label: 'Phone', value: user.phone },
          { label: 'Role', value: user.role.charAt(0) + user.role.slice(1).toLowerCase() },
        ].map((f) => (
          <div key={f.label}>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '3px' }}>{f.label}</p>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ROOT PAGE — picks section by role
══════════════════════════════════════════════════════════════════════════════ */

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div style={{ padding: '32px', maxWidth: '600px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '24px', letterSpacing: '-0.02em' }}>
        My Profile
      </h1>

      {user.role === 'PATIENT' && <PatientProfileSection user={user} />}
      {user.role === 'HOSPITAL' && <HospitalProfileSection user={user} />}
      {(user.role === 'ADMIN' || user.role === 'VOLUNTEER') && <AccountOnlySection user={user} />}
    </div>
  );
}
