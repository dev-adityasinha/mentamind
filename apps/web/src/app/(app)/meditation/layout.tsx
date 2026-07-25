"use client";

import { MeditationNav } from "./_components/MeditationNav";

// Section layout for the Meditation module. Renders the internal sub-nav once,
// above every meditation page, so individual pages don't each import it.
export default function MeditationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <MeditationNav />
      {children}
    </div>
  );
}
