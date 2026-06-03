'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

export default function NewMedicinePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  if (!user.identityVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="max-w-sm w-full text-center p-8 rounded-2xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Identity Verification Required</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>Verify your identity before requesting medicines.</p>
          <Link href="/dashboard/verify" className="inline-block px-6 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
            Verify Identity
          </Link>
        </div>
      </div>
    );
  }

  const handleFileSelect = (f: File) => {
    if (!f.type.match(/^image\/(png|jpeg|jpg|webp)|application\/pdf$/)) {
      setError('Please upload an image (PNG, JPEG, WebP) or PDF');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB');
      return;
    }
    setFile(f);
    setError('');
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError('Please upload a prescription'); return; }

    setLoading(true);
    setError('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      await apiFetch('/medicine-requests', {
        method: 'POST',
        body: JSON.stringify({
          prescriptionBase64: base64,
          fileName: file.name,
          mimeType: file.type,
          notes: notes || undefined,
        }),
      });
      router.push('/dashboard/medicines');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-lg mx-auto">
        <button onClick={() => router.push('/dashboard/medicines')} className="text-sm mb-6 inline-block" style={{ color: 'var(--color-text-muted)' }}>
          ← Back to Medicines
        </button>

        <h1 className="text-2xl font-semibold mb-6" style={{ color: 'var(--color-text)' }}>
          Upload Prescription
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="p-5 rounded-2xl border space-y-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            {error && (
              <div className="px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                {error}
              </div>
            )}

            {/* Upload zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all"
              style={{
                borderColor: dragOver ? 'var(--color-primary)' : 'var(--color-border)',
                backgroundColor: dragOver ? 'rgba(13, 148, 136, 0.05)' : 'transparent',
              }}
            >
              {preview ? (
                <div className="space-y-3">
                  <img src={preview} alt="Prescription preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{file?.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Click or drag to replace</p>
                </div>
              ) : file ? (
                <div className="space-y-2">
                  <div className="text-4xl">📄</div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{file.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>PDF uploaded — click to replace</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-4xl">📸</div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    Drop prescription image here
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    or click to browse • PNG, JPEG, WebP, PDF • Max 10MB
                  </p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>

            <div>
              <label htmlFor="med-notes" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Additional Notes
              </label>
              <textarea
                id="med-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any relevant context for the pharmacist..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none resize-none"
                style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !file}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {loading ? 'Uploading...' : 'Submit Prescription'}
          </button>
        </form>
      </div>
    </div>
  );
}
