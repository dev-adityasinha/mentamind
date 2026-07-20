"use client";

import { useRouter } from "next/navigation";
import { TestBrowser } from "@/components/screening/TestBrowser";
import { useAuth } from "@/lib/auth/context";

export default function TestsIndexPage() {
  const router = useRouter();
  const { isGhostMode, exitGhostMode, isTransitioningGhostMode } = useAuth();

  if (isGhostMode) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center">
        <div className="bg-surface rounded-xl p-8 border border-border shadow-sm">
          <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-4">Clinical Library Unavailable</h2>
          <p className="text-text-secondary mb-8 leading-relaxed">
            The clinical assessment library requires a standard session so we can provide proper follow-up care if needed. Your current session is fully anonymous. Please exit anonymous mode to browse the library.
          </p>
          <button
            onClick={async () => {
              await exitGhostMode();
            }}
            disabled={isTransitioningGhostMode}
            className="bg-brand text-brand-foreground font-medium py-3 px-6 rounded-lg hover:bg-brand-hover transition-colors focus:ring-4 focus:ring-brand/20 disabled:opacity-50"
          >
            {isTransitioningGhostMode ? "Switching..." : "Exit anonymous mode"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">Clinical Assessments</h1>
        <p className="mt-2 text-text-secondary">
          Browse our library of clinical-grade assessments. These tools can help identify areas where you might benefit from additional support.
        </p>
      </div>
      <TestBrowser 
        onSelectTest={(testId) => router.push(`/tests/${testId}`)} 
        onBack={() => router.push("/home")}
      />
    </div>
  );
}
