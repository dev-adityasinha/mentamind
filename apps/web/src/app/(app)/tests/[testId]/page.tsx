"use client";

import { useRouter } from "next/navigation";
import { GenericTestRunner } from "@/components/screening/GenericTestRunner";
import { useAuth } from "@/lib/auth/context";

export default function TestPage({ params }: { params: { testId: string } }) {
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
          <h2 className="text-2xl font-bold text-text-primary mb-4">Clinical Assessments Unavailable</h2>
          <p className="text-text-secondary mb-8 leading-relaxed">
            Clinical assessments require a standard session so we can provide proper follow-up care if needed. Your current session is fully anonymous. Please exit anonymous mode to take this assessment.
          </p>
          <button
            onClick={async () => {
              await exitGhostMode();
              // The page will automatically re-render without ghost mode and show the test
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
    <GenericTestRunner
      testId={params.testId}
      onBack={() => router.push("/tests")}
      onHome={() => router.push("/home")}
    />
  );
}
