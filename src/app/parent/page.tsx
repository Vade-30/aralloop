// The parent's home: their child's results, newest first, and the published
// activities the child has not answered yet.

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleDashed,
  ClipboardCheck,
  Eye,
  NotebookPen,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/components/parent/format";
import { NoChildArt, WaitingArt } from "@/components/parent/illustrations";
import {
  Badge,
  ButtonLink,
  CARD_LIFT,
  Card,
  EmptyState,
  IconTile,
  Page,
  PageHeader,
  ProgressBar,
  ScoreRing,
  SectionTitle,
  StatRow,
  StatTile,
  cn,
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
        <div
          role="status"
          className="flex max-w-2xl animate-rise flex-col items-center gap-4 rounded-3xl border-2 border-accent-200 bg-accent-50 p-5 text-center sm:flex-row sm:gap-6 sm:p-6 sm:text-left"
        >
          <NoChildArt className="h-20 w-auto flex-none" />
          <div className="min-w-0">
            <p className="font-display text-xl font-extrabold leading-tight text-ink">
              No student is linked to this account
            </p>
            <p className="mt-1.5 text-sm font-semibold text-amber-900">
              Results show up here once a student is linked. Ask the teacher to link your
              child, or switch to another sample account.
            </p>
          </div>
        </div>
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

  const isEmpty = results.length === 0 && notAnswered.length === 0;
  const hasWaiting = notAnswered.length > 0;
  // Each activity counts the same, whatever its number of points.
  const average =
    results.length === 0
      ? null
      : results.reduce(
          (sum, submission) =>
            sum + (submission.maxScore > 0 ? submission.totalScore / submission.maxScore : 0),
          0,
        ) / results.length;
  const checking = results.filter((submission) => submission.needsReview).length;
  const answeredCount = activities.length - notAnswered.length;

  return (
    <Page>
      <PageHeader
        eyebrow={schoolClass ? `${schoolClass.name} · ${schoolClass.subject}` : undefined}
        title={child.name}
        description="Your child's results"
        overlap={!isEmpty}
      />

      {isEmpty ? (
        <EmptyState
          art={<WaitingArt className="h-28 w-28" />}
          title="Nothing to show yet"
          description={`When the teacher publishes an activity and ${child.name} answers it, the result will show up here.`}
        />
      ) : (
        <>
          <StatRow>
            <StatTile value={results.length} label="Answered" icon={<ClipboardCheck />} />
            <StatTile
              value={average === null ? "–" : `${Math.round(average * 100)}%`}
              label="Average score"
              tone={average !== null && average >= 0.75 ? "success" : "brand"}
              icon={<TrendingUp />}
            />
            <StatTile
              value={notAnswered.length}
              label="Not answered yet"
              tone={hasWaiting ? "warning" : "brand"}
              icon={<CircleDashed />}
            />
            <StatTile
              value={checking}
              label="Teacher is checking"
              tone={checking > 0 ? "warning" : "brand"}
              icon={<Eye />}
            />
          </StatRow>

          {/* On a laptop the waiting activities sit beside the results. */}
          <div
            className={cn(
              "mt-8 grid gap-8",
              hasWaiting && "lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start",
            )}
          >
            <section aria-labelledby="results-title" className="min-w-0">
              <SectionTitle className="mb-3">
                <span id="results-title">Results</span>
              </SectionTitle>
              {results.length === 0 ? (
                <div className="flex animate-rise items-center gap-4 rounded-3xl border-2 border-dashed border-brand-200 bg-white p-4 sm:p-5">
                  <WaitingArt className="h-16 w-16 flex-none" />
                  <p className="min-w-0 break-words text-sm font-semibold text-muted">
                    {child.name} has not answered an activity yet.
                  </p>
                </div>
              ) : (
                <ul
                  className={cn(
                    "grid gap-4",
                    // With nothing beside them, two cards fit across a laptop.
                    !hasWaiting && results.length > 1 && "lg:grid-cols-2",
                  )}
                >
                  {results.map((submission, index) => {
                    const activity = activityById.get(submission.activityId);
                    const href = `/parent/submissions/${submission.id}`;
                    return (
                      <li
                        key={submission.id}
                        className="animate-rise"
                        style={{ animationDelay: `${80 + Math.min(index, 6) * 70}ms` }}
                      >
                        <Card className={cn("group relative isolate flex h-full flex-col", CARD_LIFT)}>
                          <div className="mb-4 flex items-center gap-3.5">
                            {/* Blue, as for anything finished; yellow is for what still needs doing. */}
                            <IconTile tone="brand">
                              <ClipboardCheck />
                            </IconTile>
                            <h3 className="min-w-0 flex-1 break-words text-lg font-extrabold leading-snug text-ink">
                              {/* The whole card opens the summary, not only the button. */}
                              <Link
                                href={href}
                                className="after:absolute after:inset-0 after:z-10 after:rounded-3xl group-hover:text-brand-700"
                              >
                                {activity?.title ?? "Activity"}
                              </Link>
                            </h3>
                            <ScoreRing
                              score={submission.totalScore}
                              max={submission.maxScore}
                              size={72}
                            />
                          </div>

                          <div className="mt-auto flex flex-col gap-4 border-t-2 border-line pt-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="min-w-0 space-y-1.5 text-sm font-semibold text-muted">
                              {activity && (
                                <p className="flex items-start gap-2">
                                  <BookOpen className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                                  <span className="min-w-0 break-words">
                                    Lesson: {activity.lessonTitle}
                                  </span>
                                </p>
                              )}
                              <p className="flex items-start gap-2">
                                <CalendarDays className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                                <span>Answered {formatDate(submission.submittedAt)}</span>
                              </p>
                              {submission.needsReview && (
                                <p className="pt-1">
                                  <Badge tone="warning">
                                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                    Teacher is checking
                                  </Badge>
                                </p>
                              )}
                            </div>
                            <ButtonLink
                              href={href}
                              className="relative z-20 w-full sm:w-auto sm:flex-none"
                            >
                              See summary
                              <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </ButtonLink>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {hasWaiting && (
              <section aria-labelledby="waiting-title" className="min-w-0">
                <SectionTitle className="mb-3">
                  <span id="waiting-title">Not answered yet</span>
                </SectionTitle>
                <div className="mb-4 animate-rise rounded-2xl border-2 border-line bg-white px-4 py-3 [animation-delay:120ms]">
                  <p className="flex items-baseline justify-between gap-3 text-sm font-extrabold text-ink">
                    <span>Activities answered</span>
                    <span className="font-display text-lg leading-none text-brand-600">
                      {answeredCount} of {activities.length}
                    </span>
                  </p>
                  <ProgressBar
                    value={answeredCount}
                    max={activities.length}
                    label="Activities answered"
                    className="mt-2.5"
                  />
                </div>
                <ul className="space-y-3">
                  {notAnswered.map((activity, index) => (
                    <li
                      key={activity.id}
                      className="flex animate-rise items-start gap-3 rounded-3xl border-2 border-dashed border-brand-200 bg-white/70 p-4"
                      style={{ animationDelay: `${180 + Math.min(index, 6) * 70}ms` }}
                    >
                      <IconTile tone="soft">
                        <NotebookPen />
                      </IconTile>
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-base font-extrabold leading-snug text-ink">
                          {activity.title}
                        </h3>
                        <p className="mt-0.5 break-words text-sm font-semibold text-muted">
                          Lesson: {activity.lessonTitle}
                        </p>
                        <Badge className="mt-2">
                          <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
                          Not answered yet
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      )}
    </Page>
  );
}
