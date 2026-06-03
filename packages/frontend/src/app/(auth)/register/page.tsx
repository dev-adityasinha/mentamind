'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

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

const ROLES = [
  { value: 'PATIENT', label: 'Patient' },
  { value: 'DONOR', label: 'Donor' },
  { value: 'HOSPITAL', label: 'Hospital' },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('PATIENT');
  const [bloodGroup, setBloodGroup] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (role === 'DONOR' && !bloodGroup) {
      setError('Please select your blood group');
      return;
    }
    if (role === 'HOSPITAL' && !hospitalName) {
      setError('Please enter hospital name');
      return;
    }

    setLoading(true);
    try {
      await register({
        name,
        email,
        phone,
        password,
        role,
        ...(role === 'DONOR' ? { bloodGroup } : {}),
        ...(role === 'HOSPITAL' ? { hospitalName, hospitalAddress } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', backgroundColor: 'var(--color-bg)' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            backgroundColor: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 600, fontSize: '13px',
            margin: '0 auto 16px',
          }}>M</div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            Create an account
          </h1>
          <p style={{ fontSize: '13px', marginTop: '4px', color: 'var(--color-text-muted)' }}>
            Join the Mentamind platform
          </p>
        </div>

        {/* Card */}
        <div style={{
          padding: '24px', borderRadius: '14px',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && <div className="error-box">{error}</div>}

            <Field label="Full Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="John Doe"
                className="input-field"
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="input-field"
              />
            </Field>

            <Field label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="+91 98765 43210"
                className="input-field"
              />
            </Field>

            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Min. 8 characters"
                className="input-field"
              />
            </Field>

            <Field label="I am a">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="input-field"
                style={{ appearance: 'none' }}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value} style={{ backgroundColor: 'var(--color-surface)' }}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>

            {role === 'DONOR' && (
              <div className="animate-fade-in">
                <Field label="Blood Group">
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="input-field"
                    style={{ appearance: 'none' }}
                  >
                    <option value="" style={{ backgroundColor: 'var(--color-surface)' }}>Select blood group</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg.value} value={bg.value} style={{ backgroundColor: 'var(--color-surface)' }}>
                        {bg.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            {role === 'HOSPITAL' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Field label="Hospital Name">
                  <input
                    type="text"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    required
                    placeholder="City General Hospital"
                    className="input-field"
                  />
                </Field>
                <Field label="Hospital Address">
                  <input
                    type="text"
                    value={hospitalAddress}
                    onChange={(e) => setHospitalAddress(e.target.value)}
                    placeholder="123 Main St, City (optional)"
                    className="input-field"
                  />
                </Field>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '8px 16px', marginTop: '4px' }}
            >
              {loading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account...
                </span>
              ) : 'Create account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '20px', color: 'var(--color-text-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ fontWeight: 500, color: 'var(--color-primary)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
    </div>
  );
}
