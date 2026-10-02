// The activities of one lesson, as shown on the dashboard and the lesson page.
// A draft opens in the editor; a published activity opens its results.

import {
  ArrowRight,
  CircleCheck,
  Eye,
  EyeOff,
  ListChecks,
  PenLine,
  PencilLine,
  Shapes,
  TextCursorInput,
  ToggleLeft,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { ACTIVITY_TYPE_LABELS, type ActivitySummary, type ActivityType } from "@/lib/types";
import { Badge, CARD_LIFT, IconTile, ProgressBar, cn } from "@/components/ui";
import { plural } from "./format";
import { formatPercent } from "./results-model";

const TYPE_ICONS: Record<ActivityType, LucideIcon> = {
  multiple_choice: ListChecks,
  true_false: ToggleLeft,
  identification: TextCursorInput,
  short_answer: PenLine,
  mixed: Shapes,
};

export function activityHref(activity: Pick<ActivitySummary, "id" | "status">): string {
  return activity.status === "draft"
    ? `/teacher/activities/${activity.id}`
    : `/teacher/activities/${activity.id}/results`;
}

export function ActivityList({
  activities,
  studentCount,
  averages,
}: {
  activities: ActivitySummary[];
  /** Students in the class: the "m" in "n of m submitted". */
  studentCount: number;
  /** Class average per activity id, 0..1. Leave out an activity with no submissions. */
  averages?: ReadonlyMap<string, number>;
}) {
  return (
    <ul className="space-y-4">
      {activities.map((activity, index) => {
        const draft = activity.status === "draft";
        const TypeIcon = TYPE_ICONS[activity.type];
        const average = averages?.get(activity.id);
        const everyone = studentCount > 0 && activity.submissionCount >= studentCount;
        return (
          <li
            key={activity.id}
            className="animate-rise"
            style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}
          >
            {/* The whole card is the link. On a phone the details sit under the
                title row; from sm up they line up beside the icon. */}
            <Link
              href={activityHref(activity)}
              className={cn(
                "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 rounded-3xl border-2 border-line bg-white p-4 active:translate-y-[3px] active:shadow-none sm:gap-x-4 sm:gap-y-2 sm:p-5",
                CARD_LIFT,
              )}
            >
              <IconTile
                tone={draft ? "accent" : "brand"}
                className="sm:col-start-1 sm:row-span-2 sm:row-start-1 sm:self-start"
              >
                <TypeIcon />
              </IconTile>

              <span className="min-w-0 break-words font-display text-lg font-extrabold leading-snug text-ink sm:col-start-2 sm:row-start-1">
                {activity.title}
              </span>

              <span className="flex h-11 flex-none items-center gap-1.5 rounded-2xl bg-brand-50 px-3 text-sm font-extrabold text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white sm:col-start-3 sm:row-span-2 sm:row-start-1">
                <span className="sr-only sm:not-sr-only">{draft ? "Review" : "Results"}</span>
                <ArrowRight
                  className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>

              <div className="col-span-3 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-2">
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={draft ? "neutral" : "success"}>
                    {draft ? (
                      <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {draft ? "Draft" : "Published"}
                  </Badge>
                  <Badge tone="brand">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
                  <Badge>
                    {activity.itemCount} {activity.itemCount === 1 ? "item" : "items"}
                  </Badge>
                  {activity.needsReviewCount > 0 && (
                    // Counts students' submissions; the results page counts answers.
                    <Badge tone="warning">
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      {plural(activity.needsReviewCount, "submission")} to review
                    </Badge>
                  )}
                </div>

                {draft ? (
                  <p className="mt-3 flex items-start gap-1.5 text-[13px] font-bold text-muted">
                    <EyeOff className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                    Not visible to students until you publish.
                  </p>
                ) : (
                  <div className="mt-3">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-[13px] font-extrabold">
                      <span className="inline-flex items-center gap-1.5 text-ink">
                        {everyone && (
                          <CircleCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                        )}
                        {activity.submissionCount} of {studentCount} submitted
                      </span>
                      {average !== undefined && (
                        <span className="text-muted">
                          Class average{" "}
                          <span className="text-brand-700">{formatPercent(average)}</span>
                        </span>
                      )}
                    </div>
                    <ProgressBar
                      className="mt-1.5"
                      value={Math.min(activity.submissionCount, studentCount)}
                      max={studentCount}
                      label="Students who submitted"
                      tone={everyone ? "success" : "brand"}
                    />
                  </div>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
