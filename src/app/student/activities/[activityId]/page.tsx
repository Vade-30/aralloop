// One activity for a student. Before submission it is the answer form; after
// submission it is the results with feedback and the AI helper.
//
// The answer key rule: until the student has submitted, the only item data
// passed to a client component is PublicItem (see toPublicItem). The full
// items, with the answer key, are used on the results screen only.

import { ClipboardList, ListChecks } from "lucide-react";
import { notFound } from "next/navigation";
import { RESULT_COLUMNS, RESULT_HELPER_COLUMN } from "@/components/result-layout";
import { ScoreHero } from "@/components/ScoreHero";
import { AnswerForm } from "@/components/student/AnswerForm";
import { ANSWER_GRID, ANSWER_INFO_SLOT } from "@/components/student/answer-layout";
import { ResultItem } from "@/components/student/ResultItem";
import { pointsLabel, questionsLabel } from "@/components/student/labels";
import { countOutcomes, resultMessage } from "@/components/student/outcome";
import { TutorChat } from "@/components/TutorChat";
import {
  AiLabel,
  Badge,
  Card,
  IconTile,
  Page,
  PageHeader,
  SectionTitle,
  cn,
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
    const totalPoints = publicItems.reduce((sum, item) => sum + item.points, 0);
    return (
      <Page>
        <PageHeader
          eyebrow="Activity"
          title={activity.title}
          description={description}
          back={BACK}
          overlap
        />
        {/* The form's question card and question list take their places in this grid. */}
        <div className={ANSWER_GRID}>
          <Card className={cn(ANSWER_INFO_SLOT, "animate-rise")}>
            {activity.instructions && (
              <>
                <div className="flex items-center gap-3">
                  <IconTile tone="accent">
                    <ClipboardList />
                  </IconTile>
                  <p className="text-xs font-black uppercase tracking-wider text-brand-600">
                    Instructions
                  </p>
                </div>
                <p className="mb-4 mt-3 whitespace-pre-wrap break-words text-[15px] font-bold leading-relaxed text-ink">
                  {activity.instructions}
                </p>
              </>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
              <Badge tone="info">{questionsLabel(publicItems.length)}</Badge>
              <Badge tone="info">{pointsLabel(totalPoints)}</Badge>
              {/* Only the provider name goes in: nothing from the answer key. */}
              <AiLabel provider={activity.aiProvider}>AI-drafted · reviewed by teacher</AiLabel>
            </div>
          </Card>
          <AnswerForm activityId={activity.id} items={publicItems} />
        </div>
      </Page>
    );
  }

  const provider = getAiStatus().provider;
  // AI-graded answers are labelled by the service that graded them, which can
  // differ from the one configured now.
  const gradedBy = submission.gradingProvider ?? provider;
  const answers = new Map(submission.answers.map((answer) => [answer.itemId, answer]));
  const counts = countOutcomes(activity.items, answers);
  const message = resultMessage(submission.totalScore, submission.maxScore, counts.pending);

  return (
    <Page>
      <PageHeader
        eyebrow="Your results"
        title={activity.title}
        description={description}
        back={BACK}
        overlap
      />

      {/* The same score card the parent sees: the ring, then each question at a glance. */}
      <ScoreHero
        score={submission.totalScore}
        max={submission.maxScore}
        eyebrow="Your score"
        title={message.title}
        detail={message.detail}
        chips={
          <>
            <Badge tone="info">
              <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
              {questionsLabel(activity.items.length)}
            </Badge>
            <AiLabel provider={activity.aiProvider}>AI-drafted · reviewed by teacher</AiLabel>
          </>
        }
        notice={
          submission.needsReview
            ? "Teacher is checking some answers, so your score may change."
            : undefined
        }
        items={activity.items}
        answers={answers}
      />

      {/* On a laptop the helper sits beside the answers. */}
      <div className={RESULT_COLUMNS}>
        <section aria-labelledby="answers-title" className="min-w-0">
          <SectionTitle className="mb-3">
            <span id="answers-title">Your answers</span>
          </SectionTitle>
          <ol className="space-y-4">
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
        </section>

        <section aria-labelledby="helper-title" className={RESULT_HELPER_COLUMN}>
          <SectionTitle className="mb-3">
            <span id="helper-title">Need more help</span>
          </SectionTitle>
          <TutorChat
            submissionId={submission.id}
            provider={provider}
            intro="Hello. Ask me about any question in this activity, or about the lesson, and I will explain it."
            suggestions={tutorSuggestions(activity, submission)}
          />
        </section>
      </div>
    </Page>
  );
}
