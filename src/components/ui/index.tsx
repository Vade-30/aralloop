// Shared UI building blocks. Every screen uses these so the app looks like one
// product. None of them use hooks, so they work in server and client
// components alike.
//
// The look is "bold and playful": a deep blue header band, yellow main
// buttons, and chunky white cards with a raised edge (the shadow-edge tokens
// in globals.css).

import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import type React from "react";
import type { ComponentProps, ReactNode } from "react";
import type { AiProviderName } from "@/lib/types";

/** Joins class names, skipping falsy values. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// --- Button ------------------------------------------------------------------

/**
 * primary: yellow, the one main action on a screen.
 * brand: blue, a strong action that is not the main one.
 * secondary: white with an edge. ghost: text only. danger: red.
 */
type ButtonVariant = "primary" | "brand" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

// The button sits on a hard shadow; pressing it pushes it down onto the edge.
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold transition-[transform,box-shadow,background-color] duration-100 active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0";
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent-400 text-ink shadow-edge-accent hover:bg-accent-300",
  brand: "bg-brand-600 text-white shadow-edge-brand hover:bg-brand-500",
  secondary: "border-2 border-line bg-white text-ink shadow-edge-sm hover:bg-brand-50",
  ghost: "text-brand-700 hover:bg-brand-50 active:translate-y-0",
  danger: "bg-red-600 text-white shadow-edge-danger hover:bg-red-500",
};
// Every size keeps a touch target of at least 40px.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "min-h-10 px-3.5 text-sm",
  md: "min-h-11 px-5 text-[15px]",
  lg: "min-h-13 px-6 text-base",
};

function buttonClass(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

/** A link that looks like a button. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// --- Layout ------------------------------------------------------------------

/**
 * Page container: centred with side gutters on phones. "wide" suits
 * dashboards and lists; "narrow" suits forms and reading.
 */
export function Page({
  children,
  className,
  size = "wide",
}: {
  children: ReactNode;
  className?: string;
  size?: "wide" | "narrow";
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full flex-1 px-4 py-6 sm:px-6 sm:py-8",
        size === "narrow" ? "max-w-3xl" : "max-w-5xl",
        className,
      )}
    >
      {children}
    </main>
  );
}

/**
 * The blue band at the top of a page, continuing the app header. Put it first
 * inside <Page>. Its background is as wide as the window, whatever the page
 * width.
 *
 * With `overlap`, the band is taller and the next element is pulled up over
 * its bottom edge. That element must be a row of cards and must be positioned
 * (StatRow already is; otherwise add className="relative").
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  back,
  actions,
  overlap = false,
}: {
  title: string;
  description?: ReactNode;
  /** Small yellow line above the title, e.g. "Science · Join code SAMPA7". */
  eyebrow?: ReactNode;
  /** Optional "back" link shown above the title. */
  back?: { href: string; label: string };
  actions?: ReactNode;
  overlap?: boolean;
}) {
  return (
    <header
      className={cn(
        // Cancels the top padding of <Page> so the band touches the app header.
        "relative isolate -mt-6 pt-4 text-white sm:-mt-8 sm:pt-6",
        overlap ? "-mb-12 pb-20" : "mb-6 pb-7 sm:pb-9",
      )}
    >
      <div
        aria-hidden="true"
        className="absolute -top-px bottom-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden bg-brand-900"
      >
        <span className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-brand-600 sm:h-80 sm:w-80" />
        <span className="absolute -top-12 right-56 hidden h-24 w-24 rounded-full bg-accent-400 sm:block" />
      </div>
      {back && (
        <Link
          href={back.href}
          className="mb-1 inline-flex min-h-10 items-center gap-1.5 text-sm font-extrabold text-brand-100 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-2xl">
          {eyebrow && (
            <p className="text-xs font-black uppercase tracking-widest text-accent-400">{eyebrow}</p>
          )}
          <h1 className="text-3xl font-extrabold leading-tight sm:text-[2.5rem]">{title}</h1>
          {description && (
            <p className="mt-1 text-[15px] font-bold text-brand-100">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </header>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-3xl border-2 border-line bg-white p-4 shadow-edge sm:p-5", className)}
      {...props}
    />
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-xl font-extrabold text-ink sm:text-2xl", className)}>{children}</h2>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-brand-200 bg-white px-4 py-10 text-center">
      <p className="font-display text-lg font-extrabold text-ink">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm font-semibold text-muted">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

// --- Numbers and progress ----------------------------------------------------

/** Row of StatTiles. Positioned, so it can overlap a PageHeader with `overlap`. */
export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4", className)}>
      {children}
    </div>
  );
}

/** One big number with a label under it. "warning" marks something to act on. */
export function StatTile({
  value,
  label,
  hint,
  tone = "brand",
}: {
  value: ReactNode;
  label: string;
  hint?: ReactNode;
  tone?: "brand" | "warning" | "success";
}) {
  const colour = { brand: "text-brand-600", warning: "text-amber-600", success: "text-emerald-600" };
  return (
    <div className="rounded-3xl border-2 border-line bg-white px-3 py-4 text-center shadow-edge">
      <p className={cn("font-display text-3xl font-extrabold leading-none sm:text-4xl", colour[tone])}>
        {value}
      </p>
      <p className="mt-1 text-xs font-extrabold text-muted sm:text-[13px]">{label}</p>
      {hint && <p className="text-xs font-semibold text-muted">{hint}</p>}
    </div>
  );
}

/** Coloured square that holds an icon, at the start of a list card. */
export function IconTile({
  children,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  tone?: "brand" | "accent" | "soft" | "success";
  className?: string;
}) {
  const tones = {
    brand: "bg-brand-600 text-white",
    accent: "bg-accent-400 text-ink",
    soft: "bg-brand-50 text-brand-700",
    success: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-12 w-12 flex-none items-center justify-center rounded-2xl [&>svg]:h-6 [&>svg]:w-6",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Initials in a circle, e.g. for an account. */
export function Avatar({
  name,
  tone = "accent",
  className,
}: {
  name: string;
  tone?: "accent" | "brand" | "soft";
  className?: string;
}) {
  const words = name.replace(/^(Ms|Mr|Mrs|Dr)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  const initials = (words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "");
  const tones = {
    accent: "bg-accent-400 text-ink",
    brand: "bg-brand-600 text-white",
    soft: "bg-brand-100 text-brand-800",
  };
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-11 w-11 flex-none items-center justify-center rounded-full text-sm font-black uppercase",
        tones[tone],
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Horizontal bar: how much of something is done. `label` is read by screen readers. */
export function ProgressBar({
  value,
  max,
  label,
  tone = "brand",
  className,
}: {
  value: number;
  max: number;
  label: string;
  tone?: "brand" | "accent" | "warning";
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = { brand: "bg-brand-600", accent: "bg-accent-400", warning: "bg-amber-500" };
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("h-2.5 overflow-hidden rounded-full bg-brand-100", className)}
    >
      <div className={cn("h-full rounded-full", fill[tone])} style={{ width: `${percent}%` }} />
    </div>
  );
}

// --- Status ------------------------------------------------------------------

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const BADGE_TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  brand: "bg-brand-100 text-brand-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-accent-100 text-amber-900",
  danger: "bg-red-100 text-red-800",
  info: "bg-brand-50 text-brand-800",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-extrabold",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const ALERT_TONES: Record<Exclude<Tone, "neutral" | "brand">, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-accent-200 bg-accent-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-900",
  info: "border-brand-200 bg-brand-50 text-brand-900",
};

/** Inline message. Use tone "danger" for errors; it is announced to screen readers. */
export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Exclude<Tone, "neutral" | "brand">;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "rounded-2xl border-2 px-4 py-3 text-sm font-semibold",
        ALERT_TONES[tone],
        className,
      )}
    >
      {title && <p className="font-extrabold">{title}</p>}
      {children && <div className={title ? "mt-1" : undefined}>{children}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className ?? "h-5 w-5")}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Says plainly that something on screen came from AI, and which service wrote
 * it. In offline sample mode it says that instead, so sample output is never
 * passed off as real AI.
 */
export function AiLabel({
  provider,
  children = "AI-generated",
}: {
  provider: AiProviderName;
  /** e.g. "AI-generated · reviewed by teacher", "Graded by AI". */
  children?: ReactNode;
}) {
  if (provider === "mock") {
    return <Badge tone="warning">Sample mode · not real AI</Badge>;
  }
  return (
    <Badge tone="brand">
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </Badge>
  );
}

// --- Form fields -------------------------------------------------------------

const INPUT_CLASS =
  "block w-full rounded-xl border-2 border-line bg-white px-3.5 py-2.5 text-base font-semibold text-ink placeholder:font-medium placeholder:text-slate-500 focus:border-brand-600 focus:outline-none disabled:bg-slate-100";

/** Label, optional hint and optional error wrapped around one form control. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-extrabold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs font-semibold text-muted">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-xs font-extrabold text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(INPUT_CLASS, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(INPUT_CLASS, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(INPUT_CLASS, className)} {...props} />;
}

/**
 * A score as a ring that fills up, with the score in the middle. Use it where
 * the score is the main thing on screen; use Score for lists.
 */
export function ScoreRing({
  score,
  max,
  size = 112,
  className,
}: {
  score: number;
  max: number;
  /** Width and height in pixels. */
  size?: number;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, score / max)) : 0;
  const stroke = ratio >= 0.75 ? "#059669" : ratio >= 0.5 ? "#d97706" : "#dc2626";
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      role="img"
      aria-label={`Score: ${formatScore(score)} out of ${formatScore(max)}`}
      className={cn("relative flex-none", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#dbe7fe" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="animate-ring"
          style={{ "--ring-length": circumference } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-display text-2xl font-extrabold text-ink">{formatScore(score)}</span>
        <span className="mt-0.5 text-xs font-extrabold text-muted">of {formatScore(max)}</span>
      </div>
    </div>
  );
}

/** "8 / 10" with a colour that follows the percentage. */
export function Score({ score, max }: { score: number; max: number }) {
  const ratio = max > 0 ? score / max : 0;
  const tone: Tone = ratio >= 0.75 ? "success" : ratio >= 0.5 ? "warning" : "danger";
  return (
    <Badge tone={tone} className="px-3 text-sm">
      {formatScore(score)} / {formatScore(max)}
    </Badge>
  );
}

/** 7 -> "7", 7.5 -> "7.5". */
export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
