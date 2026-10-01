// One activity. A draft opens in the editor; a published activity is shown
// read-only with its answer key and a link to the results.

import { notFound } from "next/navigation";
import { ActivityEditor } from "@/components/teacher/ActivityEditor";
import { PublishedActivity } from "@/components/teacher/PublishedActivity";
import { ButtonLink, Page, PageHeader } from "@/components/ui";
import { getActivity, getLesson } from "@/lib/db/repo";
import { requireRole } from "@/lib/session";

export default async function ActivityPage(props: PageProps<"/teacher/activities/[activityId]">) {
  const user = await requireRole("teacher");
  const { activityId } = await props.params;

  const activity = await getActivity(activityId);
  if (!activity || activity.classId !== user.classId) notFound();
  const lesson = await getLesson(activity.lessonId);
  const lessonTitle = lesson?.title ?? "Lesson";
  const back = { href: "/teacher", label: "Back to class" };

  if (activity.status === "draft") {
    return (
      <Page>
        <PageHeader
          title="Review the draft"
          description="Edit anything the AI wrote, then publish it to your class."
          back={back}
        />
        {/* Keyed so a different activity never inherits this one's edits. */}
        <ActivityEditor key={activity.id} activity={activity} lessonTitle={lessonTitle} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={activity.title}
        description={`From the lesson: ${lessonTitle}`}
        back={back}
        actions={
          <ButtonLink href={`/teacher/activities/${activity.id}/results`}>View results</ButtonLink>
        }
      />
      <PublishedActivity activity={activity} />
    </Page>
  );
}
