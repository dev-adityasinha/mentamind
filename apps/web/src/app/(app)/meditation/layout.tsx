"use client";

// Section layout for the Meditation module. Navigation for this section lives
// in the app sidebar (the expandable "Meditation" item), so the layout just
// renders the active page.
export default function MeditationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
