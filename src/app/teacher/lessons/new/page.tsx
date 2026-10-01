// New lesson: paste or upload a lesson and have the AI draft an activity.

import { MessageSquareText, NotebookPen, PencilLine } from "lucide-react";
import { LessonFlowArt } from "@/components/teacher/LessonArt";
import { LessonSteps, type LessonStep } from "@/components/teacher/LessonSteps";
import { NewLessonForm } from "@/components/teacher/NewLessonForm";
import { Card, Page, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/session";

const NEXT_STEPS: LessonStep[] = [
  {
    icon: <NotebookPen />,
    tone: "accent",
    title: "The AI writes a draft",
    text: "It reads your lesson and writes the items and their answer key.",
  },
  {
    icon: <PencilLine />,
    tone: "brand",
    title: "You review and edit",
    text: "Change anything, then publish. Students see nothing until you do.",
  },
  {
    icon: <MessageSquareText />,
    tone: "success",
    title: "Students answer",
    text: "Answers are graded with feedback, and you can change any score.",
  },
];

export default async function NewLessonPage() {
  await requireRole("teacher");

  return (
    <Page>
      <PageHeader
        title="New lesson"
        description="Add your lesson and the AI will draft an activity from it. You review and edit the draft before students see anything."
        back={{ href: "/teacher", label: "Back to class" }}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
        <NewLessonForm />
        <aside aria-labelledby="next-steps-title" className="lg:sticky lg:top-6">
          <Card className="animate-rise" style={{ animationDelay: "160ms" }}>
            <LessonFlowArt className="mx-auto mb-3 h-24 w-full max-w-60" />
            <h2 id="next-steps-title" className="text-lg font-extrabold text-ink">
              What happens next
            </h2>
            <LessonSteps steps={NEXT_STEPS} className="mt-4" />
          </Card>
        </aside>
      </div>
    </Page>
  );
}
