'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

interface MedicineRequest {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
  patient?: { user: { name: string } };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',
  PENDING_OCR: '#f59e0b',
  OCR_COMPLETE: '#8b5cf6',
  PENDING_REVIEW: '#3b82f6',
  APPROVED: '#22c55e',
  DISPATCHED: '#f97316',
  DELIVERED: '#10b981',
  CANCELLED: '#ef4444',
  REJECTED: '#dc2626',
};

function formatStatus(s: string) {
  return s.replace(/_/g, ' ');
}

const FILTER_TABS = ['ALL', 'PENDING', 'APPROVED', 'DELIVERED', 'CANCELLED'] as const;

export default function MedicinesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<MedicineRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTER_TABS)[number]>('ALL');

  useEffect(() => {
    if (user) loadRequests();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRequests = async () => {
    try {
      const data = await apiFetch<{ requests: MedicineRequest[] }>('/medicine-requests');
      setRequests(data.requests);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const filtered = requests.filter((r) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return ['DRAFT', 'PENDING_OCR', 'OCR_COMPLETE', 'PENDING_REVIEW'].includes(r.status);
    if (filter === 'APPROVED') return ['APPROVED', 'DISPATCHED'].includes(r.status);
    if (filter === 'DELIVERED') return r.status === 'DELIVERED';
    if (filter === 'CANCELLED') return ['CANCELLED', 'REJECTED'].includes(r.status);
    return true;
  });

  if (loading) {
    return (
      <div style={{ padding: '32px' }}>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
          Medicine Requests
        </h1>
        {user?.role === 'PATIENT' && (
          <Link href="/dashboard/medicines/new" className="btn-primary">
            Upload Prescription
          </Link>
        )}
      </div>

      {/* Filter tabs */}
      <div className="tab-bar" style={{ marginBottom: '16px' }}>
        {FILTER_TABS.map((tab) => (
          <button key={tab} onClick={() => setFilter(tab)} className={`tab-item${filter === tab ? ' active' : ''}`}>
            {tab}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', borderRadius: '10px',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {filter === 'ALL' ? 'No medicine requests yet' : `No ${filter.toLowerCase()} requests`}
          </p>
          {user?.role === 'PATIENT' && filter === 'ALL' && (
            <Link href="/dashboard/medicines/new" style={{ display: 'inline-block', marginTop: '12px', fontSize: '13px', fontWeight: 500, color: 'var(--color-primary)' }}>
              Upload your first prescription →
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.map((req) => (
            <button
              key={req.id}
              onClick={() => router.push(`/dashboard/medicines/${req.id}`)}
              className="list-row"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                    Medicine Request
                  </p>
                  {req.patient?.user && (
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                      {req.patient.user.name}
                    </p>
                  )}
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 500, padding: '2px 7px', borderRadius: '4px',
                  backgroundColor: `${STATUS_COLORS[req.status]}18`,
                  color: STATUS_COLORS[req.status],
                }}>
                  {formatStatus(req.status)}
                </span>
              </div>
              {req.notes && (
                <p style={{ fontSize: '12px', marginTop: '6px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {req.notes}
                </p>
              )}
              <p style={{ fontSize: '11px', marginTop: '6px', color: 'var(--color-text-muted)' }}>
                {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
