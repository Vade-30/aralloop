"use client";

// Expandable card for one student's answers on the results page. The open
// state is kept here rather than in the "open" attribute alone, so the card
// stays as the teacher left it when the page refreshes after saving a score.

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui";

export function StudentDetails({
  defaultOpen,
  summary,
  children,
}: {
  defaultOpen: boolean;
  /** The always-visible row: avatar, name, score and badges. */
  summary: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={cn(
        // Tailwind 4 moves an element with the "translate" property, not "transform".
        "group rounded-3xl border-2 bg-white shadow-edge transition-[translate,border-color] duration-150",
        // Only a closed card lifts on hover: an open one is long, and would
        // shift under the pointer while the teacher works inside it.
        open ? "border-brand-200" : "border-line hover:-translate-y-0.5 hover:border-brand-300",
      )}
    >
      <summary className="group/summary flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-[1.375rem] px-4 py-3 hover:bg-brand-50 group-open:rounded-b-none sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">{summary}</div>
        <span
          aria-hidden="true"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition-transform duration-200 group-open:rotate-180 group-hover/summary:bg-brand-100 sm:h-10 sm:w-10"
        >
          <ChevronDown className="h-5 w-5" strokeWidth={3} />
        </span>
      </summary>
      <div className="animate-rise border-t-2 border-line p-3 sm:p-4">{children}</div>
    </details>
  );
}
