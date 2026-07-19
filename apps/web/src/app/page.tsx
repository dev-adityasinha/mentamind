"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { LandingPage } from "@/components/marketing/LandingPage";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user) return;
    if (!user.onboarding_completed_at) {
      router.replace("/onboarding");
      return;
    }
    router.replace("/home");
  }, [user, isLoading, router]);

  if (isLoading || user) return null;

  return <LandingPage />;
}
