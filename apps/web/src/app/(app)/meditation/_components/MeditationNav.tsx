"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Internal navigation for the Meditation module. The Meditation tab in the
// app sidebar opens this section; these links switch between its sub-pages.
const MEDITATION_TABS: { href: string; label: string }[] = [
  { href: "/meditation", label: "Home" },
  { href: "/meditation/journey", label: "Journey" },
  { href: "/meditation/dashboard", label: "Dashboard" },
  { href: "/meditation/journal", label: "Journal" },
  { href: "/meditation/checkin", label: "Check-in" },
  { href: "/meditation/task", label: "Task" },
  { href: "/meditation/library", label: "Library" },
];

export function MeditationNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/meditation"
      ? pathname === "/meditation"
      : !!pathname?.startsWith(href);

  return (
    <nav
      aria-label="Meditation navigation"
      className="mb-6 flex flex-wrap items-center gap-1 rounded-full border border-border bg-surface-raised/60 p-1"
    >
      {MEDITATION_TABS.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              active
                ? "bg-brand text-brand-foreground font-medium"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
