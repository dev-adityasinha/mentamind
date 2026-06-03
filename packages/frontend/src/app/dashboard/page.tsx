'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div style={{ padding: '32px', maxWidth: '720px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
        Welcome back, {user.name}
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '28px' }}>
        {user.role.charAt(0) + user.role.slice(1).toLowerCase()} dashboard
      </p>

      {/* Identity verification banner */}
      {!user.identityVerified && (
        <Link
          href="/dashboard/verify"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderRadius: '10px', marginBottom: '20px',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            transition: 'background-color 150ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.09)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.05)')}
        >
          <div>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
              Identity not verified
            </p>
            <p style={{ fontSize: '12px', marginTop: '2px', color: 'var(--color-text-muted)' }}>
              Verify to unlock all features
            </p>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-primary)', flexShrink: 0 }}>
            Verify →
          </span>
        </Link>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'Active Requests', value: '0' },
          { label: 'Notifications', value: '0' },
          {
            label: 'Account Status',
            value: user.identityVerified ? 'Verified' : 'Unverified',
            valueColor: user.identityVerified ? 'var(--color-success)' : 'var(--color-warning)',
          },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              padding: '16px 20px',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '10px', letterSpacing: '0.02em' }}>
              {card.label}
            </p>
            <p style={{ fontSize: '22px', fontWeight: 600, color: card.valueColor ?? 'var(--color-text)', letterSpacing: '-0.02em' }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Status notice */}
      <div style={{
        padding: '16px',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          More features coming soon — blood requests, medicine requests, donor matching, and analytics will appear here.
        </p>
      </div>
    </div>
  );
}
