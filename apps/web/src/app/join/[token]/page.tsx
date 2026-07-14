"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { acceptInviteApi, previewInviteApi } from "@/lib/api/auth";
import { setAccessToken } from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";

interface FormErrors {
  display_name?: string;
  password?: string;
  confirm_password?: string;
  form?: string;
}

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [orgName, setOrgName] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const firstErrorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      setPreviewError("Invalid invite link.");
      setPreviewLoading(false);
      return;
    }
    void previewInviteApi(token)
      .then((data) => setOrgName(data.org_name))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setPreviewError("This invite link is invalid or has expired.");
        } else {
          setPreviewError("Could not load invite. Please try again.");
        }
      })
      .finally(() => setPreviewLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const display_name = (fd.get("display_name") as string).trim();
    const password = fd.get("password") as string;
    const confirm_password = fd.get("confirm_password") as string;

    const nextErrors: FormErrors = {};
    if (!display_name) nextErrors.display_name = "Your name is required";
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
      const { access_token } = await acceptInviteApi({
        token,
        password,
        display_name,
      });
      setAccessToken(access_token);
      router.replace("/onboarding");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setErrors({ form: "This invite has already been used or has expired." });
        } else if (err.status === 429) {
          setErrors({ form: "Too many attempts. Please wait and try again." });
        } else {
          setErrors({ form: "Something went wrong. Please try again." });
        }
      } else {
        setErrors({ form: "Something went wrong. Please try again." });
      }
      firstErrorRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  }

  if (previewLoading) return null;

  if (previewError) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg px-4">
        <Card className="w-full max-w-sm">
          <div className="p-8 text-center">
            <h1 className="text-xl font-semibold text-text-primary mb-2">
              Invite not found
            </h1>
            <p className="text-sm text-text-secondary">{previewError}</p>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg px-4 py-12">
      <Card className="w-full max-w-sm">
        <div className="p-8">
          <h1 className="text-2xl font-semibold text-text-primary">
            Join {orgName}
          </h1>
          <p className="mt-1 text-sm text-text-secondary mb-6">
            Create your account to accept this invitation.
          </p>

          <form onSubmit={handleSubmit} noValidate aria-label="Accept invitation form">
            {errors.form && (
              <div
                role="alert"
                className="mb-4 rounded-md border border-destructive bg-destructive-subtle px-3 py-2 text-sm text-destructive"
              >
                {errors.form}
              </div>
            )}

            <FormField
              id="display_name"
              label="Your name"
              error={errors.display_name}
              required
            >
              <Input
                ref={firstErrorRef}
                name="display_name"
                type="text"
                autoComplete="name"
                disabled={isLoading}
                placeholder="Jane Smith"
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
              Create account
            </Button>
          </form>
        </div>
      </Card>
    </main>
  );
}
