"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { AuthContainer } from "./AuthContainer";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user) return;
    router.replace(user.onboarding_completed_at ? "/home" : "/onboarding");
  }, [user, isLoading, router]);

  if (!isLoading && user) return null;

  return <AuthContainer>{children}</AuthContainer>;
}
