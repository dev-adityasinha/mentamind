'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

type Step = 'aadhaar' | 'otp' | 'success';

export default function VerifyPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('aadhaar');
  const [aadhaar, setAadhaar] = useState('');
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState('');
  const [maskedRef, setMaskedRef] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const formatAadhaar = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) parts.push(digits.slice(i, i + 4));
    return parts.join(' ');
  };

  const handleSendOtp = async () => {
    const digits = aadhaar.replace(/\s/g, '');
    if (digits.length !== 12) { setError('Please enter a valid 12-digit Aadhaar number'); return; }

    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ success: boolean; requestId: string }>('/identity/send-otp', {
        method: 'POST',
        body: JSON.stringify({ aadhaarNumber: digits }),
      });
      if (data.success) { setRequestId(data.requestId); setStep('otp'); }
      else setError('Failed to send OTP. Please try again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { setError('Please enter the 6-digit OTP'); return; }

    setLoading(true);
    setError('');
    try {
      const digits = aadhaar.replace(/\s/g, '');
      const data = await apiFetch<{ verified: boolean; message?: string; user?: { maskedAadhaarRef: string } }>(
        '/identity/verify-otp',
        { method: 'POST', body: JSON.stringify({ requestId, otp, aadhaarNumber: digits }) },
      );
      if (data.verified) {
        setMaskedRef(data.user?.maskedAadhaarRef || '');
        setStep('success');
        await refreshUser();
      } else {
        setError(data.message || 'Verification failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (user?.identityVerified) {
    return (
      <div style={{ padding: '32px', maxWidth: '400px' }}>
        <div style={{
          padding: '24px', borderRadius: '14px', textAlign: 'center',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-success)', marginBottom: '4px' }}>Already Verified</p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>Reference: {user.maskedAadhaarRef}</p>
          <button onClick={() => router.push('/dashboard')} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '400px' }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
        {(['aadhaar', 'otp', 'success'] as Step[]).map((s, i) => {
          const isActive = s === step;
          const isPast =
            (s === 'aadhaar' && (step === 'otp' || step === 'success')) ||
            (s === 'otp' && step === 'success');
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 600,
                border: '1px solid',
                borderColor: isActive || isPast ? 'var(--color-primary)' : 'var(--color-border)',
                backgroundColor: isActive || isPast ? 'var(--color-primary)' : 'var(--color-surface)',
                color: isActive || isPast ? '#fff' : 'var(--color-text-muted)',
              }}>
                {isPast ? '✓' : i + 1}
              </div>
              {i < 2 && (
                <div style={{
                  width: '32px', height: '1px',
                  backgroundColor: isPast ? 'var(--color-primary)' : 'var(--color-border)',
                }} />
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        padding: '24px', borderRadius: '14px',
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}>
        {/* Step 1: Aadhaar */}
        {step === 'aadhaar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>Verify Identity</h2>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Enter your Aadhaar number to receive an OTP</p>
            </div>

            {error && <div className="error-box">{error}</div>}

            <div>
              <label htmlFor="aadhaar" style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                Aadhaar Number
              </label>
              <input
                id="aadhaar"
                type="text"
                value={aadhaar}
                onChange={(e) => { setAadhaar(formatAadhaar(e.target.value)); setError(''); }}
                placeholder="XXXX XXXX XXXX"
                maxLength={14}
                className="input-field"
                style={{ textAlign: 'center', fontSize: '18px', fontFamily: 'monospace', letterSpacing: '0.15em' }}
              />
              <p style={{ fontSize: '11px', marginTop: '6px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Only a masked reference is saved — your Aadhaar number is never stored.
              </p>
            </div>

            <button
              onClick={handleSendOtp}
              disabled={loading || aadhaar.replace(/\s/g, '').length !== 12}
              className="btn-primary"
              style={{ width: '100%', padding: '8px 16px' }}
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </div>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>Enter OTP</h2>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>A 6-digit code was sent to your registered phone</p>
            </div>

            {error && <div className="error-box">{error}</div>}

            <div>
              <label htmlFor="otp" style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                Verification Code
              </label>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                placeholder="000000"
                maxLength={6}
                autoFocus
                className="input-field"
                style={{ textAlign: 'center', fontSize: '22px', fontFamily: 'monospace', letterSpacing: '0.5em' }}
              />
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length !== 6}
              className="btn-primary"
              style={{ width: '100%', padding: '8px 16px' }}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={() => setStep('aadhaar')}
                style={{ fontSize: '12px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ← Back
              </button>
              <button
                onClick={handleSendOtp}
                disabled={loading}
                style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
              >
                Resend OTP
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center', padding: '8px 0' }}>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-success)', marginBottom: '4px' }}>Identity Verified</p>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Your identity has been successfully verified.</p>
            </div>

            {maskedRef && (
              <div style={{
                display: 'inline-block', padding: '8px 16px', borderRadius: '6px',
                fontSize: '13px', fontFamily: 'monospace',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-border)',
              }}>
                Ref: {maskedRef}
              </div>
            )}

            <button onClick={() => router.push('/dashboard')} className="btn-primary" style={{ width: '100%', padding: '8px 16px' }}>
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
