// Teacher dashboard: the class, its lessons and each lesson's activities.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityList } from "@/components/teacher/ActivityList";
import { formatDate, plural } from "@/components/teacher/format";
import { ButtonLink, Card, EmptyState, Page, PageHeader, SectionTitle } from "@/components/ui";
import { getClass, listActivities, listLessons, listStudents } from "@/lib/db/repo";
import { requireRole } from "@/lib/session";
import type { ActivitySummary } from "@/lib/types";

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

  return (
    <Page>
      <PageHeader
        title={schoolClass.name}
        description={`${schoolClass.gradeLevel} · ${schoolClass.subject}`}
        actions={<ButtonLink href="/teacher/lessons/new">New lesson</ButtonLink>}
      />

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Join code</p>
          <p className="font-mono text-xl font-semibold tracking-widest text-slate-900">
            {schoolClass.joinCode}
          </p>
        </div>
        <p className="text-sm text-slate-600">{plural(students.length, "student")} in this class</p>
      </Card>

      <SectionTitle className="mb-3">Lessons</SectionTitle>
      {lessons.length === 0 ? (
        <EmptyState
          title="No lessons yet"
          description="Add a lesson and the AI will draft an activity from it for you to review."
          action={<ButtonLink href="/teacher/lessons/new">New lesson</ButtonLink>}
        />
      ) : (
        <ul className="space-y-4">
          {lessons.map((lesson) => {
            const lessonActivities = byLesson.get(lesson.id) ?? [];
            return (
              <li key={lesson.id}>
                <Card>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="min-w-0 break-words font-semibold text-slate-900">
                      <Link
                        href={`/teacher/lessons/${lesson.id}`}
                        className="inline-flex min-h-10 items-center hover:underline"
                      >
                        {lesson.title}
                      </Link>
                    </h3>
                    <p className="text-xs text-slate-500">Added {formatDate(lesson.createdAt)}</p>
                  </div>
                  {lessonActivities.length > 0 ? (
                    <ActivityList activities={lessonActivities} studentCount={students.length} />
                  ) : (
                    <p className="text-sm text-slate-600">
                      No activity yet.{" "}
                      <Link
                        href={`/teacher/lessons/${lesson.id}`}
                        className="inline-flex min-h-10 items-center font-medium text-brand-700 hover:underline"
                      >
                        Open the lesson to generate one
                      </Link>
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
