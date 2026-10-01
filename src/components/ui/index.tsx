// Shared UI building blocks. Every screen uses these so the app looks like one
// product. None of them use hooks, so they work in server and client
// components alike.
//
// The look is "bold and playful": a deep blue header band, yellow main
// buttons, and chunky white cards with a raised edge (the shadow-edge tokens
// in globals.css).

import { ArrowLeft, Check, Eye, Hourglass, Sparkles, X } from "lucide-react";
import Link from "next/link";
import type React from "react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import type { AiProviderName } from "@/lib/types";

/** Joins class names, skipping falsy values. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Hover for a card that is a link or holds one stretched over it: the card
 * lifts a little and its border turns blue. Tailwind 4 moves an element with
 * the "translate" property, so that is what the transition names.
 */
export const CARD_LIFT =
  "transition-[translate,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-brand-300";

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
  "inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold transition-[translate,box-shadow,background-color] duration-100 active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0";
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

/** Width of a "wide" page. The app header and the footer line up with it. */
export const PAGE_WIDTH = "max-w-6xl";

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
        size === "narrow" ? "max-w-3xl" : PAGE_WIDTH,
        className,
      )}
    >
      {children}
    </main>
  );
}

// The band's shape, shared by PageHeader and its loading stand-in.
const BAND_BASE = "relative isolate -mt-6 pt-4 text-white sm:-mt-8 sm:pt-6";
const BAND_PLAIN = "mb-6 pb-7 sm:pb-9";
const BAND_OVERLAP = "-mb-12 pb-20";

/** The band's blue background, as wide as the window, with its two circles. */
function BandBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="absolute -top-px bottom-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden bg-brand-900"
    >
      {/* A shade darker on a phone, where the title's small yellow line runs over it. */}
      <span className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-brand-700 sm:h-80 sm:w-80 sm:bg-brand-600" />
      <span className="absolute -top-12 right-56 hidden h-24 w-24 rounded-full bg-accent-400 sm:block" />
    </div>
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
    // The negative top margin cancels the top padding of <Page>, so the band
    // touches the app header.
    <header className={cn(BAND_BASE, overlap ? BAND_OVERLAP : BAND_PLAIN)}>
      <BandBackdrop />
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
          <h1 className="break-words text-3xl font-extrabold leading-tight sm:text-[2.5rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-[15px] font-bold text-brand-100">{description}</p>
          )}
        </div>
        {/* On a phone the actions take a row of their own, so one that asks
            for the full width (w-full) gets it. */}
        {actions && <div className="flex flex-wrap gap-3 max-sm:w-full">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * The band while a page loads: the same shape as PageHeader, with pale blocks
 * where the title will be. It says only that the page is loading.
 */
export function PageHeaderSkeleton({ overlap = false }: { overlap?: boolean }) {
  return (
    <header className={cn(BAND_BASE, overlap ? BAND_OVERLAP : BAND_PLAIN)}>
      <BandBackdrop />
      <div
        role="status"
        className="inline-flex min-h-8 items-center gap-2 rounded-full bg-white/15 px-3 text-sm font-extrabold text-white"
      >
        <Spinner className="h-4 w-4 text-accent-400" />
        Loading
      </div>
      <div aria-hidden="true" className="mt-3 animate-pulse space-y-3">
        <div className="h-9 w-3/4 max-w-md rounded-xl bg-white/25 sm:h-11" />
        <div className="h-4 w-1/2 max-w-xs rounded-lg bg-white/15" />
      </div>
    </header>
  );
}

/**
 * A pale blue block that stands in for content while it loads. Give it a
 * size, and a "rounded-" class if the default corners do not fit.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-sheen bg-[linear-gradient(100deg,var(--color-brand-100)_35%,var(--color-brand-50)_50%,var(--color-brand-100)_65%)] bg-[length:200%_100%]",
        // cn does not resolve conflicting classes, so the default steps aside.
        !className?.includes("rounded-") && "rounded-xl",
        className,
      )}
    />
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

/**
 * What a list shows when it has nothing in it. `art` is a small drawing shown
 * above the words; it is decoration, so the words must say everything.
 */
export function EmptyState({
  title,
  description,
  action,
  art,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  art?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-rise rounded-3xl border-2 border-dashed border-brand-200 bg-white px-5 py-9 text-center",
        className,
      )}
    >
      {art && <div className="mb-3 flex justify-center">{art}</div>}
      <p className="font-display text-lg font-extrabold text-ink sm:text-xl">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm font-semibold text-muted">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

// --- Numbers and progress ----------------------------------------------------

/**
 * Row of StatTiles. Positioned, so it can overlap a PageHeader with `overlap`.
 * The tiles rise in one after another.
 */
export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4",
        "[&>*]:animate-rise [&>*:nth-child(2)]:[animation-delay:70ms] [&>*:nth-child(3)]:[animation-delay:140ms] [&>*:nth-child(4)]:[animation-delay:210ms]",
        className,
      )}
    >
      {children}
    </div>
  );
}

const STAT_TONES = {
  brand: { value: "text-brand-600", icon: "bg-brand-50 text-brand-700" },
  warning: { value: "text-amber-600", icon: "bg-accent-100 text-amber-800" },
  success: { value: "text-emerald-600", icon: "bg-emerald-100 text-emerald-700" },
};

/**
 * One big number with a label under it. "warning" marks something to act on.
 * With an `icon`, a laptop shows it on a coloured tile beside the number; a
 * phone has no room for it and keeps the number centred.
 */
export function StatTile({
  value,
  label,
  hint,
  tone = "brand",
  icon,
}: {
  value: ReactNode;
  label: string;
  hint?: ReactNode;
  tone?: keyof typeof STAT_TONES;
  /** One lucide icon. Decoration: the label says what the number is. */
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3.5 rounded-3xl border-2 border-line bg-white px-3 py-4 text-center shadow-edge",
        icon !== undefined && "lg:justify-start lg:px-4 lg:text-left",
      )}
    >
      {icon !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            "hidden h-12 w-12 flex-none items-center justify-center rounded-2xl lg:flex [&>svg]:h-6 [&>svg]:w-6",
            STAT_TONES[tone].icon,
          )}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p
          className={cn(
            "font-display text-3xl font-extrabold leading-none sm:text-4xl",
            STAT_TONES[tone].value,
          )}
        >
          {value}
        </p>
        <p className="mt-1 text-xs font-extrabold text-muted sm:text-[13px]">{label}</p>
        {hint && <p className="break-words text-xs font-semibold text-muted">{hint}</p>}
      </div>
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
  onBand = false,
  className,
}: {
  value: number;
  max: number;
  label: string;
  tone?: "brand" | "accent" | "warning" | "success";
  /** On the blue band: a see-through track, and a thicker bar. Pair it with tone "accent". */
  onBand?: boolean;
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = {
    brand: "bg-brand-600",
    accent: "bg-accent-400",
    warning: "bg-amber-500",
    success: "bg-emerald-500",
  };
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn(
        "overflow-hidden rounded-full",
        onBand ? "h-3 bg-white/25" : "h-2.5 bg-brand-100",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", fill[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// --- How an answer turned out --------------------------------------------------

/**
 * full, partial and none follow the score. "pending" is an answer nobody has
 * graded yet; "review" is the teacher's own word for an answer waiting for
 * them. Every screen draws these with the same icon and colour.
 */
export type OutcomeKind = "full" | "partial" | "none" | "pending" | "review";

const OUTCOME_TILES: Record<OutcomeKind, string> = {
  full: "bg-emerald-100 text-emerald-700",
  partial: "bg-amber-100 text-amber-800",
  none: "bg-red-100 text-red-700",
  pending: "bg-slate-100 text-slate-600",
  review: "bg-accent-400 text-ink",
};

const OUTCOME_SIZES = {
  xs: { tile: "h-5 w-5 rounded-md", icon: "h-3 w-3" },
  sm: { tile: "h-8 w-8 rounded-xl", icon: "h-4 w-4" },
  md: { tile: "h-9 w-9 rounded-xl", icon: "h-5 w-5" },
  lg: { tile: "h-12 w-12 rounded-2xl", icon: "h-6 w-6" },
};

/** A circle with one half filled in: some of the points. */
function HalfIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="3" />
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" />
    </svg>
  );
}

/**
 * A check for full points, a half-filled circle for partial points, an x for
 * no points, an hourglass while nobody has graded it and an eye while the
 * teacher is checking. The icon carries the meaning, so colour is never the
 * only signal. Decorative: pair it with words.
 */
export function OutcomeIcon({ outcome, className }: { outcome: OutcomeKind; className?: string }) {
  switch (outcome) {
    case "full":
      return <Check className={className} strokeWidth={3.5} aria-hidden="true" />;
    case "partial":
      return <HalfIcon className={className} />;
    case "none":
      return <X className={className} strokeWidth={3.5} aria-hidden="true" />;
    case "pending":
      return <Hourglass className={className} strokeWidth={2.5} aria-hidden="true" />;
    case "review":
      return <Eye className={className} strokeWidth={2.75} aria-hidden="true" />;
  }
}

/** The coloured square that holds an OutcomeIcon. */
export function OutcomeTile({
  outcome,
  size = "md",
  className,
  style,
}: {
  outcome: OutcomeKind;
  size?: keyof typeof OUTCOME_SIZES;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "flex flex-none items-center justify-center",
        OUTCOME_SIZES[size].tile,
        OUTCOME_TILES[outcome],
        className,
      )}
    >
      <OutcomeIcon outcome={outcome} className={OUTCOME_SIZES[size].icon} />
    </span>
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

// A text box shows focus with a blue border and a soft ring in place of the
// page's outline.
const INPUT_CLASS =
  "block w-full rounded-xl border-2 border-line bg-white px-3.5 py-2.5 text-base font-semibold text-ink placeholder:font-medium placeholder:text-slate-500 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-200 disabled:bg-slate-100";

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
  const stroke = { success: "#059669", warning: "#d97706", danger: "#dc2626" }[
    scoreTone(score, max)
  ];
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
      {/* The words grow with the ring, and stay readable in a small one. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span
          className="font-display font-extrabold text-ink"
          style={{ fontSize: Math.round(size * 0.24) }}
        >
          {formatScore(score)}
        </span>
        <span
          className="mt-0.5 font-extrabold text-muted"
          style={{ fontSize: Math.max(11, Math.round(size * 0.11)) }}
        >
          of {formatScore(max)}
        </span>
      </div>
    </div>
  );
}

/**
 * The colour a score gets: green from 75%, amber from 50%, red below. Score,
 * ScoreRing and any chip beside them use the same cut-offs.
 */
export function scoreTone(score: number, max: number): "success" | "warning" | "danger" {
  const ratio = max > 0 ? score / max : 0;
  return ratio >= 0.75 ? "success" : ratio >= 0.5 ? "warning" : "danger";
}

/** "8 / 10" with a colour that follows the percentage. */
export function Score({ score, max }: { score: number; max: number }) {
  return (
    <Badge tone={scoreTone(score, max)} className="px-3 text-sm">
      {formatScore(score)} / {formatScore(max)}
    </Badge>
  );
}

/** 7 -> "7", 7.5 -> "7.5". */
export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
