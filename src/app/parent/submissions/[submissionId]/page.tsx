// One result for a parent: the plain-language summary in English or Filipino,
// the child's answers, and the AI helper. Only the linked child's submissions
// can be opened.

import { notFound } from "next/navigation";
import { formatDate } from "@/components/parent/format";
import { SummaryPanel } from "@/components/parent/SummaryPanel";
import { ResultItem } from "@/components/student/ResultItem";
import { questionsLabel } from "@/components/student/labels";
import { TutorChat } from "@/components/TutorChat";
import { AiLabel, Alert, Card, Page, PageHeader, Score, SectionTitle } from "@/components/ui";
import { getAiStatus } from "@/lib/ai";
import { getActivity, getLesson, getSubmissionById, getUser } from "@/lib/db/repo";
import { requireRole } from "@/lib/session";

export default async function ParentSubmissionPage(
  props: PageProps<"/parent/submissions/[submissionId]">,
) {
  const user = await requireRole("parent");
  const { submissionId } = await props.params;

  const submission = await getSubmissionById(submissionId);
  if (!submission || !user.childId || submission.studentId !== user.childId) {
    notFound();
  }

  const [activity, child] = await Promise.all([
    getActivity(submission.activityId),
    getUser(submission.studentId),
  ]);
  if (!activity || !child) notFound();

  const lesson = await getLesson(activity.lessonId);
  const provider = getAiStatus().provider;
  // AI-graded answers are labelled by the service that graded them, which can
  // differ from the one configured now.
  const gradedBy = submission.gradingProvider ?? provider;
  const answers = new Map(submission.answers.map((answer) => [answer.itemId, answer]));
  // A summary with no recorded writer is treated as missing, as the API does,
  // so it is never shown under the wrong label.
  const storedSummary = submission.summaryProvider ? submission.summary : null;

  return (
    <Page>
      <PageHeader
        title={activity.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {lesson && `Lesson: ${lesson.title}`}
            <AiLabel provider={activity.aiProvider}>AI-drafted · reviewed by teacher</AiLabel>
          </span>
        }
        back={{ href: "/parent", label: "All results" }}
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitle>{child.name}&apos;s score</SectionTitle>
          <Score score={submission.totalScore} max={submission.maxScore} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Answered {formatDate(submission.submittedAt)}
        </p>
        {submission.needsReview && (
          <Alert tone="warning" className="mt-3">
            The teacher is still checking some answers, so this score may change.
          </Alert>
        )}
      </Card>

      <Card className="mb-4">
        <SummaryPanel
          submissionId={submission.id}
          initialSummary={storedSummary}
          initialProvider={submission.summaryProvider ?? provider}
        />
      </Card>

      <details className="group mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3 font-semibold text-slate-900 sm:px-5">
          <span>
            Answers{" "}
            <span className="font-normal text-slate-600">
              ({questionsLabel(activity.items.length)})
            </span>
          </span>
          <span className="text-sm font-medium text-brand-700 group-open:hidden">Show</span>
          <span className="hidden text-sm font-medium text-brand-700 group-open:inline">
            Hide
          </span>
        </summary>
        <ol className="space-y-3 border-t border-slate-200 bg-slate-50 p-3 sm:p-4">
          {activity.items.map((item) => (
            <ResultItem
              key={item.id}
              item={item}
              answer={answers.get(item.id)}
              provider={gradedBy}
              answerLabel={`${child.name}'s answer`}
            />
          ))}
        </ol>
      </details>

      <TutorChat
        submissionId={submission.id}
        provider={provider}
        intro={`Hello. Ask me how ${child.name} did on this activity, or how you can help at home.`}
        suggestions={[
          "How can I help my child practise this at home?",
          "Which part of the lesson should we review first?",
          "Can you explain this lesson in simple words?",
        ]}
      />
    </Page>
  );
}
