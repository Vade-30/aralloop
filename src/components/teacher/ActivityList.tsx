// The activities of one lesson, as shown on the dashboard and the lesson page.
// A draft opens in the editor; a published activity opens its results.

import Link from "next/link";
import { ACTIVITY_TYPE_LABELS, type ActivitySummary } from "@/lib/types";
import { Badge } from "@/components/ui";
import { plural } from "./format";

export function activityHref(activity: Pick<ActivitySummary, "id" | "status">): string {
  return activity.status === "draft"
    ? `/teacher/activities/${activity.id}`
    : `/teacher/activities/${activity.id}/results`;
}

export function ActivityList({
  activities,
  studentCount,
}: {
  activities: ActivitySummary[];
  /** Students in the class: the "m" in "n of m submitted". */
  studentCount: number;
}) {
  return (
    <ul className="space-y-2">
      {activities.map((activity) => {
        const draft = activity.status === "draft";
        return (
          <li key={activity.id}>
            <Link
              href={activityHref(activity)}
              className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words font-medium text-slate-900">
                  {activity.title}
                </span>
                <span className="shrink-0 text-sm font-medium text-brand-700">
                  {draft ? "Review" : "Results"} <span aria-hidden="true">→</span>
                </span>
              </span>
              <span className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={draft ? "neutral" : "success"}>{draft ? "Draft" : "Published"}</Badge>
                <Badge tone="brand">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
                <Badge>
                  {activity.itemCount} {activity.itemCount === 1 ? "item" : "items"}
                </Badge>
                {!draft && (
                  <Badge>
                    {activity.submissionCount} of {studentCount} submitted
                  </Badge>
                )}
                {activity.needsReviewCount > 0 && (
                  // Counts students' submissions; the results page counts answers.
                  <Badge tone="warning">
                    {plural(activity.needsReviewCount, "submission")} to review
                  </Badge>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
