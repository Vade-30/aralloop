// One small tile per question showing how it was scored, for the score card at
// the top of the student's results and the parent's summary. It reads points
// and scores only, never an answer key, and it is only rendered for an
// activity that was already submitted.

import { OutcomeIcon, OutcomeTile, cn } from "@/components/ui";
import type { Answer, Item } from "@/lib/types";
import { countOutcomes, OUTCOME_ORDER, OUTCOMES, outcomeOf, type Outcome } from "./student/outcome";

// Border, tint and text of a tile. The rules and the wording are the ones the
// answer cards further down the screen use (ResultItem), so the two agree.
const TILES: Record<Outcome, string> = {
  full: "border-emerald-200 bg-emerald-50 text-emerald-800",
  partial: "border-accent-300 bg-accent-50 text-amber-900",
  none: "border-red-200 bg-red-50 text-red-800",
  pending: "border-slate-200 bg-slate-50 text-slate-700",
};

type ScoredItem = Pick<Item, "id" | "position" | "points">;

export function QuestionStrip({
  items,
  answers,
}: {
  items: ScoredItem[];
  /** The submission's answers by item id. */
  answers: Map<string, Answer>;
}) {
  if (items.length === 0) return null;
  const counts = countOutcomes(items, answers);

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-muted">
        Question by question
      </p>
      <ol className="mt-2.5 flex flex-wrap gap-2">
        {items.map((item, index) => {
          const outcome = outcomeOf(item, answers.get(item.id));
          return (
            <li
              key={item.id}
              className={cn(
                "flex h-12 w-10 animate-pop flex-col items-center justify-center gap-1 rounded-xl border-2",
                TILES[outcome],
              )}
              style={{ animationDelay: `${200 + Math.min(index, 12) * 60}ms` }}
            >
              <OutcomeIcon outcome={outcome} className="h-4 w-4" />
              <span aria-hidden="true" className="text-xs font-black leading-none">
                {item.position}
              </span>
              <span className="sr-only">
                Question {item.position}: {OUTCOMES[outcome].label}
              </span>
            </li>
          );
        })}
      </ol>
      {/* The same counts in words, so the colours are never the only signal. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {OUTCOME_ORDER.filter((outcome) => counts[outcome] > 0).map((outcome) => (
          <li
            key={outcome}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-muted"
          >
            <OutcomeTile outcome={outcome} size="xs" />
            {OUTCOMES[outcome].label}: {counts[outcome]}
          </li>
        ))}
      </ul>
    </div>
  );
}
