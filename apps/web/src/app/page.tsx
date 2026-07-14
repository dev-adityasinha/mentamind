"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.onboarding_completed_at) {
      router.replace("/onboarding");
      return;
    }
    router.replace("/home");
  }, [user, isLoading, router]);

  return null;
}
