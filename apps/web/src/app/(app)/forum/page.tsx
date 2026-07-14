"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/context";

export default function ForumPage() {
  const { isGhostMode, enterGhostMode } = useAuth();
  const [loading, setLoading] = useState(!isGhostMode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initGhostMode() {
      if (!isGhostMode) {
        try {
          await enterGhostMode();
        } catch (err) {
          setError("Failed to enter anonymous mode. Please try again.");
        } finally {
          setLoading(false);
        }
      }
    }
    
    initGhostMode();
  }, [isGhostMode, enterGhostMode]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent mx-auto"></div>
          <p className="text-text-secondary">Securing your anonymous session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5">
        <h3 className="text-2xl font-semibold leading-6 text-text-primary">
          Anonymous Forum
        </h3>
        <p className="mt-2 max-w-4xl text-sm text-text-secondary">
          Share your experiences and get peer support. Your posts are completely
          untraceable to your real identity. Only members of your organization can
          see this forum.
        </p>
      </div>
      
      {/* Forum content will go here */}
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <p className="text-text-secondary text-center py-12">
          Forum implementation coming soon.
        </p>
      </div>
    </div>
  );
}
