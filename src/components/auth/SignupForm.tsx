"use client";

// The sign-up form. The visitor first says who they are; the fields under the
// password change with that choice: a teacher names a new class, a student
// types the class's join code, and a parent adds their child's email.

import {
  ArrowRight,
  Backpack,
  Check,
  Circle,
  GraduationCap,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input, cn } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import {
  AUTH_LIMITS,
  PASSWORD_RULES,
  type SessionResponse,
  type SignupRequest,
} from "@/lib/contracts";
import type { Role } from "@/lib/types";
import { PasswordInput } from "./PasswordInput";

// The same icons and colours as the columns of sample accounts.
const ROLES: { role: Role; label: string; caption: string; icon: LucideIcon; tile: string }[] = [
  {
    role: "teacher",
    label: "Teacher",
    caption: "Start a class",
    icon: GraduationCap,
    tile: "bg-brand-600 text-white",
  },
  {
    role: "student",
    label: "Student",
    caption: "Join your class",
    icon: Backpack,
    tile: "bg-accent-400 text-ink",
  },
  {
    role: "parent",
    label: "Parent",
    caption: "Follow your child",
    icon: HeartHandshake,
    tile: "bg-brand-900 text-accent-400",
  },
];

export function SignupForm({ homePaths }: { homePaths: Record<Role, string> }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>("teacher");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [childEmail, setChildEmail] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordOk = PASSWORD_RULES.every((rule) => rule.test(password));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (working) return;
    if (!passwordOk) {
      setError("The password needs at least 8 characters and at least one number.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const account = { name, email, password };
      const body: SignupRequest =
        role === "teacher"
          ? { role, ...account, className, gradeLevel, subject }
          : role === "student"
            ? { role, ...account, joinCode }
            : { role, ...account, joinCode, childEmail };
      const { user } = await api<SessionResponse>("/api/auth/signup", { method: "POST", body });
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
      <form onSubmit={submit} className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-extrabold text-ink">I am a</legend>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {ROLES.map((option) => {
              const Icon = option.icon;
              const chosen = option.role === role;
              return (
                <label
                  key={option.role}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1.5 rounded-3xl border-2 bg-white px-2 py-3 text-center transition-[translate,box-shadow,border-color] duration-150 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-200",
                    chosen
                      ? "border-brand-600 shadow-edge-brand"
                      : "border-line shadow-edge hover:-translate-y-0.5 hover:border-brand-300",
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.role}
                    checked={chosen}
                    onChange={() => setRole(option.role)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full",
                      option.tile,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-lg font-extrabold leading-tight text-ink">
                    {option.label}
                  </span>
                  <span className="text-xs font-bold leading-snug text-muted">{option.caption}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Field label="Your name" htmlFor="signup-name">
          <Input
            id="signup-name"
            autoComplete="name"
            required
            maxLength={AUTH_LIMITS.nameMax}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field
          label="Email"
          htmlFor="signup-email"
          hint="You log in with this. We do not send anything to it."
        >
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            maxLength={AUTH_LIMITS.emailMax}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="signup-password">
          <PasswordInput
            id="signup-password"
            autoComplete="new-password"
            required
            maxLength={AUTH_LIMITS.passwordMax}
            aria-describedby="signup-password-rules"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <ul id="signup-password-rules" className="mt-2 space-y-1">
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <li
                  key={rule.label}
                  className={cn(
                    "flex items-center gap-2 text-[13px] font-bold",
                    met ? "text-emerald-700" : "text-muted",
                  )}
                >
                  {met ? (
                    <Check className="h-4 w-4 flex-none" strokeWidth={3.5} aria-hidden="true" />
                  ) : (
                    <Circle className="h-4 w-4 flex-none" strokeWidth={2.5} aria-hidden="true" />
                  )}
                  {rule.label}
                  <span className="sr-only">{met ? "(done)" : "(not yet)"}</span>
                </li>
              );
            })}
          </ul>
        </Field>

        <div className="space-y-4 rounded-3xl border-2 border-dashed border-brand-200 bg-brand-50 p-4">
          {role === "teacher" ? (
            <>
              <Field
                label="Class name"
                htmlFor="signup-class"
                hint="You get a join code for your students after you sign up."
              >
                <Input
                  id="signup-class"
                  required
                  placeholder="Grade 7 - Sampaguita"
                  maxLength={AUTH_LIMITS.classNameMax}
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Grade level" htmlFor="signup-grade">
                  <Input
                    id="signup-grade"
                    required
                    placeholder="Grade 7"
                    maxLength={AUTH_LIMITS.classNameMax}
                    value={gradeLevel}
                    onChange={(event) => setGradeLevel(event.target.value)}
                  />
                </Field>
                <Field label="Subject" htmlFor="signup-subject">
                  <Input
                    id="signup-subject"
                    required
                    placeholder="Science"
                    maxLength={AUTH_LIMITS.classNameMax}
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                  />
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field
                label="Class join code"
                htmlFor="signup-code"
                hint="The teacher has this code. It is on the teacher's dashboard."
              >
                <Input
                  id="signup-code"
                  required
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="font-display text-xl uppercase tracking-widest"
                  maxLength={20}
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                />
              </Field>
              {role === "parent" && (
                <Field
                  label="Your child's email"
                  htmlFor="signup-child"
                  hint="The email your child signed up with. Your child signs up first."
                >
                  <Input
                    id="signup-child"
                    type="email"
                    required
                    maxLength={AUTH_LIMITS.emailMax}
                    value={childEmail}
                    onChange={(event) => setChildEmail(event.target.value)}
                  />
                </Field>
              )}
            </>
          )}
        </div>

        {error && (
          <Alert tone="danger" className="animate-pop">
            {error}
          </Alert>
        )}
        <Button type="submit" size="lg" loading={working} className="w-full">
          Create account
          <ArrowRight className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
        </Button>
      </form>
      <p className="mt-5 border-t-2 border-dashed border-brand-100 pt-4 text-sm font-bold text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-extrabold text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}
