// One result for a parent: the plain-language summary in English or Filipino,
// the child's answers, and the AI helper. Only the linked child's submissions
// can be opened.

import { CalendarDays, ChevronDown, ListChecks } from "lucide-react";
import { notFound } from "next/navigation";
import { formatDate } from "@/components/parent/format";
import { SummaryPanel } from "@/components/parent/SummaryPanel";
import { RESULT_COLUMNS, RESULT_HELPER_COLUMN } from "@/components/result-layout";
import { ScoreHero } from "@/components/ScoreHero";
import { ResultItem } from "@/components/student/ResultItem";
import { questionsLabel } from "@/components/student/labels";
import { TutorChat } from "@/components/TutorChat";
import {
  AiLabel,
  Badge,
  IconTile,
  Page,
  PageHeader,
  SectionTitle,
  cn,
} from "@/components/ui";
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
        eyebrow={child.name}
        title={activity.title}
        description={lesson ? `Lesson: ${lesson.title}` : undefined}
        back={{ href: "/parent", label: "All results" }}
        overlap
      />

      {/* The score first: the ring, when it was answered, and each question at a glance. */}
      <ScoreHero
        score={submission.totalScore}
        max={submission.maxScore}
        title={`${child.name}'s score`}
        detail={
          <span className="flex items-center justify-center gap-1.5 sm:justify-start">
            <CalendarDays className="h-4 w-4 flex-none" aria-hidden="true" />
            Answered {formatDate(submission.submittedAt)}
          </span>
        }
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
            ? "The teacher is still checking some answers, so this score may change."
            : undefined
        }
        items={activity.items}
        answers={answers}
      />

      {/* On a laptop the helper sits beside the summary; on a phone it follows it. */}
      <div className={RESULT_COLUMNS}>
        <div className="min-w-0 animate-rise space-y-6 [animation-delay:100ms]">
          <SummaryPanel
            submissionId={submission.id}
            initialSummary={storedSummary}
            initialProvider={submission.summaryProvider ?? provider}
          />

          <details className="group rounded-3xl border-2 border-line bg-white shadow-edge">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-3xl px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
              <IconTile tone="soft">
                <ListChecks />
              </IconTile>
              <span className="min-w-0 flex-1 font-display text-lg font-extrabold leading-tight text-ink">
                Answers{" "}
                <span className="font-sans text-sm font-bold text-muted">
                  ({questionsLabel(activity.items.length)})
                </span>
              </span>
              <span className="inline-flex flex-none items-center gap-2 text-sm font-extrabold text-brand-700">
                <span className="group-open:hidden">Show</span>
                <span className="hidden group-open:inline">Hide</span>
                {/* The same chevron tile as the teacher's student cards. */}
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-50 transition-transform duration-200 group-open:rotate-180 sm:h-10 sm:w-10"
                >
                  <ChevronDown className="h-5 w-5" strokeWidth={3} />
                </span>
              </span>
            </summary>
            <ol className="space-y-3 rounded-b-[1.375rem] border-t-2 border-line bg-canvas p-3 sm:p-4">
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
        </div>

        <section
          aria-labelledby="helper-title"
          className={cn(RESULT_HELPER_COLUMN, "animate-rise [animation-delay:180ms]")}
        >
          <div className="mb-3 lg:min-h-16">
            <SectionTitle>
              <span id="helper-title">Have a question</span>
            </SectionTitle>
          </div>
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
        </section>
      </div>
    </Page>
  );
}
