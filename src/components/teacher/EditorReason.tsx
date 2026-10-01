// The "Why this format" panel: the reason recorded when the activity was
// drafted. Shown above the items in the draft editor and in the published
// view. No hooks, so it works in server and client components alike.

import { Lightbulb, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { AiProviderName } from "@/lib/types";
import { IconTile, cn } from "@/components/ui";

/**
 * A checked activity sheet with a pencil across it: the draft is the teacher's
 * to review. Decorative, and it says nothing about who wrote the draft, so it
 * is the same in sample mode.
 */
function ReviewArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" fill="none" aria-hidden="true" className={className}>
      <rect x="30" y="12" width="62" height="74" rx="12" fill="#dbe7fe" transform="rotate(9 61 49)" />
      <rect x="22" y="20" width="62" height="74" rx="12" fill="#bfd3fe" />
      <rect x="22" y="14" width="62" height="74" rx="12" fill="#fff" stroke="#bfd3fe" strokeWidth="3" />
      <circle cx="38" cy="33" r="7" fill="#059669" />
      <path
        d="M34.6 33.2l2.4 2.4 4.4-4.8"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="50" y="30" width="24" height="6" rx="3" fill="#2549e6" />
      <circle cx="38" cy="52" r="7" fill="#dbe7fe" />
      <rect x="50" y="49" width="18" height="6" rx="3" fill="#dbe7fe" />
      <circle cx="38" cy="71" r="7" fill="#dbe7fe" />
      <rect x="50" y="68" width="24" height="6" rx="3" fill="#dbe7fe" />
      <g transform="rotate(38 92 62)">
        <rect x="85" y="30" width="14" height="10" rx="4" fill="#1e3084" />
        <rect x="85" y="38" width="14" height="40" fill="#f7c948" />
        <rect x="85" y="38" width="5" height="40" fill="#f0b429" />
        <path d="M85 78h14l-7 13z" fill="#fff3c4" />
        <path d="M89.6 86.5h4.8L92 91z" fill="#16204a" />
      </g>
      <circle cx="104" cy="16" r="6" fill="#f7c948" />
    </svg>
  );
}

export function EditorReason({
  provider,
  reason,
  children,
  className,
}: {
  provider: AiProviderName;
  reason: string;
  /** Chips shown under the reason. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    // Positioned, so it can overlap a PageHeader with `overlap`.
    <section
      aria-labelledby="why-this-format"
      className={cn(
        "relative overflow-hidden rounded-3xl border-2 border-brand-200 bg-white p-4 shadow-[0_5px_0_#bfd3fe] sm:p-5",
        className,
      )}
    >
      {/* The header band's circle again, faint, so the panel reads as part of it. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-brand-50"
      />
      <div className="relative flex gap-3 sm:gap-4">
        {/* The sparkles mean AI. A sample-mode draft was built by plain code, so it gets a neutral icon. */}
        <IconTile tone="accent" className="shadow-[0_4px_0_#c99a12]">
          {provider === "mock" ? <Lightbulb /> : <Sparkles />}
        </IconTile>
        <div className="min-w-0 flex-1">
          <h2 id="why-this-format" className="text-lg font-extrabold leading-tight text-ink sm:text-xl">
            Why this format
          </h2>
          <p className="mt-1 whitespace-pre-wrap break-words text-[15px] font-semibold leading-relaxed text-ink">
            {reason}
          </p>
          {children && <div className="mt-3 flex flex-wrap items-center gap-1.5">{children}</div>}
        </div>
        <ReviewArt className="hidden w-24 flex-none self-center sm:block" />
      </div>
    </section>
  );
}
