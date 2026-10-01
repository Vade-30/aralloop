"use client";

// Expandable row for one student's answers on the results page. The open
// state is kept here rather than in the "open" attribute alone, so the row
// stays as the teacher left it when the page refreshes after saving a score.

import { useState, type ReactNode } from "react";

export function StudentDetails({
  defaultOpen,
  summary,
  children,
}: {
  defaultOpen: boolean;
  /** The always-visible row: name, score and badges. */
  summary: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-2 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="shrink-0 text-slate-500 transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {summary}
        </span>
      </summary>
      <div className="space-y-3 border-t border-slate-200 p-3 sm:p-4">{children}</div>
    </details>
  );
}
