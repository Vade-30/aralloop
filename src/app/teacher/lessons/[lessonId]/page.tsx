// One lesson: its text, the activities made from it, and a form to generate
// another activity.

import { notFound } from "next/navigation";
import { ActivityList } from "@/components/teacher/ActivityList";
import { formatDate } from "@/components/teacher/format";
import { GenerateActivityForm } from "@/components/teacher/GenerateActivityForm";
import { Card, Page, PageHeader, SectionTitle } from "@/components/ui";
import { LESSON_PROMPT_MAX } from "@/lib/ai/prompts";
import { getLesson, listActivities, listStudents } from "@/lib/db/repo";
import { requireRole } from "@/lib/session";

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

  return (
    <Page>
      <PageHeader
        title={lesson.title}
        description={`Lesson added ${formatDate(lesson.createdAt)}`}
        back={{ href: "/teacher", label: "Back to class" }}
      />

      <section className="mb-6">
        <SectionTitle className="mb-3">Activities</SectionTitle>
        {activities.length > 0 ? (
          <ActivityList activities={activities} studentCount={students.length} />
        ) : (
          <p className="text-sm text-slate-600">
            This lesson has no activity yet. Generate one below.
          </p>
        )}
      </section>

      <Card className="mb-6">
        <SectionTitle>
          {activities.length > 0 ? "Generate another activity" : "Generate an activity"}
        </SectionTitle>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          The AI writes a draft from this lesson. Students see nothing until you review and
          publish it.
          {lesson.content.length > LESSON_PROMPT_MAX &&
            ` This lesson is long, so the AI reads about the first ${LESSON_PROMPT_MAX.toLocaleString("en-PH")} characters and the last part may not be covered.`}
        </p>
        <GenerateActivityForm lessonId={lesson.id} hasActivities={activities.length > 0} />
      </Card>

      <section>
        <SectionTitle className="mb-3">Lesson text</SectionTitle>
        <Card>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
            {lesson.content}
          </p>
        </Card>
      </section>
    </Page>
  );
}
