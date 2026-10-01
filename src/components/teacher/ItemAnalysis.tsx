// Results page: how the class did on each item, drawn as a bar chart. Counted
// in code from the stored scores, with no AI involved.

import { ChartNoAxesColumn, Flag } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Card, IconTile, SectionTitle, cn } from "@/components/ui";
import { formatPercent, type ItemStat } from "./results-model";

type Strength = "strong" | "middling" | "weak";

const STRENGTHS: Record<Strength, { range: string; bar: string; tile: string; text: string }> = {
  strong: {
    range: "75% or more",
    bar: "bg-emerald-500",
    tile: "bg-emerald-100 text-emerald-800",
    text: "text-emerald-700",
  },
  middling: {
    range: "50% to 74%",
    bar: "bg-amber-400",
    tile: "bg-amber-100 text-amber-900",
    text: "text-amber-700",
  },
  weak: {
    range: "Under 50%",
    bar: "bg-red-500",
    tile: "bg-red-100 text-red-800",
    text: "text-red-700",
  },
};

// The same cut-offs as Score and ScoreRing. It takes the rounded percentage,
// so a bar's colour always agrees with the number printed beside it.
function strengthOf(percent: number): Strength {
  if (percent >= 75) return "strong";
  return percent >= 50 ? "middling" : "weak";
}

function Heading({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 items-center gap-3">
        <IconTile>
          <ChartNoAxesColumn strokeWidth={3} />
        </IconTile>
        <div className="min-w-0">
          <SectionTitle>Item analysis</SectionTitle>
          <p className="text-sm font-semibold text-muted">
            How much of the class earned full points on each item.
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

/** What the three bar colours stand for. */
function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {(Object.keys(STRENGTHS) as Strength[]).map((strength) => (
        <li key={strength} className="flex items-center gap-1.5 text-xs font-extrabold text-muted">
          <span
            aria-hidden="true"
            className={cn("h-3 w-3 rounded-full", STRENGTHS[strength].bar)}
          />
          {STRENGTHS[strength].range}
        </li>
      ))}
    </ul>
  );
}

/** Three placeholder bars for the time before anyone has submitted. */
function EmptyChart() {
  const fills = [
    { width: 78, className: "fill-brand-300" },
    { width: 46, className: "fill-accent-300" },
    { width: 94, className: "fill-brand-200" },
  ];
  return (
    <svg viewBox="0 0 136 72" className="h-[72px] w-[136px]" aria-hidden="true">
      {fills.map((fill, index) => {
        const y = 4 + index * 24;
        return (
          <g key={index}>
            <rect x="0" y={y} width="16" height="16" rx="5" className="fill-brand-100" />
            <rect x="24" y={y + 3} width="112" height="10" rx="5" className="fill-brand-100" />
            <rect x="24" y={y + 3} width={fill.width} height="10" rx="5" className={fill.className} />
          </g>
        );
      })}
    </svg>
  );
}

export function ItemAnalysis({
  stats,
  submissionCount,
}: {
  stats: ItemStat[];
  submissionCount: number;
}) {
  if (submissionCount === 0) {
    return (
      <Card>
        <Heading />
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-canvas px-4 py-7 text-center">
          <EmptyChart />
          <p className="max-w-sm text-sm font-semibold text-muted">
            This fills in when the first student submits. It shows which items the class found
            hardest.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <Heading>
        <Legend />
      </Heading>

      {/* Each row reaches 12px into the card's padding, so the "most missed"
          highlight has room around the text. From a tablet up, the question
          sits on the left and every bar starts on the same line to its right. */}
      <ol className="mt-3 space-y-1">
        {stats.map(({ item, fullCount, share, mostMissed }, index) => {
          const percent = Math.round((share ?? 0) * 100);
          const tone = STRENGTHS[strengthOf(percent)];
          return (
            <li
              key={item.id}
              className={cn(
                "-mx-3 animate-rise rounded-2xl px-3 py-3 md:grid md:grid-cols-2 md:items-center md:gap-x-6",
                mostMissed && "bg-accent-50 ring-2 ring-inset ring-accent-200",
              )}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 flex-none items-center justify-center rounded-xl font-display text-lg font-extrabold leading-none",
                    tone.tile,
                  )}
                >
                  {item.position}
                </span>
                <p className="min-w-0 flex-1 break-words pt-1.5 text-[15px] font-bold leading-snug text-ink">
                  {item.question}
                </p>
              </div>

              {/* On a phone this lines up under the question, past the number tile. */}
              <div className="mt-2 min-w-0 pl-12 md:mt-0 md:pl-0">
                <div className="flex items-center gap-2.5">
                  <div
                    aria-hidden="true"
                    className="h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-brand-100"
                  >
                    {/* Grows from zero when it first appears, and slides to its
                        new width when a saved score changes the share. */}
                    <div
                      className={cn(
                        "h-full w-(--share) rounded-full transition-[width] duration-700 ease-out starting:w-0",
                        tone.bar,
                      )}
                      style={
                        {
                          "--share": `${percent}%`,
                          transitionDelay: `${index * 70}ms`,
                        } as CSSProperties
                      }
                    />
                  </div>
                  <span
                    className={cn(
                      "w-13 flex-none text-right font-display text-xl font-extrabold leading-none",
                      tone.text,
                    )}
                  >
                    {formatPercent(share ?? 0)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <p className="text-xs font-bold text-muted">
                    {fullCount} of {submissionCount} earned full points
                  </p>
                  {mostMissed && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-accent-400 px-2.5 py-1 text-xs font-extrabold text-ink">
                      <Flag className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                      Most missed
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 border-t-2 border-line pt-3 text-xs font-semibold text-muted">
        Counted from the current scores, without AI. An answer that has not been graded yet counts
        as not earned.
      </p>
    </Card>
  );
}
