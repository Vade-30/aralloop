// Results page: how one answer turned out for the teacher. Used for the strip
// of answers on a student's card, its legend, and each answer block. The icon
// and colour of each outcome come from the shared kit, so the teacher, the
// student and the parent see the same marks. Presentation only: the scores
// themselves come from the stored answers.

import type { Answer, Item } from "@/lib/types";
import { OutcomeTile, cn } from "@/components/ui";

/** The teacher's four outcomes; each is also a name the kit's OutcomeTile knows. */
export type Outcome = "full" | "partial" | "none" | "review";

/** An answer waiting for the teacher is "review" whatever its score is so far. */
export function outcomeOf(answer: Answer, item: Item): Outcome {
  if (answer.needsReview || answer.gradedBy === "pending") return "review";
  if (answer.score >= item.points) return "full";
  return answer.score > 0 ? "partial" : "none";
}

export const OUTCOMES: Record<Outcome, { label: string }> = {
  full: { label: "Full points" },
  partial: { label: "Partial points" },
  none: { label: "No points" },
  review: { label: "To review" },
};

const ORDER: Outcome[] = ["full", "partial", "none", "review"];

/**
 * One tile per answer, in the order of the activity: a student's whole
 * attempt at a glance. Hidden from screen readers, which get the score and
 * the "to review" chip beside it.
 */
export function OutcomeStrip({ outcomes, className }: { outcomes: Outcome[]; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex flex-wrap gap-1", className)}>
      {outcomes.map((outcome, index) => (
        <OutcomeTile
          key={index}
          outcome={outcome}
          size="xs"
          className="animate-pop"
          style={{ animationDelay: `${200 + index * 45}ms` }}
        />
      ))}
    </span>
  );
}

/** Explains the tiles in the strips. */
export function OutcomeLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5", className)}>
      {ORDER.map((outcome) => (
        <li key={outcome} className="flex items-center gap-1.5 text-xs font-extrabold text-muted">
          <OutcomeTile outcome={outcome} size="xs" />
          {OUTCOMES[outcome].label}
        </li>
      ))}
    </ul>
  );
}
