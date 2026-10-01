// The parent's home: their child's results, newest first, and the published
// activities the child has not answered yet.

import { formatDate } from "@/components/parent/format";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Page,
  PageHeader,
  Score,
  SectionTitle,
} from "@/components/ui";
import {
  getClass,
  getUser,
  listActivities,
  listSubmissionsForStudent,
} from "@/lib/db/repo";
import { requireRole } from "@/lib/session";

export default async function ParentHomePage() {
  const user = await requireRole("parent");
  const child = user.childId ? await getUser(user.childId) : null;

  if (!child) {
    return (
      <Page>
        <PageHeader title={`Hello, ${user.name}`} />
        <Alert tone="warning" title="No student is linked to this account">
          Results show up here once a student is linked. Ask the teacher to link your
          child, or switch to another sample account.
        </Alert>
      </Page>
    );
  }

  const [schoolClass, activities, submissions] = await Promise.all([
    getClass(child.classId),
    listActivities(child.classId, { status: "published" }),
    listSubmissionsForStudent(child.id),
  ]);

  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const answeredIds = new Set(submissions.map((submission) => submission.activityId));
  const notAnswered = activities.filter((activity) => !answeredIds.has(activity.id));
  // ISO dates sort correctly as text.
  const results = [...submissions].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return (
    <Page>
      <PageHeader
        title={child.name}
        description={
          schoolClass
            ? `${schoolClass.name} · ${schoolClass.subject}`
            : "Your child's results"
        }
      />

      {results.length === 0 && notAnswered.length === 0 ? (
        <EmptyState
          title="Nothing to show yet"
          description={`When the teacher publishes an activity and ${child.name} answers it, the result will show up here.`}
        />
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="results-title">
            <SectionTitle className="mb-3">
              <span id="results-title">Results</span>
            </SectionTitle>
            {results.length === 0 ? (
              <p className="text-sm text-slate-600">
                {child.name} has not answered an activity yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {results.map((submission) => {
                  const activity = activityById.get(submission.activityId);
                  return (
                    <li key={submission.id}>
                      <Card>
                        <h3 className="break-words text-base font-semibold text-slate-900">
                          {activity?.title ?? "Activity"}
                        </h3>
                        {activity && (
                          <p className="mt-0.5 break-words text-sm text-slate-600">
                            Lesson: {activity.lessonTitle}
                          </p>
                        )}
                        <p className="mt-0.5 text-sm text-slate-500">
                          Answered {formatDate(submission.submittedAt)}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-slate-600">Score</span>
                            <Score score={submission.totalScore} max={submission.maxScore} />
                            {submission.needsReview && (
                              <Badge tone="warning">Teacher is checking</Badge>
                            )}
                          </div>
                          <ButtonLink href={`/parent/submissions/${submission.id}`}>
                            See summary
                          </ButtonLink>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {notAnswered.length > 0 && (
            <section aria-labelledby="waiting-title">
              <SectionTitle className="mb-3">
                <span id="waiting-title">Not answered yet</span>
              </SectionTitle>
              <ul className="space-y-3">
                {notAnswered.map((activity) => (
                  <li key={activity.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-base font-semibold text-slate-900">
                          {activity.title}
                        </h3>
                        <p className="mt-0.5 break-words text-sm text-slate-600">
                          Lesson: {activity.lessonTitle}
                        </p>
                      </div>
                      <Badge>Not answered yet</Badge>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Page>
  );
}
