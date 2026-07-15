"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { apiFetch, ApiError } from "@/lib/api/client";

interface FormErrors {
  email?: string;
  form?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string).trim();

    const nextErrors: FormErrors = {};
    if (!email) {
      nextErrors.email = "Email is required";
    } else if (!EMAIL_RE.test(email)) {
      nextErrors.email = "Enter a valid email address";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      emailRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const res = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        skipAuth: true,
      });
      if (!res.ok && res.status !== 200) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setErrors({ form: "Too many attempts. Please wait before trying again." });
        } else {
          setErrors({ form: (body as { detail?: string }).detail || "Something went wrong. Please try again." });
        }
        return;
      }
      setSent(true);
    } catch {
      setErrors({ form: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }

  if (sent) {
    return (
      <>
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">Check your inbox</h1>
        </div>
        <p className="text-sm text-text-secondary text-center mb-6">
          If an account with that email exists, we&apos;ve sent a password reset link. It expires in 30 minutes.
        </p>
        <p className="text-center text-sm text-text-secondary">
          <Link href="/login" className="text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm">
            Back to sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-text-primary">Reset your password</h1>
      <p className="mt-1 text-sm text-text-secondary mb-6">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} noValidate aria-label="Forgot password form">
        {errors.form && (
          <div role="alert" className="mb-4 rounded-md border border-destructive bg-destructive-subtle px-3 py-2 text-sm text-destructive">
            {errors.form}
          </div>
        )}
        <FormField id="email" label="Email" error={errors.email} required>
          <Input
            ref={emailRef}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            disabled={isLoading}
            placeholder="you@example.com"
          />
        </FormField>
        <Button type="submit" className="w-full mt-6" isLoading={isLoading} disabled={isLoading}>
          Send reset link
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-text-secondary">
        <Link href="/login" className="text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
