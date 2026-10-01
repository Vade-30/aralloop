// The student's home: the published activities of their class, each with a
// "Start" link or, once answered, the score and a "Review" link.

import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Page,
  PageHeader,
  Score,
  SectionTitle,
} from "@/components/ui";
import { questionsLabel } from "@/components/student/labels";
import { getClass, listActivities, listSubmissionsForStudent } from "@/lib/db/repo";
import { requireRole } from "@/lib/session";
import { ACTIVITY_TYPE_LABELS, type ActivitySummary } from "@/lib/types";

/** When the class first saw the activity; drafts have no publish date. */
function shownAt(activity: ActivitySummary): string {
  return activity.publishedAt ?? activity.createdAt;
}

export default async function StudentHomePage() {
  const user = await requireRole("student");
  const [schoolClass, published, submissions] = await Promise.all([
    getClass(user.classId),
    listActivities(user.classId, { status: "published" }),
    listSubmissionsForStudent(user.id),
  ]);

  // ISO dates sort correctly as text.
  const activities = [...published].sort((a, b) => shownAt(b).localeCompare(shownAt(a)));
  const submissionByActivity = new Map(
    submissions.map((submission) => [submission.activityId, submission]),
  );

  return (
    <Page>
      <PageHeader
        title={`Hello, ${user.name}`}
        description={
          schoolClass
            ? `${schoolClass.name} · ${schoolClass.subject}`
            : "Your class activities"
        }
      />

      <SectionTitle className="mb-3">Activities</SectionTitle>

      {activities.length === 0 ? (
        <EmptyState
          title="No activities yet"
          description="When your teacher publishes an activity, it will show up here."
        />
      ) : (
        <ul className="space-y-3">
          {activities.map((activity) => {
            const submission = submissionByActivity.get(activity.id);
            const href = `/student/activities/${activity.id}`;
            return (
              <li key={activity.id}>
                <Card>
                  <h3 className="break-words text-base font-semibold text-slate-900">
                    {activity.title}
                  </h3>
                  <p className="mt-0.5 break-words text-sm text-slate-600">
                    Lesson: {activity.lessonTitle}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <Badge tone="brand">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
                    <span>{questionsLabel(activity.itemCount)}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    {submission ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-slate-600">Your score</span>
                          <Score score={submission.totalScore} max={submission.maxScore} />
                          {submission.needsReview && (
                            <Badge tone="warning">Teacher is checking</Badge>
                          )}
                        </div>
                        <ButtonLink href={href} variant="secondary">
                          Review
                        </ButtonLink>
                      </>
                    ) : (
                      <>
                        <Badge>Not started</Badge>
                        <ButtonLink href={href}>Start</ButtonLink>
                      </>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
