// New lesson: paste or upload a lesson and have the AI draft an activity.

import { NewLessonForm } from "@/components/teacher/NewLessonForm";
import { Page, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/session";

export default async function NewLessonPage() {
  await requireRole("teacher");

  return (
    <Page>
      <PageHeader
        title="New lesson"
        description="Add your lesson and the AI will draft an activity from it. You review and edit the draft before students see anything."
        back={{ href: "/teacher", label: "Back to class" }}
      />
      <NewLessonForm />
    </Page>
  );
}
