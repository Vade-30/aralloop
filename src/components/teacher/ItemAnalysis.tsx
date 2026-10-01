// Results page: how the class did on each item. Counted in code from the
// stored scores, with no AI involved.

import { Badge, Card, cn } from "@/components/ui";
import { formatPercent, type ItemStat } from "./results-model";

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
        <p className="text-sm text-slate-600">
          This fills in when the first student submits. It shows which items the class found
          hardest.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <ol className="space-y-4">
        {stats.map(({ item, fullCount, share, mostMissed }) => (
          <li key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words text-sm text-slate-900">
                <span className="font-semibold">{item.position}.</span> {item.question}
              </p>
              {mostMissed && (
                <Badge tone="warning" className="shrink-0">
                  Most missed
                </Badge>
              )}
            </div>
            <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className={cn("h-full rounded-full", mostMissed ? "bg-amber-500" : "bg-brand-600")}
                style={{ width: `${Math.round((share ?? 0) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {fullCount} of {submissionCount} earned full points
              {share !== null && ` (${formatPercent(share)})`}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
        Counted from the scores, without AI. Answers still waiting for your review count as not
        earned yet.
      </p>
    </Card>
  );
}
