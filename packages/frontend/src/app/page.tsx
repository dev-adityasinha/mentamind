"use client";
import Link from 'next/link';

const features = [
  {
    title: 'Blood Donation',
    description:
      'Connect patients with verified donors using ABO/Rh compatible matching. Real-time coordination across hospitals.',
  },
  {
    title: 'Free Medicine',
    description:
      'Prescription OCR processing with human admin verification. Medicines dispatched directly to patients in need.',
  },
  {
    title: 'Smart Matching',
    description:
      'Donors ranked by blood compatibility, proximity, and availability. Intelligent algorithms, human oversight.',
  },
];

export default function HomePage() {
  return (
    <div style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        backgroundColor: 'rgba(10,10,10,0.8)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '22px', height: '22px', borderRadius: '6px',
            backgroundColor: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '11px', fontWeight: 600, flexShrink: 0,
          }}>M</div>
          <span style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.01em' }}>Mentamind</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Link href="/login" className="nav-link" style={{ padding: '6px 10px' }}>
            Sign in
          </Link>
          <Link href="/register" className="btn-primary">
            Get started
          </Link>
        </div>
      </nav>

      <main style={{ flex: 1 }}>

        {/* Hero */}
        <section style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '120px 24px 96px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            marginBottom: '28px',
            letterSpacing: '0.01em',
          }}>
            Open-source humanitarian platform
          </div>

          <h1 style={{
            fontSize: 'clamp(36px, 5vw, 60px)',
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            color: 'var(--color-text)',
            marginBottom: '20px',
          }}>
            Connecting donors.<br />Delivering care.
          </h1>

          <p style={{
            fontSize: '16px',
            color: 'var(--color-text-secondary)',
            maxWidth: '520px',
            margin: '0 auto 36px',
            lineHeight: 1.6,
          }}>
            A humanitarian platform for blood donation coordination and free medicine
            support — intelligent matching, verified donors, secure processing.
          </p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn-primary" style={{ padding: '8px 18px' }}>
              Create account
            </Link>
            <Link href="/login" className="nav-link" style={{ padding: '8px 12px', display: 'inline-flex', alignItems: 'center' }}>
              Sign in →
            </Link>
          </div>
        </section>

        {/* Feature cards */}
        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px 96px' }}>
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '12px' }}>
            {features.map((f) => (
              <div key={f.title} className="feature-card">
                <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '8px', letterSpacing: 0 }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--color-border)',
        padding: '20px 24px',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--color-text-muted)',
      }}>
        © {new Date().getFullYear()} Mentamind Foundation
      </footer>

    </div>
  );
}
