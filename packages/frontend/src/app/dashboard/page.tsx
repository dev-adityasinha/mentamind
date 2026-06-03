'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

/* ─── shared helpers ───────────────────────────────────────────────────────── */

function formatBG(bg: string) {
  return bg.replace('_POS', '+').replace('_NEG', '−');
}

function fmtStatus(s: string) {
  return s.replace(/_/g, ' ');
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',
  PENDING_VERIFICATION: '#f59e0b',
  VERIFIED: '#3b82f6',
  MATCHING: '#8b5cf6',
  MATCHED: '#10b981',
  IN_PROGRESS: '#f97316',
  FULFILLED: '#22c55e',
  CANCELLED: '#ef4444',
  REJECTED: '#dc2626',
  PENDING_OCR: '#f59e0b',
  OCR_COMPLETE: '#8b5cf6',
  PENDING_REVIEW: '#3b82f6',
  APPROVED: '#22c55e',
  DISPATCHED: '#f97316',
  DELIVERED: '#10b981',
};

const URGENCY_COLOR: Record<string, string> = {
  NORMAL: '#22c55e',
  URGENT: '#f59e0b',
  CRITICAL: '#ef4444',
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#3b82f6',
  HIGH: '#f59e0b',
  CRITICAL: '#ef4444',
};

/* ─── shared UI atoms ──────────────────────────────────────────────────────── */

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: '11px', fontWeight: 500, padding: '2px 7px', borderRadius: '4px',
      backgroundColor: `${color}18`, color,
    }}>
      {label}
    </span>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      padding: '16px 20px', borderRadius: '10px',
      border: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-surface)',
    }}>
      <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '8px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.03em', color: accent ?? 'var(--color-text)', lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '6px' }}>{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>{title}</p>
      {href && (
        <Link href={href} style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-primary)' }}>
          {linkLabel ?? 'View all →'}
        </Link>
      )}
    </div>
  );
}

function EmptySlate({ label }: { label: string }) {
  return (
    <div style={{
      padding: '24px', borderRadius: '10px', textAlign: 'center',
      border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
    }}>
      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{label}</p>
    </div>
  );
}

/* ─── quick action button ──────────────────────────────────────────────────── */

function QuickAction({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 16px', borderRadius: '10px',
        border: '1px solid var(--color-border)',
        backgroundColor: hovered ? 'var(--color-surface-hover)' : 'var(--color-surface)',
        transition: 'background-color 150ms ease',
        fontSize: '13px', fontWeight: 500, color: 'var(--color-text)',
        textDecoration: 'none',
      }}
    >
      <span style={{ color: 'var(--color-primary)', flexShrink: 0 }}>{icon}</span>
      {label}
    </Link>
  );
}

const IconBlood = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M12 2C6 10 4 14 4 16a8 8 0 0016 0c0-2-2-6-8-14z" />
  </svg>
);
const IconPill = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M10.5 20.5L20.5 10.5a4.95 4.95 0 00-7-7L3.5 13.5a4.95 4.95 0 007 7z" />
    <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
  </svg>
);
const IconUser = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconShield = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const IconHeart = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
);
const IconUsers = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const IconFile = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);
const IconPhone = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .18h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91A16 16 0 0016.09 18l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 18.92z" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════════════════════
   PATIENT DASHBOARD
══════════════════════════════════════════════════════════════════════════════ */

interface BloodRequest {
  id: string; bloodGroup: string; unitsNeeded: number; urgency: string;
  priorityLevel?: string; status: string; createdAt: string;
  hospitalName?: string | null; treatingDoctor?: string | null;
}
interface MedRequest { id: string; status: string; notes: string | null; createdAt: string; }

function PatientDashboard({ user }: { user: { name: string; identityVerified: boolean } }) {
  const [bloodReqs, setBloodReqs] = useState<BloodRequest[]>([]);
  const [medReqs, setMedReqs] = useState<MedRequest[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [br, mr, notifs] = await Promise.all([
        apiFetch<{ requests: BloodRequest[] }>('/blood-requests'),
        apiFetch<{ requests: MedRequest[] }>('/medicine-requests'),
        apiFetch<{ unreadCount: number }>('/notifications'),
      ]);
      setBloodReqs(br.requests.slice(0, 5));
      setMedReqs(mr.requests.slice(0, 5));
      setUnread(notifs.unreadCount);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeBlood = bloodReqs.filter(r => !['FULFILLED','CANCELLED','REJECTED'].includes(r.status)).length;
  const activeMed   = medReqs.filter(r => !['DELIVERED','CANCELLED','REJECTED'].includes(r.status)).length;

  if (loading) return <Loader />;

  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <Greeting name={user.name} role="Patient" />

      {/* Identity banner */}
      {!user.identityVerified && (
        <Link href="/dashboard/verify" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderRadius: '10px', marginBottom: '20px',
          backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)',
          textDecoration: 'none',
        }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>Complete identity verification</p>
            <p style={{ fontSize: '12px', marginTop: '2px', color: 'var(--color-text-muted)' }}>Required before placing blood or medicine requests</p>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#f59e0b', flexShrink: 0 }}>Verify →</span>
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '10px', marginBottom: '24px' }}>
        <StatCard label="Active Blood Req" value={activeBlood} />
        <StatCard label="Active Med Req" value={activeMed} />
        <StatCard label="Unread" value={unread} accent={unread > 0 ? 'var(--color-primary)' : undefined} />
        <StatCard label="Identity" value={user.identityVerified ? 'Verified' : 'Pending'}
          accent={user.identityVerified ? 'var(--color-success)' : '#f59e0b'} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: '8px', marginBottom: '28px' }}>
        <QuickAction href="/dashboard/requests/new" label="New Blood Request" icon={<IconBlood />} />
        <QuickAction href="/dashboard/medicines/new" label="Upload Prescription" icon={<IconPill />} />
        <QuickAction href="/dashboard/profile" label="Update Profile" icon={<IconUser />} />
      </div>

      {/* Recent blood requests */}
      <div style={{ marginBottom: '24px' }}>
        <SectionHeader title="Recent Blood Requests" href="/dashboard/requests" />
        {bloodReqs.length === 0 ? (
          <EmptySlate label="No blood requests yet" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {bloodReqs.map(req => (
              <Link key={req.id} href={`/dashboard/requests/${req.id}`} style={{ textDecoration: 'none' }}>
                <div className="list-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', flexShrink: 0 }}>
                      {formatBG(req.bloodGroup)}
                    </span>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                        {req.unitsNeeded} unit{req.unitsNeeded > 1 ? 's' : ''}
                        {req.hospitalName ? ` · ${req.hospitalName}` : ''}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{fmtDate(req.createdAt)}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: URGENCY_COLOR[req.urgency] ?? '#6b7280', flexShrink: 0 }} />
                    <Pill label={fmtStatus(req.status)} color={STATUS_COLORS[req.status] ?? '#6b7280'} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent medicine requests */}
      <div>
        <SectionHeader title="Recent Medicine Requests" href="/dashboard/medicines" />
        {medReqs.length === 0 ? (
          <EmptySlate label="No medicine requests yet" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {medReqs.map(req => (
              <Link key={req.id} href={`/dashboard/medicines/${req.id}`} style={{ textDecoration: 'none' }}>
                <div className="list-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>Prescription Request</p>
                    {req.notes && <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>{req.notes}</p>}
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{fmtDate(req.createdAt)}</p>
                  </div>
                  <Pill label={fmtStatus(req.status)} color={STATUS_COLORS[req.status] ?? '#6b7280'} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   DONOR DASHBOARD
══════════════════════════════════════════════════════════════════════════════ */

interface DonorProfile {
  bloodGroup: string; isAvailable: boolean; totalDonations: number;
  responseScore: number; lastDonationDate: string | null; city: string | null;
}

function DonorDashboard({ user }: { user: { name: string; identityVerified: boolean } }) {
  const [donor, setDonor] = useState<DonorProfile | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [dp, notifs] = await Promise.all([
        apiFetch<{ donor: DonorProfile }>('/donors/me'),
        apiFetch<{ unreadCount: number }>('/notifications'),
      ]);
      setDonor(dp.donor);
      setUnread(notifs.unreadCount);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const daysSinceLastDonation = donor?.lastDonationDate
    ? Math.floor((Date.now() - new Date(donor.lastDonationDate).getTime()) / 86400000)
    : null;
  const canDonate = daysSinceLastDonation === null || daysSinceLastDonation >= 56;

  if (loading) return <Loader />;

  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <Greeting name={user.name} role="Donor" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '10px', marginBottom: '24px' }}>
        <StatCard label="Blood Group" value={donor ? formatBG(donor.bloodGroup) : '—'} accent="#ef4444" />
        <StatCard label="Total Donations" value={donor?.totalDonations ?? 0} />
        <StatCard label="Availability" value={donor?.isAvailable ? 'Available' : 'Unavailable'}
          accent={donor?.isAvailable ? 'var(--color-success)' : '#ef4444'} />
        <StatCard label="Unread Alerts" value={unread} accent={unread > 0 ? 'var(--color-primary)' : undefined} />
      </div>

      {/* Eligibility card */}
      <div style={{
        padding: '16px 20px', borderRadius: '10px', marginBottom: '24px',
        border: `1px solid ${canDonate ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
        backgroundColor: canDonate ? 'rgba(34,197,94,0.05)' : 'rgba(245,158,11,0.05)',
      }}>
        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
          {canDonate ? '✓ You are eligible to donate' : `Next donation in ${56 - (daysSinceLastDonation ?? 0)} days`}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
          {donor?.lastDonationDate
            ? `Last donation: ${fmtDate(donor.lastDonationDate)} (${daysSinceLastDonation} days ago)`
            : 'No donation recorded yet — update your profile after donating.'}
        </p>
        {donor && (
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Response score: <strong style={{ color: 'var(--color-text)' }}>{donor.responseScore.toFixed(1)}</strong>
            {donor.city ? ` · ${donor.city}` : ''}
          </p>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '8px', marginBottom: '28px' }}>
        <QuickAction href="/dashboard/donor-profile" label="Update Availability" icon={<IconHeart />} />
        <QuickAction href="/dashboard/notifications" label={`Notifications${unread > 0 ? ` (${unread})` : ''}`} icon={<IconShield />} />
        {!user.identityVerified && (
          <QuickAction href="/dashboard/verify" label="Verify Identity" icon={<IconUser />} />
        )}
      </div>

      {/* How it works */}
      <div style={{
        padding: '16px 20px', borderRadius: '10px',
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '10px' }}>How Mentamind Donor Matching Works</p>
        {[
          'A patient or hospital submits a blood request.',
          'Our algorithm scores donors by blood type, proximity, last donation date, and response history.',
          'You receive an in-app notification when matched.',
          'A volunteer calls you to confirm. Your response score improves with each positive response.',
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)', width: '18px', flexShrink: 0, paddingTop: '1px' }}>{i + 1}.</span>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   HOSPITAL DASHBOARD
══════════════════════════════════════════════════════════════════════════════ */

function HospitalDashboard({ user }: { user: { name: string } }) {
  const [reqs, setReqs] = useState<BloodRequest[]>([]);
  const [unread, setUnread] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [br, notifs, hp] = await Promise.all([
        apiFetch<{ requests: BloodRequest[] }>('/blood-requests'),
        apiFetch<{ unreadCount: number }>('/notifications'),
        apiFetch<{ hospital: { isVerified: boolean } }>('/hospitals/me'),
      ]);
      setReqs(br.requests.slice(0, 6));
      setUnread(notifs.unreadCount);
      setIsVerified(hp.hospital.isVerified);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = reqs.filter(r => !['FULFILLED','CANCELLED','REJECTED'].includes(r.status)).length;
  const fulfilled = reqs.filter(r => r.status === 'FULFILLED').length;

  if (loading) return <Loader />;

  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <Greeting name={user.name} role="Hospital" />

      {/* Verification banner */}
      {!isVerified && (
        <div style={{
          padding: '14px 16px', borderRadius: '10px', marginBottom: '20px',
          backgroundColor: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.25)',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>Hospital pending admin verification</p>
          <p style={{ fontSize: '12px', marginTop: '2px', color: 'var(--color-text-muted)' }}>Once verified, your hospital will appear in the blood request hospital picker.</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '10px', marginBottom: '24px' }}>
        <StatCard label="Total Requests" value={reqs.length} />
        <StatCard label="Active" value={active} accent={active > 0 ? '#f59e0b' : undefined} />
        <StatCard label="Fulfilled" value={fulfilled} accent={fulfilled > 0 ? 'var(--color-success)' : undefined} />
        <StatCard label="Unread" value={unread} accent={unread > 0 ? 'var(--color-primary)' : undefined} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '8px', marginBottom: '28px' }}>
        <QuickAction href="/dashboard/requests" label="All Blood Requests" icon={<IconBlood />} />
        <QuickAction href="/dashboard/profile" label="Hospital Profile" icon={<IconUser />} />
      </div>

      {/* Recent requests */}
      <SectionHeader title="Recent Blood Requests" href="/dashboard/requests" />
      {reqs.length === 0 ? (
        <EmptySlate label="No blood requests linked to your hospital yet" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {reqs.map(req => (
            <Link key={req.id} href={`/dashboard/requests/${req.id}`} style={{ textDecoration: 'none' }}>
              <div className="list-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                    {formatBG(req.bloodGroup)}
                  </span>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                      {req.unitsNeeded} unit{req.unitsNeeded > 1 ? 's' : ''}
                      {req.treatingDoctor ? ` · ${req.treatingDoctor}` : ''}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{fmtDate(req.createdAt)}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: URGENCY_COLOR[req.urgency] ?? '#6b7280' }} />
                  <Pill label={fmtStatus(req.status)} color={STATUS_COLORS[req.status] ?? '#6b7280'} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   VOLUNTEER DASHBOARD
══════════════════════════════════════════════════════════════════════════════ */

interface ActiveRequest {
  id: string; bloodGroup: string; unitsNeeded: number; urgency: string;
  priorityLevel: string; status: string; createdAt: string;
  hospitalName?: string | null; treatingDoctor?: string | null;
  patient?: { user: { name: string } };
  callLogs?: { callStatus: string }[];
}

interface PerfMetrics { totalCalls: number; successfulConversions: number; conversionRate: number; }

function VolunteerDashboard({ user }: { user: { name: string } }) {
  const [active, setActive] = useState<ActiveRequest[]>([]);
  const [perf, setPerf] = useState<PerfMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [dash, metrics] = await Promise.all([
        apiFetch<{ requests: ActiveRequest[]; total: number }>('/volunteers/dashboard'),
        apiFetch<{ metrics: PerfMetrics }>('/volunteers/performance'),
      ]);
      setActive(dash.requests);
      setPerf(metrics.metrics);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const criticalCount = active.filter(r => r.priorityLevel === 'CRITICAL' || r.urgency === 'CRITICAL').length;

  if (loading) return <Loader />;

  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <Greeting name={user.name} role="Volunteer" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '10px', marginBottom: '24px' }}>
        <StatCard label="Active Requests" value={active.length} accent={active.length > 0 ? '#f59e0b' : undefined} />
        <StatCard label="Critical" value={criticalCount} accent={criticalCount > 0 ? '#ef4444' : undefined} />
        <StatCard label="Calls Made" value={perf?.totalCalls ?? 0} />
        <StatCard label="Conversion" value={`${perf?.conversionRate ?? 0}%`} accent="var(--color-success)" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: '8px', marginBottom: '28px' }}>
        <QuickAction href="/dashboard/requests" label="All Blood Requests" icon={<IconBlood />} />
        <QuickAction href="/dashboard/medicines" label="Medicine Requests" icon={<IconPill />} />
        <QuickAction href="/dashboard/notifications" label="Notifications" icon={<IconPhone />} />
      </div>

      {/* Active requests needing action */}
      <SectionHeader title="Active Requests — Needs Action" href="/dashboard/requests" />
      {active.length === 0 ? (
        <EmptySlate label="No active requests — great work!" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {active.slice(0, 8).map(req => {
            const callsMade = req.callLogs?.length ?? 0;
            return (
              <Link key={req.id} href={`/dashboard/requests/${req.id}`} style={{ textDecoration: 'none' }}>
                <div className="list-row">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', flexShrink: 0 }}>
                        {formatBG(req.bloodGroup)}
                      </span>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                          {req.unitsNeeded} unit{req.unitsNeeded > 1 ? 's' : ''}
                          {req.patient?.user?.name ? ` · ${req.patient.user.name}` : ''}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {req.hospitalName ?? 'No hospital'}{req.treatingDoctor ? ` · ${req.treatingDoctor}` : ''}
                          {' · '}{fmtDate(req.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {callsMade > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{callsMade} call{callsMade > 1 ? 's' : ''}</span>
                      )}
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: PRIORITY_COLOR[req.priorityLevel] ?? '#6b7280' }} />
                      <Pill label={fmtStatus(req.status)} color={STATUS_COLORS[req.status] ?? '#6b7280'} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ADMIN DASHBOARD
══════════════════════════════════════════════════════════════════════════════ */

interface AdminStats {
  users: { total: number; verified: number; byRole: Record<string, number> };
  bloodRequests: { total: number; byStatus: Record<string, number> };
  medicineRequests: { total: number; byStatus: Record<string, number> };
  donors: { total: number; available: number };
  audit: { last24h: number };
}

function AdminDashboard({ user }: { user: { name: string } }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentBlood, setRecentBlood] = useState<BloodRequest[]>([]);
  const [recentMed, setRecentMed] = useState<MedRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, br, mr] = await Promise.all([
        apiFetch<AdminStats>('/admin/stats'),
        apiFetch<{ requests: BloodRequest[] }>('/blood-requests'),
        apiFetch<{ requests: MedRequest[] }>('/medicine-requests'),
      ]);
      setStats(s);
      setRecentBlood(br.requests.slice(0, 5));
      setRecentMed(mr.requests.slice(0, 4));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;

  const activeBlood = Object.entries(stats?.bloodRequests.byStatus ?? {})
    .filter(([s]) => !['FULFILLED','CANCELLED','REJECTED'].includes(s))
    .reduce((a, [, v]) => a + v, 0);

  const pendingMed = Object.entries(stats?.medicineRequests.byStatus ?? {})
    .filter(([s]) => ['PENDING_OCR','OCR_COMPLETE','PENDING_REVIEW'].includes(s))
    .reduce((a, [, v]) => a + v, 0);

  return (
    <div style={{ padding: '32px', maxWidth: '900px' }}>
      <Greeting name={user.name} role="Admin" />

      {/* Platform stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '10px', marginBottom: '24px' }}>
        <StatCard label="Total Users" value={stats?.users.total ?? 0} sub={`${stats?.users.verified ?? 0} verified`} />
        <StatCard label="Donors Available" value={stats?.donors.available ?? 0} sub={`of ${stats?.donors.total ?? 0} total`} accent="var(--color-success)" />
        <StatCard label="Active Blood Req" value={activeBlood} accent={activeBlood > 0 ? '#f59e0b' : undefined} />
        <StatCard label="Pending Med Rev" value={pendingMed} accent={pendingMed > 0 ? '#8b5cf6' : undefined} />
      </div>

      {/* Role breakdown */}
      <div style={{ padding: '16px 20px', borderRadius: '10px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', marginBottom: '24px' }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '12px' }}>User Role Breakdown</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {Object.entries(stats?.users.byRole ?? {}).map(([role, count]) => {
            const roleColor: Record<string,string> = { PATIENT:'#3b82f6', DONOR:'#ef4444', HOSPITAL:'#a78bfa', VOLUNTEER:'#22c55e', ADMIN:'#f59e0b' };
            return (
              <div key={role} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', backgroundColor: `${roleColor[role] ?? '#6b7280'}12` }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: roleColor[role] ?? '#6b7280' }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)' }}>{count}</span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{role}</span>
              </div>
            );
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(107,114,128,0.08)' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)' }}>{stats?.audit.last24h ?? 0}</span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>audit events (24h)</span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: '8px', marginBottom: '28px' }}>
        <QuickAction href="/dashboard/requests" label="Blood Requests" icon={<IconBlood />} />
        <QuickAction href="/dashboard/medicines" label="Medicine Queue" icon={<IconPill />} />
        <QuickAction href="/dashboard/users" label="Manage Users" icon={<IconUsers />} />
        <QuickAction href="/dashboard/audit" label="Audit Log" icon={<IconFile />} />
      </div>

      {/* Two-column: recent requests */}
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '20px' }}>
        <div>
          <SectionHeader title="Recent Blood Requests" href="/dashboard/requests" />
          {recentBlood.length === 0 ? <EmptySlate label="None yet" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recentBlood.map(req => (
                <Link key={req.id} href={`/dashboard/requests/${req.id}`} style={{ textDecoration: 'none' }}>
                  <div className="list-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                        {formatBG(req.bloodGroup)}
                      </span>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)' }}>{req.unitsNeeded}u · {req.urgency}</p>
                        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{fmtDate(req.createdAt)}</p>
                      </div>
                    </div>
                    <Pill label={fmtStatus(req.status)} color={STATUS_COLORS[req.status] ?? '#6b7280'} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeader title="Recent Medicine Requests" href="/dashboard/medicines" />
          {recentMed.length === 0 ? <EmptySlate label="None yet" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recentMed.map(req => (
                <Link key={req.id} href={`/dashboard/medicines/${req.id}`} style={{ textDecoration: 'none' }}>
                  <div className="list-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text)' }}>Prescription</p>
                      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{fmtDate(req.createdAt)}</p>
                    </div>
                    <Pill label={fmtStatus(req.status)} color={STATUS_COLORS[req.status] ?? '#6b7280'} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   SHARED PRIMITIVES
══════════════════════════════════════════════════════════════════════════════ */

function Greeting({ name, role }: { name: string; role: string }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <div style={{ marginBottom: '24px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: '2px' }}>
        {greeting}, {name.split(' ')[0]}
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{role} dashboard</p>
    </div>
  );
}

function Loader() {
  return (
    <div style={{ padding: '32px' }}>
      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading dashboard…</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === 'PATIENT')   return <PatientDashboard   user={user} />;
  if (user.role === 'DONOR')     return <DonorDashboard     user={user} />;
  if (user.role === 'HOSPITAL')  return <HospitalDashboard  user={user} />;
  if (user.role === 'VOLUNTEER') return <VolunteerDashboard user={user} />;
  if (user.role === 'ADMIN')     return <AdminDashboard     user={user} />;
  return null;
}
