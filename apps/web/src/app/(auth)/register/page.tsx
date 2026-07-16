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
import type { DataResidencyRegion } from "@/lib/auth/types";

interface FormErrors {
  org_name?: string;
  display_name?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
  form?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REGIONS: { value: DataResidencyRegion; label: string }[] = [
  { value: "in", label: "India (IN)" },
  { value: "eu", label: "European Union (EU)" },
  { value: "us", label: "United States (US)" },
  { value: "uae", label: "UAE" },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const firstErrorRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const org_name = (fd.get("org_name") as string).trim();
    const display_name = (fd.get("display_name") as string).trim();
    const email = (fd.get("email") as string).trim();
    const password = fd.get("password") as string;
    const confirm_password = fd.get("confirm_password") as string;
    const data_residency_region = fd.get("data_residency_region") as DataResidencyRegion;

    const nextErrors: FormErrors = {};
    if (!org_name) {
      nextErrors.org_name = "Organization name is required";
    } else if (org_name.length < 2) {
      nextErrors.org_name = "Organization name must be at least 2 characters";
    }
    if (!display_name) nextErrors.display_name = "Display name is required";
    if (!email) {
      nextErrors.email = "Email is required";
    } else if (!EMAIL_RE.test(email)) {
      nextErrors.email = "Enter a valid email address";
    }
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
      firstErrorRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      await register({ org_name, display_name, email, password, data_residency_region });
      router.replace("/onboarding");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setErrors({ form: "Too many sign-up attempts. Please wait and try again." });
        } else {
          setErrors({ form: err.message });
        }
      } else {
        setErrors({ form: "Something went wrong. Please try again." });
      }
      firstErrorRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-text-primary">
        Create your workspace
      </h1>
      <p className="mt-1 text-sm text-text-secondary mb-6">
        Set up your organization and become its admin. You can invite colleagues after signing up.
      </p>

      <form onSubmit={handleSubmit} noValidate aria-label="Create workspace form">
        {errors.form && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive bg-destructive-subtle px-3 py-2 text-sm text-destructive"
          >
            {errors.form}
          </div>
        )}

        <FormField
          id="org_name"
          label="Organization name"
          error={errors.org_name}
          required
        >
          <Input
            ref={firstErrorRef}
            name="org_name"
            type="text"
            autoComplete="organization"
            disabled={isLoading}
            placeholder="Acme Inc."
          />
        </FormField>

        <FormField
          id="data_residency_region"
          label="Data region"
          required
          className="mt-4"
        >
          <select
            id="data_residency_region"
            name="data_residency_region"
            defaultValue="in"
            disabled={isLoading}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          id="display_name"
          label="Your name"
          error={errors.display_name}
          required
          className="mt-4"
        >
          <Input
            name="display_name"
            type="text"
            autoComplete="name"
            disabled={isLoading}
            placeholder="Jane Smith"
          />
        </FormField>

        <FormField
          id="email"
          label="Work email"
          error={errors.email}
          required
          className="mt-4"
        >
          <Input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            disabled={isLoading}
            placeholder="jane@company.com"
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
            name="password"
            autoComplete="new-password"
            disabled={isLoading}
          />
        </FormField>

        <FormField
          id="confirm_password"
          label="Confirm password"
          error={errors.confirm_password}
          required
          className="mt-4"
        >
          <PasswordInput
            name="confirm_password"
            autoComplete="new-password"
            disabled={isLoading}
          />
        </FormField>

        <Button
          type="submit"
          className="w-full mt-6"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Create workspace
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-sm"
        >
          Sign in
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-text-secondary">
        Joining via an invite?{" "}
        <span className="text-text-secondary">Check your email for a link.</span>
      </p>
    </>
  );
}
