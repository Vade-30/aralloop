// Teacher dashboard: the class at a glance, what is waiting for the teacher,
// and every lesson with its activities.

import {
  ArrowRight,
  BellRing,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import { ActivityList, activityHref } from "@/components/teacher/ActivityList";
import { ClassSidePanel } from "@/components/teacher/ClassSidePanel";
import { formatDate, plural } from "@/components/teacher/format";
import { LessonStackArt } from "@/components/teacher/LessonArt";
import { classAverage, formatPercent } from "@/components/teacher/results-model";
import {
  ButtonLink,
  EmptyState,
  Page,
  PageHeader,
  SectionTitle,
  StatRow,
  StatTile,
} from "@/components/ui";
import { getClass, listActivities, listLessons, listStudents, listSubmissions } from "@/lib/db/repo";
import { requireRole } from "@/lib/session";
import type { ActivitySummary } from "@/lib/types";

/** Rows in the "Waiting for you" card before the rest are summed up. */
const WAITING_LIMIT = 4;

/** plural() adds an "s", which "activity" cannot take. */
function countActivities(count: number): string {
  return `${count} ${count === 1 ? "activity" : "activities"}`;
}

/** The sentence under the class name: what the teacher should look at first. */
function attentionLine(counts: {
  lessons: number;
  activities: number;
  toReview: number;
  drafts: number;
}): string {
  const { lessons, activities, toReview, drafts } = counts;
  if (lessons === 0) return "Add your first lesson to get started.";
  const waiting: string[] = [];
  if (toReview > 0) {
    waiting.push(
      `${plural(toReview, "submission")} ${toReview === 1 ? "is" : "are"} waiting for your review`,
    );
  }
  if (drafts > 0) {
    waiting.push(`${plural(drafts, "draft")} ${drafts === 1 ? "is" : "are"} not published yet`);
  }
  if (waiting.length > 0) return `${waiting.join(", and ")}.`;
  if (activities === 0) return "Open a lesson to generate its first activity.";
  return "Everything is checked. No submissions are waiting for your review.";
}

export default async function TeacherDashboardPage() {
  const user = await requireRole("teacher");
  const [schoolClass, lessons, activities, students] = await Promise.all([
    getClass(user.classId),
    listLessons(user.classId),
    listActivities(user.classId),
    listStudents(user.classId),
  ]);
  if (!schoolClass) notFound();

  const byLesson = new Map<string, ActivitySummary[]>();
  for (const activity of activities) {
    const list = byLesson.get(activity.lessonId);
    if (list) list.push(activity);
    else byLesson.set(activity.lessonId, [activity]);
  }

  const drafts = activities.filter((activity) => activity.status === "draft");
  const published = activities.filter((activity) => activity.status === "published");
  const needReview = published.filter((activity) => activity.needsReviewCount > 0);
  const toReview = needReview.reduce((sum, activity) => sum + activity.needsReviewCount, 0);

  // Scores live on the submissions, so the averages need one more read for
  // each activity that somebody has answered.
  const answered = published.filter((activity) => activity.submissionCount > 0);
  const submissionLists = await Promise.all(
    answered.map((activity) => listSubmissions(activity.id)),
  );
  const averages = new Map<string, number>();
  answered.forEach((activity, index) => {
    const average = classAverage(submissionLists[index]);
    if (average !== null) averages.set(activity.id, average);
  });
  const overallAverage = classAverage(submissionLists.flat());

  const waiting = [
    ...needReview.map((activity) => ({
      activity,
      note: `${plural(activity.needsReviewCount, "submission")} to review`,
      action: "Check answers",
    })),
    ...drafts.map((activity) => ({
      activity,
      note: "Draft, not published yet",
      action: "Review draft",
    })),
  ];

  const stats: ComponentProps<typeof StatTile>[] = [
    { value: students.length, label: "Students", icon: <Users /> },
    {
      value: published.length,
      label: "Published activities",
      hint: drafts.length > 0 ? `and ${plural(drafts.length, "draft")}` : undefined,
      icon: <ClipboardCheck />,
    },
    {
      value: toReview,
      label: "To review",
      tone: toReview > 0 ? "warning" : "success",
      icon: <Eye />,
    },
    {
      value: overallAverage === null ? "–" : formatPercent(overallAverage),
      label: "Class average",
      hint: overallAverage === null ? "No submissions yet" : undefined,
      icon: <TrendingUp />,
    },
  ];

  return (
    <Page>
      <PageHeader
        eyebrow={`${schoolClass.subject} · Join code ${schoolClass.joinCode}`}
        title={schoolClass.name}
        description={attentionLine({
          lessons: lessons.length,
          activities: activities.length,
          toReview,
          drafts: drafts.length,
        })}
        actions={
          <ButtonLink href="/teacher/lessons/new" size="lg">
            <Plus className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
            New lesson
          </ButtonLink>
        }
        overlap
      />

      <StatRow>
        {stats.map((stat) => (
          <StatTile key={stat.label} {...stat} />
        ))}
      </StatRow>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0">
          {waiting.length > 0 && (
            <section
              aria-labelledby="waiting-title"
              className="mb-8 animate-pop rounded-3xl border-2 border-accent-200 bg-accent-50 p-4 sm:p-5"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent-400 text-ink"
                >
                  <BellRing className="h-5 w-5" />
                </span>
                <h2 id="waiting-title" className="text-lg font-extrabold text-ink">
                  Waiting for you
                </h2>
              </div>
              <ul className="mt-3 space-y-2">
                {waiting.slice(0, WAITING_LIMIT).map(({ activity, note, action }) => (
                  <li
                    key={activity.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-white px-3.5 py-2.5 sm:flex-nowrap"
                  >
                    <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
                      <p className="break-words text-[15px] font-extrabold leading-snug text-ink">
                        {activity.title}
                      </p>
                      <p className="text-[13px] font-bold text-amber-900">{note}</p>
                    </div>
                    <ButtonLink
                      href={activityHref(activity)}
                      variant={activity.status === "draft" ? "secondary" : "brand"}
                      size="sm"
                      className="flex-none"
                      aria-label={`${action}: ${activity.title}`}
                    >
                      {action}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </ButtonLink>
                  </li>
                ))}
              </ul>
              {waiting.length > WAITING_LIMIT && (
                <p className="mt-3 text-[13px] font-bold text-amber-900">
                  And {waiting.length - WAITING_LIMIT} more in the lessons below.
                </p>
              )}
            </section>
          )}

          <SectionTitle className="mb-4">Lessons</SectionTitle>
          {lessons.length === 0 ? (
            <EmptyState
              art={<LessonStackArt className="h-32 w-44" />}
              title="No lessons yet"
              description="Add a lesson and the AI will draft an activity from it for you to review."
              action={
                // Blue here: the yellow button in the header is the same action.
                <ButtonLink href="/teacher/lessons/new" variant="brand">
                  <Plus className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
                  New lesson
                </ButtonLink>
              }
            />
          ) : (
            <ul className="space-y-8">
              {lessons.map((lesson, index) => {
                const lessonActivities = byLesson.get(lesson.id) ?? [];
                return (
                  <li
                    key={lesson.id}
                    className="animate-rise"
                    style={{ animationDelay: `${Math.min(index, 5) * 90}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl border-2 border-brand-200 bg-white text-brand-700"
                      >
                        <BookOpen className="h-6 w-6" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="min-w-0 break-words text-lg font-extrabold leading-snug text-ink">
                          <Link
                            href={`/teacher/lessons/${lesson.id}`}
                            className="group inline-flex min-h-10 items-center gap-1 hover:text-brand-700 hover:underline"
                          >
                            {lesson.title}
                            <ChevronRight
                              className="h-5 w-5 flex-none text-brand-600 transition-transform group-hover:translate-x-0.5"
                              aria-hidden="true"
                            />
                          </Link>
                        </h3>
                        <p className="text-xs font-bold text-muted">
                          Added {formatDate(lesson.createdAt)}
                          {lessonActivities.length > 0 &&
                            ` · ${countActivities(lessonActivities.length)}`}
                        </p>
                      </div>
                    </div>

                    {/* From sm up a dashed line ties the activities to their lesson. */}
                    <div className="mt-3 sm:ml-[23px] sm:border-l-2 sm:border-dashed sm:border-brand-200 sm:pb-1 sm:pl-6">
                      {lessonActivities.length > 0 ? (
                        <ActivityList
                          activities={lessonActivities}
                          studentCount={students.length}
                          averages={averages}
                        />
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-3 rounded-3xl border-2 border-dashed border-brand-200 bg-white px-4 py-2">
                          <p className="text-sm font-bold text-muted">No activity yet.</p>
                          <Link
                            href={`/teacher/lessons/${lesson.id}`}
                            className="inline-flex min-h-10 items-center gap-1 text-sm font-extrabold text-brand-700 hover:underline"
                          >
                            Open the lesson to generate one
                            <ArrowRight className="h-4 w-4 flex-none" aria-hidden="true" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <ClassSidePanel
          schoolClass={schoolClass}
          studentNames={students.map((student) => student.name)}
        />
      </div>
    </Page>
  );
}
