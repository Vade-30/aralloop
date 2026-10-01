// One activity for a student. Before submission it is the answer form; after
// submission it is the results with feedback and the AI helper.
//
// The answer key rule: until the student has submitted, the only item data
// passed to a client component is PublicItem (see toPublicItem). The full
// items, with the answer key, are used on the results screen only.

import { notFound } from "next/navigation";
import { AnswerForm } from "@/components/student/AnswerForm";
import { ResultItem } from "@/components/student/ResultItem";
import { questionsLabel } from "@/components/student/labels";
import { TutorChat } from "@/components/TutorChat";
import {
  Alert,
  Badge,
  Card,
  Page,
  PageHeader,
  Score,
  SectionTitle,
} from "@/components/ui";
import { getAiStatus } from "@/lib/ai";
import { getActivity, getLesson, getSubmission } from "@/lib/db/repo";
import { requireRole } from "@/lib/session";
import {
  ACTIVITY_TYPE_LABELS,
  toPublicItem,
  type ActivityWithItems,
  type SubmissionWithAnswers,
} from "@/lib/types";

const BACK = { href: "/student", label: "All activities" };

/** Questions offered as buttons in the AI helper. */
function tutorSuggestions(
  activity: ActivityWithItems,
  submission: SubmissionWithAnswers,
): string[] {
  const scores = new Map(submission.answers.map((answer) => [answer.itemId, answer]));
  const missed = activity.items.find((item) => {
    const answer = scores.get(item.id);
    return answer && answer.gradedBy !== "pending" && answer.score < item.points;
  });
  return [
    missed
      ? `Why did I lose points on question ${missed.position}?`
      : "Can you give me a harder question about this lesson?",
    "Can you explain this lesson in simpler words?",
    "What should I review next?",
  ];
}

export default async function StudentActivityPage(
  props: PageProps<"/student/activities/[activityId]">,
) {
  const user = await requireRole("student");
  const { activityId } = await props.params;

  const activity = await getActivity(activityId);
  if (!activity || activity.status !== "published" || activity.classId !== user.classId) {
    notFound();
  }

  const [lesson, submission] = await Promise.all([
    getLesson(activity.lessonId),
    getSubmission(activity.id, user.id),
  ]);
  const description = lesson ? `Lesson: ${lesson.title}` : undefined;

  if (!submission) {
    // Strip the answer key, accepted answers, rubric and explanation.
    const publicItems = activity.items.map(toPublicItem);
    return (
      <Page>
        <PageHeader title={activity.title} description={description} back={BACK} />
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge tone="brand">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
            <span>{questionsLabel(publicItems.length)}</span>
          </div>
          {activity.instructions && (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">
              {activity.instructions}
            </p>
          )}
        </Card>
        <AnswerForm activityId={activity.id} items={publicItems} />
      </Page>
    );
  }

  const provider = getAiStatus().provider;
  // AI-graded answers are labelled by the service that graded them, which can
  // differ from the one configured now.
  const gradedBy = submission.gradingProvider ?? provider;
  const answers = new Map(submission.answers.map((answer) => [answer.itemId, answer]));

  return (
    <Page>
      <PageHeader title={activity.title} description={description} back={BACK} />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitle>Your score</SectionTitle>
          <Score score={submission.totalScore} max={submission.maxScore} />
        </div>
        {submission.needsReview && (
          <Alert tone="warning" className="mt-3">
            Teacher is checking some answers, so your score may change.
          </Alert>
        )}
      </Card>

      <SectionTitle className="mb-3">Your answers</SectionTitle>
      <ol className="mb-6 space-y-3">
        {activity.items.map((item) => (
          <ResultItem
            key={item.id}
            item={item}
            answer={answers.get(item.id)}
            provider={gradedBy}
            answerLabel="Your answer"
          />
        ))}
      </ol>

      <TutorChat
        submissionId={submission.id}
        provider={provider}
        intro="Hello. Ask me about any question in this activity, or about the lesson, and I will explain it."
        suggestions={tutorSuggestions(activity, submission)}
      />
    </Page>
  );
}
