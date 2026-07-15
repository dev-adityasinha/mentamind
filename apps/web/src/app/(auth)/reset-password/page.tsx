"use client";

import Link from "next/link";
import { useRef, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { apiFetch } from "@/lib/api/client";

interface FormErrors {
  password?: string;
  confirm_password?: string;
  form?: string;
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      setErrors({ form: "Invalid or missing reset token. Please request a new link." });
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const password = fd.get("password") as string;
    const confirm_password = fd.get("confirm_password") as string;

    const nextErrors: FormErrors = {};
    if (!password) {
      nextErrors.password = "Password is required";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters";
    }
    if (password && confirm_password !== password) {
      nextErrors.confirm_password = "Passwords do not match";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      passwordRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const res = await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, new_password: password }),
        skipAuth: true,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 400 || res.status === 422) {
          setErrors({ form: "Reset link is invalid or has expired. Please request a new one." });
        } else if (res.status === 429) {
          setErrors({ form: "Too many attempts. Please wait before trying again." });
        } else {
          setErrors({ form: (body as { detail?: string }).detail || "Something went wrong. Please try again." });
        }
        return;
      }
      setDone(true);
    } catch {
      setErrors({ form: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }

  if (done) {
    return (
      <>
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">Password updated!</h1>
        </div>
        <p className="text-sm text-text-secondary text-center mb-6">
          Your password has been changed successfully. You can now sign in with your new password.
        </p>
        <Link
          href="/login"
          className="block w-full text-center rounded-lg bg-brand py-2.5 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
        >
          Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-text-primary">Set new password</h1>
      <p className="mt-1 text-sm text-text-secondary mb-6">
        Choose a strong password for your account.
      </p>

      <form onSubmit={handleSubmit} noValidate aria-label="Reset password form">
        {errors.form && (
          <div role="alert" className="mb-4 rounded-md border border-destructive bg-destructive-subtle px-3 py-2 text-sm text-destructive">
            {errors.form}
          </div>
        )}
        <FormField id="password" label="New password" error={errors.password} required>
          <PasswordInput
            ref={passwordRef}
            name="password"
            autoComplete="new-password"
            disabled={isLoading || !token}
          />
        </FormField>
        <FormField id="confirm_password" label="Confirm password" error={errors.confirm_password} required className="mt-4">
          <PasswordInput
            name="confirm_password"
            autoComplete="new-password"
            disabled={isLoading || !token}
          />
        </FormField>
        <Button type="submit" className="w-full mt-6" isLoading={isLoading} disabled={isLoading || !token}>
          Update password
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-text-secondary">
        <Link href="/forgot-password" className="text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm">
          Request a new link
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
