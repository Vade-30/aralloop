// The score card at the top of a result: the ring, a heading beside it, and
// each question at a glance. The student's results and the parent's summary
// both open with it, so a score looks the same to both. It reads points and
// scores only, and it is only rendered for an activity that was submitted.

import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, Badge, Card, ScoreRing, scoreTone } from "@/components/ui";
import type { Answer, Item } from "@/lib/types";
import { QuestionStrip } from "./QuestionStrip";

export function ScoreHero({
  score,
  max,
  eyebrow,
  title,
  detail,
  chips,
  notice,
  items,
  answers,
}: {
  score: number;
  max: number;
  /** Small line above the heading, e.g. "Your score". */
  eyebrow?: string;
  title: string;
  /** One line under the heading. */
  detail?: ReactNode;
  /** Badges under that line. */
  chips?: ReactNode;
  /** Said under the card while the teacher is still checking answers. */
  notice?: string;
  items: Pick<Item, "id" | "position" | "points">[];
  /** The submission's answers by item id. */
  answers: Map<string, Answer>;
}) {
  return (
    // Positioned, so it can overlap a PageHeader with `overlap`.
    <Card className="relative animate-rise">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex min-w-0 flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 sm:text-left lg:flex-1">
          <ScoreRing score={score} max={max} size={132} className="animate-pop" />
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-black uppercase tracking-widest text-brand-600">
                {eyebrow}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
              <h2 className="min-w-0 break-words text-2xl font-extrabold leading-tight text-ink sm:text-3xl">
                {title}
              </h2>
              {/* The same colour bands as the ring beside it. */}
              {max > 0 && (
                <Badge tone={scoreTone(score, max)} className="px-3 text-sm">
                  {Math.round((score / max) * 100)}%
                </Badge>
              )}
            </div>
            {detail && <div className="mt-1 text-[15px] font-bold text-muted">{detail}</div>}
            {chips && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {chips}
              </div>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <div className="border-t-2 border-line pt-4 lg:w-80 lg:flex-none lg:border-l-2 lg:border-t-0 lg:pl-8 lg:pt-0">
            <QuestionStrip items={items} answers={answers} />
          </div>
        )}
      </div>

      {notice && (
        <Alert tone="warning" className="mt-5">
          <span className="flex items-start gap-2.5">
            <Eye className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            <span>{notice}</span>
          </span>
        </Alert>
      )}
    </Card>
  );
}
