"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth/context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isGhostMode, isTransitioningGhostMode, logout, exitGhostMode } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isGhostMode && !user.onboarding_completed_at) {
      router.replace("/onboarding");
    }
  }, [user, isLoading, isGhostMode, router]);

  if (isLoading) return null;

  if (!user || (!isGhostMode && !user.onboarding_completed_at)) return null;

  async function handleSignOut() {
    await logout();
    router.replace("/login");
  }

  async function handleExitGhostMode() {
    await exitGhostMode();
    router.replace("/home");
  }

  const showGhostChrome = isGhostMode && !isTransitioningGhostMode;

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {showGhostChrome && (
        <div className="bg-brand text-white px-4 py-2 text-center text-sm font-medium transition-colors">
          You are currently in Ghost Mode. Your activity is completely untraceable.
        </div>
      )}
      <header className={`border-b transition-colors duration-200 ${showGhostChrome ? 'border-brand/30 bg-brand/5' : 'border-border bg-surface'}`}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/logo/mentamind.webp" alt="Mentamind Logo" width={24} height={24} className="object-contain" />
              <span className="text-base font-semibold text-text-primary">
                Mentamind
              </span>
              {showGhostChrome && (
                <span className="ml-2 inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                  Ghost Mode
                </span>
              )}
            </div>
            <nav aria-label="Main navigation" className="flex items-center gap-6">
              <Link
                href="/home"
                className={`text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm ${
                  pathname?.startsWith("/home")
                    ? "text-brand font-medium"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Home
              </Link>
              {!isGhostMode && !isTransitioningGhostMode && (
                <Link
                  href="/journal"
                  className={`text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm ${
                    pathname?.startsWith("/journal")
                      ? "text-brand font-medium"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Journal
                </Link>
              )}
              {!isGhostMode && !isTransitioningGhostMode && (
                <Link
                  href="/coach"
                  className={`text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm ${
                    pathname?.startsWith("/coach")
                      ? "text-brand font-medium"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Coach
                </Link>
              )}
              {!isGhostMode && !isTransitioningGhostMode && (
                <Link
                  href="/tests"
                  className={`text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm ${
                    pathname?.startsWith("/tests")
                      ? "text-brand font-medium"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Screening
                </Link>
              )}
              {!isGhostMode && !isTransitioningGhostMode && (
                <Link
                  href="/settings"
                  className={`text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm ${
                    pathname?.startsWith("/settings")
                      ? "text-brand font-medium"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Settings
                </Link>
              )}
              {!isGhostMode && !isTransitioningGhostMode && (user.role === "admin" || user.role === "hr_manager") && (
                <Link
                  href="/invites"
                  className={`text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm ${
                    pathname?.startsWith("/invites")
                      ? "text-brand font-medium"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Invites
                </Link>
              )}
              {!isGhostMode && !isTransitioningGhostMode && (user.role === "admin" || user.role === "hr_manager") && (
                <Link
                  href="/admin/hr"
                  className={`text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm ${
                    pathname?.startsWith("/admin/hr")
                      ? "text-brand font-medium"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  HR Dashboard
                </Link>
              )}
              {(isGhostMode || isTransitioningGhostMode) && (
                <Link
                  href="/forum"
                  className={`text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm ${
                    pathname?.startsWith("/forum")
                      ? "text-brand font-medium"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Forum
                </Link>
              )}
            </nav>
            <div className="flex items-center gap-4">
              {isTransitioningGhostMode ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-border"></div>
                  <div className="h-4 w-16 animate-pulse rounded bg-border"></div>
                </div>
              ) : (
                <>
                  <span className="text-sm text-text-muted hidden sm:block transition-opacity">
                    {showGhostChrome ? "" : user.display_name}
                  </span>
                  {showGhostChrome ? (
                    <button
                      type="button"
                      onClick={handleExitGhostMode}
                      className="text-sm font-medium text-brand hover:text-brand/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm"
                    >
                      Exit anonymous mode
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="text-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm"
                    >
                      Sign out
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
