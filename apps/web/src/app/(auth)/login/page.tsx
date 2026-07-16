"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useAuth } from "@/lib/auth/context";
import { ApiError } from "@/lib/api/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormErrors {
  email?: string;
  password?: string;
  form?: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string).trim();
    const password = fd.get("password") as string;

    const nextErrors: FormErrors = {};
    if (!email) {
      nextErrors.email = "Email is required";
    } else if (!EMAIL_RE.test(email)) {
      nextErrors.email = "Enter a valid email address";
    }
    if (!password) nextErrors.password = "Password is required";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      if (nextErrors.email) emailRef.current?.focus();
      else if (nextErrors.password) passwordRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      await login(email, password);
      router.replace("/onboarding");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setErrors({ form: "Too many attempts. Please wait a moment and try again." });
        } else {
          setErrors({ form: err.message });
        }
      } else {
        setErrors({ form: "An unexpected error occurred during login." });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-text-primary">
        Welcome back
      </h1>
      <p className="mt-1 text-sm text-text-secondary mb-6">
        Sign in to your account
      </p>

      <form onSubmit={handleSubmit} noValidate aria-label="Sign in form">
        {errors.form && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive bg-destructive-subtle px-3 py-2 text-sm text-destructive"
          >
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

        <FormField
          id="password"
          label="Password"
          error={errors.password}
          required
          className="mt-4"
        >
          <PasswordInput
            ref={passwordRef}
            name="password"
            autoComplete="current-password"
            disabled={isLoading}
          />
        </FormField>

        <Button
          type="submit"
          className="w-full mt-6"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Sign in
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-text-secondary">
        No account?{" "}
        <Link
          href="/register"
          className="text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm"
        >
          Create one
        </Link>
      </p>
    </>
  );
}
