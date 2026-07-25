"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Menu,
  X,
  LayoutDashboard,
  BookText,
  Flower2,
  MessageCircleHeart,
  ClipboardList,
  Settings,
  Mail,
  BarChart3,
  ShieldCheck,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { NotificationDropdown } from "@/components/dashboard/NotificationDropdown";
import { useI18n } from "@/lib/i18n/Context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isGhostMode, isTransitioningGhostMode, logout, exitGhostMode } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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

  const navItems: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    isActive?: (pathname: string | null) => boolean;
  }[] = [
    {
      href: "/home",
      label: t("dashboard.welcome") === "dashboard.welcome" ? "Home" : t("dashboard.welcome").split(" ")[0],
      icon: LayoutDashboard,
    },
    ...(!isGhostMode && !isTransitioningGhostMode
      ? [
          { href: "/journal", label: t("dashboard.journal"), icon: BookText },
          { href: "/meditation", label: t("dashboard.meditation"), icon: Flower2 },
          { href: "/coach", label: t("dashboard.ai_coach"), icon: MessageCircleHeart },
          { href: "/tests", label: t("dashboard.screening"), icon: ClipboardList },
          { href: "/settings", label: t("dashboard.settings"), icon: Settings },
        ]
      : []),
    ...(!isGhostMode && !isTransitioningGhostMode && (user.role === "admin" || user.role === "hr_manager")
      ? [
          { href: "/invites", label: "Invites", icon: Mail },
          { href: "/admin/hr", label: "HR Dashboard", icon: BarChart3 },
        ]
      : []),
    ...(!isGhostMode && !isTransitioningGhostMode && (user.role === "admin" || user.role === "hr_manager" || user.role === "moderator")
      ? [
          {
            href: "/admin",
            label: user.role === "moderator" ? "Moderation" : "Admin",
            icon: ShieldCheck,
            isActive: (p: string | null) => p === "/admin" || (!!p?.startsWith("/admin/") && !p?.startsWith("/admin/hr")),
          },
        ]
      : []),
    ...(isGhostMode || isTransitioningGhostMode ? [{ href: "/forum", label: t("dashboard.community"), icon: Users }] : []),
  ];

  const isItemActive = (item: (typeof navItems)[number]) =>
    item.isActive ? item.isActive(pathname) : !!pathname?.startsWith(item.href);

  const itemClass = (active: boolean) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
      active
        ? "bg-brand-subtle text-brand font-semibold"
        : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
    }`;

  // Shared sidebar body, reused by the desktop rail and the mobile drawer.
  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full flex-col">
      {/* Header: WELCOME / user */}
      <div className="flex items-center justify-between gap-2 px-4 pt-5 pb-4">
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-widest text-text-primary">WELCOME</p>
            <p className="truncate text-sm text-brand">
              {showGhostChrome ? "Anonymous Guest" : user.display_name}
            </p>
          </div>
        )}
        {/* Desktop collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden md:inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        {/* Mobile close button */}
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close menu"
            className="md:hidden h-8 w-8 shrink-0 items-center justify-center inline-flex rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-raised"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showGhostChrome && !collapsed && (
        <div className="mx-3 mb-3 rounded-lg bg-brand/10 px-3 py-2 text-xs font-medium text-brand">
          Ghost Mode — your activity is untraceable.
        </div>
      )}

      <div className="mx-3 border-t border-border" />

      {/* Nav items */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isItemActive(item);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`${itemClass(active)} ${collapsed ? "md:justify-center md:px-2" : ""}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer: sign out / exit + Powered by */}
      <div className="mt-auto px-3 pb-4">
        <div className="mx-0 mb-3 border-t border-border" />
        {isTransitioningGhostMode ? (
          <div className="flex flex-col gap-2 px-1">
            <div className="h-4 w-24 animate-pulse rounded bg-border" />
            <div className="h-4 w-16 animate-pulse rounded bg-border" />
          </div>
        ) : showGhostChrome ? (
          <button
            type="button"
            onClick={handleExitGhostMode}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              collapsed ? "md:justify-center md:px-2" : ""
            }`}
          >
            <X className="h-5 w-5 shrink-0" />
            <span className={collapsed ? "md:hidden" : ""}>Exit anonymous mode</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSignOut}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              collapsed ? "md:justify-center md:px-2" : ""
            }`}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={collapsed ? "md:hidden" : ""}>Sign out</span>
          </button>
        )}
        {!collapsed && (
          <p className="px-3 pt-3 text-xs text-text-muted">
            Powered by: <span className="font-medium text-text-secondary">mentamind.in</span>
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black p-3 md:p-6">
      <div className="relative isolate flex min-h-[calc(100vh-1.5rem)] md:min-h-[calc(100vh-3rem)] overflow-hidden rounded-3xl border border-border bg-bg shadow-2xl">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full opacity-0 dark:opacity-[0.15] blur-[120px] -z-10 transition-opacity"
          style={{ background: "radial-gradient(circle, #1d4ed8 0%, transparent 70%)" }}
        />

        {/* Desktop sidebar rail */}
        <aside
          className={`hidden md:flex shrink-0 flex-col border-r border-border bg-surface/60 backdrop-blur-md transition-[width] duration-200 ${
            collapsed ? "w-[76px]" : "w-64"
          }`}
        >
          <SidebarContent />
        </aside>

        {/* Mobile drawer */}
        {mobileNavOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden="true"
            />
            <aside className="absolute left-0 top-0 h-full w-72 border-r border-border bg-surface shadow-2xl">
              <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {showGhostChrome && (
            <div className="bg-brand text-white px-4 py-2 text-center text-sm font-medium transition-colors">
              You are currently in Ghost Mode. Your activity is completely untraceable.
            </div>
          )}

          {/* Top strip: brand + mobile menu + notifications */}
          <header className="flex h-16 items-center justify-between gap-4 border-b border-border px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
                aria-expanded={mobileNavOpen}
                className="md:hidden w-9 h-9 rounded-full border border-border bg-surface-raised/80 backdrop-blur-md flex items-center justify-center text-text-primary"
              >
                <Menu className="w-4 h-4" />
              </button>
              <Image src="/logo/mentamind.webp" alt="Mentamind Logo" width={24} height={24} className="object-contain" />
              <span className="text-base font-semibold text-text-primary">Mentamind</span>
              {showGhostChrome && (
                <span className="ml-2 inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                  Ghost Mode
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {!isTransitioningGhostMode && !showGhostChrome && <NotificationDropdown />}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
