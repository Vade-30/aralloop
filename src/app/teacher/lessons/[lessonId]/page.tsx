// One lesson: its text, the activities made from it, and a form to generate
// another activity.

import { FileText, NotebookPen, TriangleAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { ActivityList } from "@/components/teacher/ActivityList";
import { formatDate } from "@/components/teacher/format";
import { GenerateActivityForm } from "@/components/teacher/GenerateActivityForm";
import { Badge, Card, IconTile, Page, PageHeader, SectionTitle } from "@/components/ui";
import { LESSON_PROMPT_MAX } from "@/lib/ai/prompts";
import { getLesson, listActivities, listStudents } from "@/lib/db/repo";
import { requireRole } from "@/lib/session";

const count = new Intl.NumberFormat("en-PH");

export default async function LessonPage(props: PageProps<"/teacher/lessons/[lessonId]">) {
  const user = await requireRole("teacher");
  const { lessonId } = await props.params;

  const lesson = await getLesson(lessonId);
  if (!lesson || lesson.classId !== user.classId) notFound();

  const [classActivities, students] = await Promise.all([
    listActivities(user.classId),
    listStudents(user.classId),
  ]);
  const activities = classActivities.filter((activity) => activity.lessonId === lesson.id);
  const words = lesson.content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <Page>
      <PageHeader
        eyebrow="Lesson"
        title={lesson.title}
        description={`Lesson added ${formatDate(lesson.createdAt)}`}
        back={{ href: "/teacher", label: "Back to class" }}
      />

      {/* On a phone: activities, the generate form, then the lesson text. From
          lg up the form moves to a side column that stays in view. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:items-start">
        <section aria-labelledby="activities-title" className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <SectionTitle>
              <span id="activities-title">Activities</span>
            </SectionTitle>
            {activities.length > 0 && <Badge tone="brand">{activities.length}</Badge>}
          </div>
          {activities.length > 0 ? (
            <ActivityList activities={activities} studentCount={students.length} />
          ) : (
            <p className="animate-rise rounded-3xl border-2 border-dashed border-brand-200 bg-white px-4 py-6 text-center text-sm font-bold text-muted">
              This lesson has no activity yet.{" "}
              <span className="lg:hidden">Generate one below.</span>
              <span className="hidden lg:inline">Generate one with the form beside this.</span>
            </p>
          )}
        </section>

        <aside
          aria-labelledby="generate-title"
          className="min-w-0 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <Card className="animate-rise" style={{ animationDelay: "120ms" }}>
            <div className="flex items-center gap-3">
              <IconTile tone="accent">
                <NotebookPen />
              </IconTile>
              <h2 id="generate-title" className="min-w-0 text-xl font-extrabold leading-tight text-ink">
                {activities.length > 0 ? "Generate another activity" : "Generate an activity"}
              </h2>
            </div>
            <p className="mb-4 mt-3 text-sm font-semibold text-muted">
              The AI writes a draft from this lesson. Students see nothing until you review and
              publish it.
            </p>
            {lesson.content.length > LESSON_PROMPT_MAX && (
              <p className="mb-4 flex items-start gap-2 rounded-2xl border-2 border-accent-200 bg-accent-50 px-3 py-2.5 text-[13px] font-bold text-amber-900">
                <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                <span>
                  This lesson is long, so the AI reads about the first{" "}
                  {count.format(LESSON_PROMPT_MAX)} characters and the last part may not be covered.
                </span>
              </p>
            )}
            <GenerateActivityForm lessonId={lesson.id} hasActivities={activities.length > 0} />
          </Card>
        </aside>

        <section aria-labelledby="lesson-text-title" className="min-w-0 lg:col-start-1 lg:row-start-2">
          <Card className="animate-rise" style={{ animationDelay: "180ms" }}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b-2 border-line pb-4">
              <IconTile tone="soft">
                <FileText />
              </IconTile>
              <div className="min-w-0">
                <SectionTitle>
                  <span id="lesson-text-title">Lesson text</span>
                </SectionTitle>
                <p className="text-xs font-bold text-muted">
                  {count.format(words)} {words === 1 ? "word" : "words"} ·{" "}
                  {count.format(lesson.content.length)} characters
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-[68ch] whitespace-pre-wrap break-words text-[15px] font-medium leading-7 text-ink sm:text-base">
              {lesson.content}
            </p>
          </Card>
        </section>
      </div>
    </Page>
  );
}
