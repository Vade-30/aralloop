"use client";

// The log-in form: an email and a password.

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import type { LoginRequest, SessionResponse } from "@/lib/contracts";
import type { Role } from "@/lib/types";
import { PasswordInput } from "./PasswordInput";

export function LoginForm({ homePaths }: { homePaths: Record<Role, string> }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      const body: LoginRequest = { email, password };
      const { user } = await api<SessionResponse>("/api/auth/login", { method: "POST", body });
      // Stay in the loading state while the next screen loads.
      router.push(homePaths[user.role]);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setWorking(false);
    }
  }

  return (
    <Card className="animate-rise">
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <Alert tone="danger" className="animate-pop">
            {error}
          </Alert>
        )}
        <Field label="Email" htmlFor="login-email">
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" loading={working} className="w-full">
          Log in
          <ArrowRight className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
        </Button>
      </form>
      <p className="mt-5 border-t-2 border-dashed border-brand-100 pt-4 text-sm font-bold text-muted">
        No account yet?{" "}
        <Link href="/signup" className="font-extrabold text-brand-700 hover:underline">
          Sign up
        </Link>{" "}
        or{" "}
        <Link href="/" className="font-extrabold text-brand-700 hover:underline">
          try a sample account
        </Link>
        .
      </p>
    </Card>
  );
}
