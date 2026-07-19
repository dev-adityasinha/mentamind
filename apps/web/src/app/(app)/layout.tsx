"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { NotificationDropdown } from "@/components/dashboard/NotificationDropdown";
import { useI18n } from "@/lib/i18n/Context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isGhostMode, isTransitioningGhostMode, logout, exitGhostMode } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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

  const pillClass = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
      active
        ? "bg-brand text-brand-foreground font-medium"
        : "text-text-secondary hover:text-text-primary"
    }`;

  const navItems: { href: string; label: string; isActive?: (pathname: string | null) => boolean }[] = [
    { href: "/home", label: t("dashboard.welcome") === "dashboard.welcome" ? "Home" : t("dashboard.welcome").split(" ")[0] },
    ...(!isGhostMode && !isTransitioningGhostMode
      ? [
          { href: "/journal", label: t("dashboard.journal") },
          { href: "/meditation", label: t("dashboard.meditation") },
          { href: "/coach", label: t("dashboard.ai_coach") },
          { href: "/tests", label: t("dashboard.screening") },
          { href: "/settings", label: t("dashboard.settings") },
        ]
      : []),
    ...(!isGhostMode && !isTransitioningGhostMode && (user.role === "admin" || user.role === "hr_manager")
      ? [
          { href: "/invites", label: "Invites" },
          { href: "/admin/hr", label: "HR Dashboard" },
        ]
      : []),
    ...(!isGhostMode && !isTransitioningGhostMode && (user.role === "admin" || user.role === "hr_manager" || user.role === "moderator")
      ? [
          {
            href: "/admin",
            label: user.role === "moderator" ? "Moderation" : "Admin",
            isActive: (p: string | null) => p === "/admin" || (!!p?.startsWith("/admin/") && !p?.startsWith("/admin/hr")),
          },
        ]
      : []),
    ...(isGhostMode || isTransitioningGhostMode ? [{ href: "/forum", label: t("dashboard.community") }] : []),
  ];

  return (
    <div className="min-h-screen bg-black p-3 md:p-6">
      <div className="relative isolate flex min-h-[calc(100vh-1.5rem)] md:min-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-3xl border border-border bg-bg shadow-2xl">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full opacity-0 dark:opacity-[0.15] blur-[120px] -z-10 transition-opacity"
          style={{ background: "radial-gradient(circle, #1d4ed8 0%, transparent 70%)" }}
        />
        {showGhostChrome && (
          <div className="bg-brand text-white px-4 py-2 text-center text-sm font-medium transition-colors">
            You are currently in Ghost Mode. Your activity is completely untraceable.
          </div>
        )}
        <header className="transition-colors duration-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-[auto_1fr_auto] h-20 items-center gap-4">
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
              <div className="flex justify-center">
                <nav
                  aria-label="Main navigation"
                  className="hidden md:flex items-center gap-1 rounded-full border border-border bg-surface-raised/80 backdrop-blur-md px-1.5 py-1.5 shadow-sm"
                >
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={pillClass(item.isActive ? item.isActive(pathname) : !!pathname?.startsWith(item.href))}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 justify-self-end">
                {isTransitioningGhostMode ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-24 animate-pulse rounded bg-border"></div>
                    <div className="h-4 w-16 animate-pulse rounded bg-border"></div>
                  </div>
                ) : (
                  <>
                    {!showGhostChrome && <NotificationDropdown />}
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
                        className="hidden md:inline-flex items-center rounded-full bg-brand text-brand-foreground px-4 py-2 text-sm font-medium hover:bg-brand-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        Sign out
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setMobileNavOpen((open) => !open)}
                  aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
                  aria-expanded={mobileNavOpen}
                  className="md:hidden w-9 h-9 rounded-full border border-border bg-surface-raised/80 backdrop-blur-md flex items-center justify-center text-text-primary"
                >
                  {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {mobileNavOpen && (
              <nav aria-label="Mobile navigation" className="md:hidden flex flex-col gap-1 pb-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      (item.isActive ? item.isActive(pathname) : !!pathname?.startsWith(item.href))
                        ? "bg-brand text-brand-foreground font-medium"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                {!showGhostChrome && (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-left rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-raised"
                  >
                    Sign out
                  </button>
                )}
              </nav>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-8 pt-2 pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
