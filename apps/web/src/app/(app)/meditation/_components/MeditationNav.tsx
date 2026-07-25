"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

// Internal navigation for the Meditation module, rendered as a dropdown. The
// Meditation tab in the app sidebar opens this section; this menu switches
// between its sub-pages.
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    href === "/meditation"
      ? pathname === "/meditation"
      : !!pathname?.startsWith(href);

  // The most specific matching tab is the current one (so /meditation/journey
  // wins over /meditation). Fall back to Home.
  const current =
    [...MEDITATION_TABS]
      .filter((t) => isActive(t.href))
      .sort((a, b) => b.href.length - a.href.length)[0] ?? MEDITATION_TABS[0];

  // Close on click outside and on Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close the menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div ref={ref} className="relative mb-6 inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-w-[180px] items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span>{current.label}</span>
        <ChevronDown
          className={`h-4 w-4 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        >
          {MEDITATION_TABS.map((tab) => {
            const active = current.href === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="menuitem"
                aria-current={active ? "page" : undefined}
                className={`block px-4 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:bg-surface-raised ${
                  active
                    ? "bg-brand-subtle font-medium text-brand"
                    : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
