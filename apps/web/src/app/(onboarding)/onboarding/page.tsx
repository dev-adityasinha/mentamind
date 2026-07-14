"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth/context";
import { ApiError } from "@/lib/api/client";
import { completeOnboarding } from "@/lib/api/onboarding";

interface ConsentState {
  analytics: boolean;
  ai_coaching: boolean;
}

export default function OnboardingPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [consent, setConsent] = useState<ConsentState>({
    analytics: false,
    ai_coaching: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.onboarding_completed_at) {
      router.replace("/home");
    }
  }, [user, isLoading, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await completeOnboarding({
        consent_analytics: consent.analytics,
        consent_ai_coaching: consent.ai_coaching,
      });
      await refreshUser();
      router.replace("/home");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await refreshUser();
        router.replace("/home");
      } else {
        addToast("Something went wrong. Please try again.", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || !user) return null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <Card className="w-full max-w-lg">
        <div className="p-8">
          <h1 className="text-2xl font-semibold text-text-primary">
            Welcome to Mentamind
          </h1>
          <p className="mt-2 text-sm text-text-secondary mb-8">
            Before you start, we need your permission to use certain features.
            You can change these at any time from your account settings.
          </p>

          <form onSubmit={handleSubmit} aria-label="Onboarding consent form">
            <fieldset>
              <legend className="text-base font-medium text-text-primary mb-4">
                Your privacy choices
              </legend>

              <ConsentOption
                id="consent_analytics"
                checked={consent.analytics}
                onChange={(v) => setConsent((s) => ({ ...s, analytics: v }))}
                title="Usage analytics"
                description="Help us understand how you use the platform so we can improve it. This data is aggregated and never linked to individual wellness records."
              />

              <ConsentOption
                id="consent_ai_coaching"
                checked={consent.ai_coaching}
                onChange={(v) =>
                  setConsent((s) => ({ ...s, ai_coaching: v }))
                }
                title="AI coaching suggestions"
                description="Receive personalised wellbeing suggestions powered by AI. Your data is processed confidentially and is not shared with your employer."
                className="mt-4"
              />
            </fieldset>

            <p className="mt-6 text-xs text-text-muted">
              Both choices default to off. Nothing is pre-selected on your
              behalf. You can withdraw consent at any time.
            </p>

            <Button
              type="submit"
              className="w-full mt-6"
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              Continue to Mentamind
            </Button>
          </form>
        </div>
      </Card>
    </main>
  );
}

interface ConsentOptionProps {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
  className?: string;
}

function ConsentOption({
  id,
  checked,
  onChange,
  title,
  description,
  className = "",
}: ConsentOptionProps) {
  return (
    <div
      className={[
        "flex items-start gap-4 rounded-lg border p-4",
        checked
          ? "border-brand bg-brand-subtle"
          : "border-border bg-surface",
        className,
      ].join(" ")}
    >
      <div className="flex h-5 items-center pt-0.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-border text-brand focus-visible:ring-2 focus-visible:ring-focus"
          aria-describedby={`${id}-description`}
        />
      </div>
      <div className="flex-1">
        <label
          htmlFor={id}
          className="text-sm font-medium text-text-primary cursor-pointer"
        >
          {title}
        </label>
        <p
          id={`${id}-description`}
          className="mt-0.5 text-xs text-text-secondary"
        >
          {description}
        </p>
      </div>
      <span
        aria-hidden="true"
        className={[
          "mt-0.5 text-xs font-medium",
          checked ? "text-brand" : "text-text-muted",
        ].join(" ")}
      >
        {checked ? "On" : "Off"}
      </span>
    </div>
  );
}
