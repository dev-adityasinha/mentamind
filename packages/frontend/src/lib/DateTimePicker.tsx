'use client';

import { useState, useEffect, useRef } from 'react';

/* ─── helpers ────────────────────────────────────────────────────────────────── */

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstDayOf(y: number, m: number)  { return new Date(y, m, 1).getDay(); }

/* ─── types ──────────────────────────────────────────────────────────────────── */

interface Props {
  value: string;                    // ISO string or ''
  onChange: (iso: string) => void;
  minDate?: Date;
  placeholder?: string;
}

/* ─── component ──────────────────────────────────────────────────────────────── */

export default function DateTimePicker({ value, onChange, minDate, placeholder = 'Select date & time' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const parsed   = value ? new Date(value) : null;
  const [open,   setOpen]   = useState(false);
  const [viewY,  setViewY]  = useState(() => parsed?.getFullYear()  ?? new Date().getFullYear());
  const [viewM,  setViewM]  = useState(() => parsed?.getMonth()     ?? new Date().getMonth());
  const [selDay, setSelDay] = useState<number | null>(() => parsed?.getDate() ?? null);
  const [selMon, setSelMon] = useState<number | null>(() => parsed?.getMonth() ?? null);
  const [selYr,  setSelYr]  = useState<number | null>(() => parsed?.getFullYear() ?? null);
  const [hour,   setHour]   = useState(() => parsed?.getHours()   ?? 9);
  const [minute, setMinute] = useState(() => parsed?.getMinutes() ?? 0);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Emit whenever day or time changes
  useEffect(() => {
    if (selDay !== null && selMon !== null && selYr !== null) {
      const d = new Date(selYr, selMon, selDay, hour, minute, 0, 0);
      onChange(d.toISOString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selDay, selMon, selYr, hour, minute]);

  const prevMonth = () => { if (viewM === 0) { setViewM(11); setViewY(y => y - 1); } else setViewM(m => m - 1); };
  const nextMonth = () => { if (viewM === 11) { setViewM(0); setViewY(y => y + 1); } else setViewM(m => m + 1); };

  const selectDay = (d: number) => {
    setSelDay(d); setSelMon(viewM); setSelYr(viewY);
  };

  const isSelected = (d: number) => selDay === d && selMon === viewM && selYr === viewY;

  const isPast = (d: number) => {
    if (!minDate) return false;
    const cell = new Date(viewY, viewM, d, 23, 59);
    return cell < minDate;
  };

  const displayValue = parsed
    ? parsed.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  const total  = daysInMonth(viewY, viewM);
  const offset = firstDayOf(viewY, viewM);
  const cells  = Array.from({ length: offset + total }, (_, i) => (i < offset ? null : i - offset + 1));

  // pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
          border: `1px solid ${open ? 'var(--color-primary)' : 'var(--color-border)'}`,
          backgroundColor: 'var(--color-bg)', color: displayValue ? 'var(--color-text)' : 'var(--color-text-muted)',
          fontSize: '13px', fontWeight: displayValue ? 500 : 400,
          transition: 'border-color 150ms ease',
          boxSizing: 'border-box',
        }}
      >
        <CalendarIcon />
        <span style={{ flex: 1 }}>{displayValue || placeholder}</span>
        <ChevronIcon open={open} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
          width: '320px', borderRadius: '14px', overflow: 'hidden',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          {/* ── Calendar ── */}
          <div style={{ padding: '16px' }}>
            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <button type="button" onClick={prevMonth} style={navBtn}>‹</button>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
                {MONTHS[viewM]} {viewY}
              </p>
              <button type="button" onClick={nextMonth} style={navBtn}>›</button>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: '4px' }}>
              {DAYS.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)', padding: '4px 0', letterSpacing: '0.04em' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
              {cells.map((d, i) => {
                if (d === null) return <div key={i} />;
                const selected = isSelected(d);
                const past     = isPast(d);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={past}
                    onClick={() => selectDay(d)}
                    style={{
                      aspectRatio: '1', borderRadius: '8px', border: 'none', cursor: past ? 'not-allowed' : 'pointer',
                      fontSize: '12px', fontWeight: selected ? 700 : 400,
                      backgroundColor: selected ? 'var(--color-primary)' : 'transparent',
                      color: past ? 'var(--color-border)' : selected ? '#fff' : 'var(--color-text)',
                      transition: 'background-color 120ms ease',
                    }}
                    onMouseEnter={e => { if (!selected && !past) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-hover)'; }}
                    onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />

          {/* ── Time picker ── */}
          <div style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
              🕐 Select Time
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Hour */}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '4px', textAlign: 'center' }}>Hour</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <SpinBtn onClick={() => setHour(h => h === 0 ? 23 : h - 1)}>−</SpinBtn>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {String(hour).padStart(2, '0')}
                  </div>
                  <SpinBtn onClick={() => setHour(h => h === 23 ? 0 : h + 1)}>+</SpinBtn>
                </div>
              </div>

              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-muted)', marginTop: '14px' }}>:</div>

              {/* Minute */}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '4px', textAlign: 'center' }}>Minute</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <SpinBtn onClick={() => setMinute(m => m === 0 ? 55 : m - 5)}>−</SpinBtn>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {String(minute).padStart(2, '0')}
                  </div>
                  <SpinBtn onClick={() => setMinute(m => m === 55 ? 0 : m + 5)}>+</SpinBtn>
                </div>
              </div>

              {/* AM / PM quick */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '14px' }}>
                <QuickTimeBtn label="AM" active={hour < 12} onClick={() => { if (hour >= 12) setHour(h => h - 12); }} />
                <QuickTimeBtn label="PM" active={hour >= 12} onClick={() => { if (hour < 12) setHour(h => h + 12); }} />
              </div>
            </div>
          </div>

          {/* Confirm */}
          <div style={{ padding: '10px 16px 14px' }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={selDay === null}
              style={{
                width: '100%', padding: '9px', borderRadius: '9px', border: 'none',
                fontSize: '13px', fontWeight: 700, cursor: selDay ? 'pointer' : 'not-allowed',
                backgroundColor: selDay ? 'var(--color-primary)' : 'var(--color-border)',
                color: '#fff', opacity: selDay ? 1 : 0.5, transition: 'opacity 150ms ease',
              }}
            >
              {selDay ? `Confirm — ${MONTHS[selMon!].slice(0,3)} ${selDay}, ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}` : 'Select a date first'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── tiny sub-components ────────────────────────────────────────────────────── */

const navBtn: React.CSSProperties = {
  width: '28px', height: '28px', borderRadius: '8px', border: 'none',
  backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
  fontSize: '16px', fontWeight: 700, cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
};

function SpinBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
        fontSize: '16px', fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function QuickTimeBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '3px 8px', borderRadius: '5px', border: 'none', cursor: 'pointer',
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em',
        backgroundColor: active ? 'var(--color-primary)' : 'var(--color-bg)',
        color: active ? '#fff' : 'var(--color-text-muted)',
        transition: 'background-color 120ms ease',
      }}
    >
      {label}
    </button>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, transition: 'transform 150ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
