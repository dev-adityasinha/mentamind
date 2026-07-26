"use client";

// Card illustrations copied verbatim from Mindful-Architecture
// (components/Illustrations.tsx) so the Today page matches the original.

export function MeditationIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="120" fill="url(#meditationGrad)" rx="16" />
      <path d="M0 60 Q30 45 60 55 T120 50 V120 H0 Z" fill="#4b9b87" opacity="0.3" />
      <path d="M0 70 Q40 55 80 65 T120 60 V120 H0 Z" fill="#4b9b87" opacity="0.4" />
      <path d="M0 80 Q35 70 70 78 T120 75 V120 H0 Z" fill="#4b9b87" opacity="0.5" />
      <path d="M0 90 Q30 85 60 88 T120 85 V120 H0 Z" fill="#4b9b87" opacity="0.6" />
      <defs>
        <linearGradient id="meditationGrad" x1="0" y1="0" x2="120" y2="120">
          <stop offset="0%" stopColor="#e8f5f3" />
          <stop offset="100%" stopColor="#d0ebe6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ReflectionIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="120" fill="url(#reflectionGrad)" rx="16" />
      <g opacity="0.7">
        <path d="M60 100 Q60 80 55 70 Q50 60 55 50 Q58 45 60 40" stroke="#d4a59a" strokeWidth="3" fill="none" />
        <path d="M60 70 Q50 65 45 55" stroke="#d4a59a" strokeWidth="2" fill="none" />
        <path d="M60 70 Q70 65 75 55" stroke="#d4a59a" strokeWidth="2" fill="none" />
        <path d="M55 50 Q45 48 40 40" stroke="#d4a59a" strokeWidth="1.5" fill="none" />
        <path d="M55 50 Q58 42 55 35" stroke="#d4a59a" strokeWidth="1.5" fill="none" />
        <path d="M60 55 Q65 50 70 45" stroke="#d4a59a" strokeWidth="1.5" fill="none" />
        <path d="M70 45 Q75 42 80 40" stroke="#d4a59a" strokeWidth="1" fill="none" />
        <path d="M45 55 Q40 52 35 50" stroke="#d4a59a" strokeWidth="1" fill="none" />
      </g>
      <defs>
        <linearGradient id="reflectionGrad" x1="0" y1="0" x2="120" y2="120">
          <stop offset="0%" stopColor="#fff5f3" />
          <stop offset="100%" stopColor="#ffe8e3" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function TaskIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="120" fill="url(#taskGrad)" rx="16" />
      <circle cx="60" cy="60" r="35" fill="url(#taskCircleGrad)" opacity="0.4" />
      <circle cx="75" cy="45" r="20" fill="#93c5fd" opacity="0.3" />
      <ellipse cx="50" cy="70" rx="25" ry="15" fill="#60a5fa" opacity="0.25" />
      <defs>
        <linearGradient id="taskGrad" x1="0" y1="0" x2="120" y2="120">
          <stop offset="0%" stopColor="#eff6ff" />
          <stop offset="100%" stopColor="#dbeafe" />
        </linearGradient>
        <linearGradient id="taskCircleGrad" x1="30" y1="30" x2="90" y2="90">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
    </svg>
  );
}
