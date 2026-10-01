// Summary panel of an activity: how many items, how many points, and how many
// of each answer type. The draft editor shows it beside the items and it
// follows the teacher's edits, with a ring that fills as the items become
// ready; the published view shows the same panel read-only. No hooks, so it
// works in server and client components alike.

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { ITEM_TYPES, ITEM_TYPE_LABELS, type ItemType } from "@/lib/types";
import { Card, cn } from "@/components/ui";
import { ITEM_TYPE_STYLES } from "./EditorItemType";

/** What the summary needs to know about one item. */
export interface SummaryEntry {
  type: ItemType;
  points: number;
}

/** How close a draft is to being publishable. */
export interface Readiness {
  /** Items with nothing left to fix. */
  ready: number;
  total: number;
  /** Something about the activity itself that stops it, e.g. a missing title. */
  blocker?: string;
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    // Reversed so the term still comes first for screen readers.
    <div className="flex flex-col-reverse rounded-2xl bg-brand-50 px-3 py-2.5 text-center">
      <dt className="mt-0.5 text-xs font-extrabold text-muted">{label}</dt>
      {/* Keyed by its value, so the number pops again whenever it changes. */}
      <dd
        key={value}
        className="animate-pop font-display text-3xl font-extrabold leading-none text-brand-600"
      >
        {value}
      </dd>
    </div>
  );
}

const RING_RADIUS = 16;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** Ring that fills with the share of items that are ready. The text beside it says the same. */
function ReadyRing({ ready, total, complete }: { ready: number; total: number; complete: boolean }) {
  const share = total > 0 ? Math.min(1, ready / total) : 0;
  return (
    <span aria-hidden="true" className="relative flex h-11 w-11 flex-none items-center justify-center">
      <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="20" cy="20" r={RING_RADIUS} fill="#fff" stroke="#fff" strokeWidth="6" />
        <circle
          cx="20"
          cy="20"
          r={RING_RADIUS}
          fill="none"
          stroke={complete ? "#059669" : "#f0b429"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - share)}
          className="transition-[stroke-dashoffset,stroke] duration-500"
        />
      </svg>
      {complete ? (
        <Check className="relative h-4 w-4 animate-pop text-emerald-700" strokeWidth={4} />
      ) : (
        <span className="relative font-display text-sm font-extrabold leading-none text-amber-900">
          {ready}
        </span>
      )}
    </span>
  );
}

export function EditorSummary({
  entries,
  status,
  badges,
  readiness,
  children,
  className,
}: {
  entries: SummaryEntry[];
  /** Badge beside the heading, e.g. "Draft". */
  status?: ReactNode;
  /** Chips under the heading. */
  badges?: ReactNode;
  /** Draft only: shows how many items are ready to publish. */
  readiness?: Readiness;
  /** Shown under the counts, after a divider. */
  children?: ReactNode;
  className?: string;
}) {
  const totalPoints = entries.reduce((sum, entry) => sum + entry.points, 0);
  const counts = ITEM_TYPES.map((type) => ({
    type,
    count: entries.filter((entry) => entry.type === type).length,
  })).filter((row) => row.count > 0);
  const complete =
    readiness !== undefined &&
    !readiness.blocker &&
    readiness.total > 0 &&
    readiness.ready === readiness.total;

  return (
    // Positioned, so it can overlap a PageHeader with `overlap`.
    <Card className={cn("relative", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold text-ink">Summary</h2>
        {status}
      </div>
      {badges && <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>}

      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Figure value={entries.length} label={entries.length === 1 ? "Item" : "Items"} />
        <Figure value={totalPoints} label="Total points" />
      </dl>

      {readiness && (
        <div
          className={cn(
            "mt-3 flex items-center gap-3 rounded-2xl border-2 px-3 py-2 transition-colors duration-300",
            complete ? "border-emerald-200 bg-emerald-50" : "border-accent-200 bg-accent-50",
          )}
        >
          <ReadyRing ready={readiness.ready} total={readiness.total} complete={complete} />
          <p className="min-w-0 leading-tight">
            <span
              className={cn(
                "block text-sm font-extrabold",
                complete ? "text-emerald-900" : "text-amber-900",
              )}
            >
              {complete ? "Ready to publish" : "Not ready yet"}
            </span>
            <span className="block break-words text-xs font-bold text-muted">
              {readiness.blocker ??
                `${readiness.ready} of ${readiness.total} ${readiness.total === 1 ? "item" : "items"} ready`}
            </span>
          </p>
        </div>
      )}

      {counts.length > 0 && (
        <>
          {/* The same counts as the list below, drawn as proportions. */}
          <div aria-hidden="true" className="mt-4 flex h-2.5 gap-1">
            {counts.map(({ type, count }) => (
              <span
                key={type}
                className={cn(
                  "min-w-2 basis-0 rounded-full transition-[flex-grow] duration-300",
                  ITEM_TYPE_STYLES[type].bar,
                )}
                style={{ flexGrow: count }}
              />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
            {counts.map(({ type, count }) => {
              const { Icon, tile } = ITEM_TYPE_STYLES[type];
              return (
                <li key={type} className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-8 w-8 flex-none items-center justify-center rounded-xl",
                      tile,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block font-display text-lg font-extrabold leading-none text-ink">
                      {count}
                    </span>
                    <span className="block break-words text-xs font-bold text-muted">
                      {ITEM_TYPE_LABELS[type]}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {children && <div className="mt-4 border-t-2 border-line pt-3">{children}</div>}
    </Card>
  );
}
