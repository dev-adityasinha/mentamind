'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

interface OcrMedicine {
  name: string;
  dosage: string;
  quantity: number;
  frequency?: string;
  confidence?: number;
}

interface MedicineRequest {
  id: string;
  status: string;
  notes: string | null;
  prescriptionFileKey: string | null;
  ocrSuggestions: { medicines: OcrMedicine[]; rawText: string; overallConfidence: number } | null;
  adminReviewedData: OcrMedicine[] | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: { user: { id: string; name: string; email: string } };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6B7280', PENDING_OCR: '#F59E0B', OCR_COMPLETE: '#8B5CF6',
  PENDING_REVIEW: '#3B82F6', APPROVED: '#22C55E', DISPATCHED: '#F97316',
  DELIVERED: '#0D9488', CANCELLED: '#EF4444', REJECTED: '#DC2626',
};

const NEXT_ACTIONS: Record<string, { label: string; status: string; color: string }[]> = {
  PENDING_REVIEW: [
    { label: 'Approve', status: 'APPROVED', color: '#22C55E' },
    { label: 'Reject', status: 'REJECTED', color: '#DC2626' },
  ],
  APPROVED: [
    { label: 'Mark Dispatched', status: 'DISPATCHED', color: '#F97316' },
    { label: 'Cancel', status: 'CANCELLED', color: '#EF4444' },
  ],
  DISPATCHED: [
    { label: 'Mark Delivered', status: 'DELIVERED', color: '#0D9488' },
    { label: 'Cancel', status: 'CANCELLED', color: '#EF4444' },
  ],
};

function formatStatus(s: string) { return s.replace(/_/g, ' '); }

export default function MedicineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [request, setRequest] = useState<MedicineRequest | null>(null);
  const [prescriptionUrl, setPrescriptionUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');

  // Review editing state
  const [reviewMeds, setReviewMeds] = useState<OcrMedicine[]>([]);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (user) loadRequest();
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRequest = async () => {
    try {
      const data = await apiFetch<{ request: MedicineRequest; prescriptionUrl: string | null }>(`/medicine-requests/${id}`);
      setRequest(data.request);
      setPrescriptionUrl(data.prescriptionUrl);
      if (data.request.ocrSuggestions?.medicines) {
        setReviewMeds(data.request.ocrSuggestions.medicines.map((m) => ({
          name: m.name, dosage: m.dosage, quantity: m.quantity, frequency: m.frequency || '',
        })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleOcr = async () => {
    setActionLoading('OCR');
    setError('');
    try {
      const data = await apiFetch<{ request: MedicineRequest; ocrResult: { medicines: OcrMedicine[] } }>(`/medicine-requests/${id}/ocr`, { method: 'POST' });
      setRequest(data.request);
      setReviewMeds(data.ocrResult.medicines.map((m) => ({
        name: m.name, dosage: m.dosage, quantity: m.quantity, frequency: m.frequency || '',
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR failed');
    } finally {
      setActionLoading('');
    }
  };

  const handleSubmitReview = async () => {
    setActionLoading('REVIEW');
    setError('');
    try {
      const data = await apiFetch<{ request: MedicineRequest }>(`/medicine-requests/${id}/review`, {
        method: 'PUT',
        body: JSON.stringify({ medicines: reviewMeds }),
      });
      setRequest(data.request);
      setShowReview(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setActionLoading('');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(newStatus);
    setError('');
    try {
      const data = await apiFetch<{ request: MedicineRequest }>(`/medicine-requests/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setRequest(data.request);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setActionLoading('');
    }
  };

  const updateMed = (index: number, field: keyof OcrMedicine, value: string | number) => {
    setReviewMeds((prev) => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const removeMed = (index: number) => {
    setReviewMeds((prev) => prev.filter((_, i) => i !== index));
  };

  const addMed = () => {
    setReviewMeds((prev) => [...prev, { name: '', dosage: '', quantity: 1, frequency: '' }]);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <span style={{ color: 'var(--color-text-muted)' }}>Loading...</span>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-center">
          <p style={{ color: 'var(--color-error)' }}>{error || 'Not found'}</p>
          <button onClick={() => router.push('/dashboard/medicines')} className="mt-4 text-sm" style={{ color: 'var(--color-primary-light)' }}>← Back</button>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'VOLUNTEER';
  const actions = NEXT_ACTIONS[request.status] || [];
  const ocrData = request.ocrSuggestions as MedicineRequest['ocrSuggestions'];
  const reviewData = request.adminReviewedData as OcrMedicine[] | null;
  const inputStyle = { backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' };

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.push('/dashboard/medicines')} className="text-sm mb-6 inline-block" style={{ color: 'var(--color-text-muted)' }}>
          ← Back to Medicines
        </button>

        {error && (
          <div className="px-4 py-3 rounded-xl text-sm mb-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)' }}>{error}</div>
        )}

        {/* Request header */}
        <div className="p-6 rounded-2xl border mb-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Medicine Request</h1>
              {request.patient?.user && (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>by {request.patient.user.name}</p>
              )}
            </div>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ backgroundColor: `${STATUS_COLORS[request.status]}20`, color: STATUS_COLORS[request.status] }}>
              {formatStatus(request.status)}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Created</p>
              <p className="font-medium" style={{ color: 'var(--color-text)' }}>{new Date(request.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>ID</p>
              <p className="font-mono text-xs" style={{ color: 'var(--color-text)' }}>{request.id.slice(0, 8)}...</p>
            </div>
            {request.reviewedAt && (
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Reviewed</p>
                <p className="font-medium" style={{ color: 'var(--color-text)' }}>{new Date(request.reviewedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
              </div>
            )}
          </div>
          {request.notes && (
            <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Notes</p>
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>{request.notes}</p>
            </div>
          )}
        </div>

        {/* Prescription image */}
        {prescriptionUrl && (
          <div className="p-5 rounded-2xl border mb-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>Prescription</h2>
            <img src={prescriptionUrl} alt="Prescription" className="max-h-64 rounded-xl mx-auto object-contain" />
          </div>
        )}

        {/* Admin actions */}
        {isAdmin && (
          <div className="p-5 rounded-2xl border mb-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>Actions</h2>
            <div className="flex flex-wrap gap-2">
              {request.status === 'PENDING_OCR' && (
                <button onClick={handleOcr} disabled={!!actionLoading}
                  className="px-4 py-2 rounded-xl text-white text-sm font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{ backgroundColor: '#8B5CF6' }}>
                  {actionLoading === 'OCR' ? 'Processing...' : '🔍 Run OCR'}
                </button>
              )}
              {request.status === 'OCR_COMPLETE' && (
                <button onClick={() => setShowReview(true)} disabled={!!actionLoading}
                  className="px-4 py-2 rounded-xl text-white text-sm font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{ backgroundColor: '#3B82F6' }}>
                  ✏️ Review & Edit
                </button>
              )}
              {actions.map((action) => (
                <button key={action.status} onClick={() => handleStatusChange(action.status)} disabled={!!actionLoading}
                  className="px-4 py-2 rounded-xl text-white text-sm font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{ backgroundColor: action.color }}>
                  {actionLoading === action.status ? 'Updating...' : action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* OCR Results */}
        {ocrData && !showReview && (
          <div className="p-5 rounded-2xl border mb-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                OCR Results
              </h2>
              <span className="text-xs font-medium px-2 py-1 rounded-lg"
                style={{ backgroundColor: `${ocrData.overallConfidence > 0.7 ? '#22C55E' : '#F59E0B'}20`, color: ocrData.overallConfidence > 0.7 ? '#22C55E' : '#F59E0B' }}>
                {Math.round(ocrData.overallConfidence * 100)}% confidence
              </span>
            </div>
            <div className="space-y-2">
              {ocrData.medicines.map((med, i) => (
                <div key={i} className="p-3 rounded-xl flex items-center justify-between" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{med.name} — {med.dosage}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Qty: {med.quantity} {med.frequency && `• ${med.frequency}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                      <div className="h-full rounded-full" style={{ width: `${(med.confidence || 0) * 100}%`, backgroundColor: (med.confidence || 0) > 0.7 ? '#22C55E' : '#F59E0B' }} />
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{Math.round((med.confidence || 0) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin Review Panel (editable) */}
        {showReview && (
          <div className="p-5 rounded-2xl border mb-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Review & Edit Medicines
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Edit the OCR-extracted data below. Add or remove medicines as needed.
            </p>
            <div className="space-y-3">
              {reviewMeds.map((med, i) => (
                <div key={i} className="p-3 rounded-xl space-y-2" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Medicine #{i + 1}</span>
                    <button onClick={() => removeMed(i)} className="text-xs" style={{ color: 'var(--color-error)' }}>Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={med.name} onChange={(e) => updateMed(i, 'name', e.target.value)} placeholder="Name"
                      className="px-3 py-2 rounded-lg text-sm border outline-none" style={inputStyle} />
                    <input value={med.dosage} onChange={(e) => updateMed(i, 'dosage', e.target.value)} placeholder="Dosage"
                      className="px-3 py-2 rounded-lg text-sm border outline-none" style={inputStyle} />
                    <input type="number" value={med.quantity} onChange={(e) => updateMed(i, 'quantity', parseInt(e.target.value) || 1)} placeholder="Qty" min={1}
                      className="px-3 py-2 rounded-lg text-sm border outline-none" style={inputStyle} />
                    <input value={med.frequency || ''} onChange={(e) => updateMed(i, 'frequency', e.target.value)} placeholder="Frequency"
                      className="px-3 py-2 rounded-lg text-sm border outline-none" style={inputStyle} />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addMed} className="mt-3 text-sm font-medium" style={{ color: 'var(--color-primary-light)' }}>
              + Add Medicine
            </button>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSubmitReview} disabled={!!actionLoading || reviewMeds.length === 0}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}>
                {actionLoading === 'REVIEW' ? 'Submitting...' : 'Submit Review'}
              </button>
              <button onClick={() => setShowReview(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Admin-reviewed data (read-only display) */}
        {reviewData && reviewData.length > 0 && !showReview && (
          <div className="p-5 rounded-2xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Reviewed Medicines ✅
            </h2>
            <div className="space-y-2">
              {reviewData.map((med, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{med.name} — {med.dosage}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Qty: {med.quantity} {med.frequency && `• ${med.frequency}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
