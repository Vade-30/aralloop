// Results page: every student in the class, and for those who submitted,
// each answer with how it was graded and a form to change the score.

import {
  Clock,
  Eye,
  Hourglass,
  KeyRound,
  ListChecks,
  MessageSquareText,
  SpellCheck,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  ITEM_TYPE_LABELS,
  type AiProviderName,
  type Answer,
  type Item,
  type SubmissionWithAnswers,
  type User,
} from "@/lib/types";
import {
  AiLabel,
  Avatar,
  Badge,
  OutcomeIcon,
  OutcomeTile,
  Score,
  ScoreRing,
  cn,
} from "@/components/ui";
import { OverrideForm } from "./OverrideForm";
import { answerRows, formatPercent } from "./results-model";
import { OutcomeStrip, outcomeOf, type Outcome } from "./ResultsOutcome";
import { StudentDetails } from "./StudentDetails";

const BADGE_ICON = "h-3.5 w-3.5 flex-none";
/** How the icon in a block's label is drawn. The block sets its size. */
const BLOCK_ICON = { strokeWidth: 3, "aria-hidden": true } as const;

function GradedBy({ answer, aiProvider }: { answer: Answer; aiProvider: AiProviderName }) {
  switch (answer.gradedBy) {
    case "code":
      return (
        <Badge>
          <KeyRound className={BADGE_ICON} aria-hidden="true" />
          Checked by answer key
        </Badge>
      );
    case "teacher":
      return (
        <Badge tone="brand">
          <UserCheck className={BADGE_ICON} aria-hidden="true" />
          Set by teacher
        </Badge>
      );
    case "pending":
      return (
        <Badge tone="warning">
          <Hourglass className={BADGE_ICON} aria-hidden="true" />
          Waiting for teacher
        </Badge>
      );
    case "ai":
      return (
        <>
          <AiLabel provider={aiProvider}>Graded by AI</AiLabel>
          {answer.confidence !== null && (
            <span className="inline-flex items-center gap-2 text-xs font-extrabold text-muted">
              Confidence {formatPercent(answer.confidence)}
              {/* Decorative: the percentage beside it says the same thing. */}
              <span
                aria-hidden="true"
                className="block h-2 w-14 overflow-hidden rounded-full bg-brand-100"
              >
                <span
                  className={cn(
                    "block h-full rounded-full",
                    answer.needsReview ? "bg-amber-500" : "bg-brand-600",
                  )}
                  style={{ width: formatPercent(Math.min(1, Math.max(0, answer.confidence))) }}
                />
              </span>
            </span>
          )}
        </>
      );
  }
}

/** Why a flagged answer is waiting for the teacher. A sample check is never called AI. */
function reviewReason(answer: Answer, aiProvider: AiProviderName): string {
  if (answer.gradedBy === "pending") {
    return "The AI could not grade this answer. Read it and set the score.";
  }
  if (aiProvider === "mock") {
    return "This is a sample check, not AI. Check it and save the score you agree with.";
  }
  return "The AI was not sure about this grade. Check it and save the score you agree with.";
}

// The student's answer takes the colour of how it turned out; the icon in its
// label says the same thing without colour.
const RESPONSE_TONES: Record<Outcome, { box: string; label: string }> = {
  full: { box: "border-emerald-200 bg-emerald-50", label: "text-emerald-800" },
  partial: { box: "border-amber-200 bg-amber-50", label: "text-amber-900" },
  none: { box: "border-red-200 bg-red-50", label: "text-red-800" },
  review: { box: "border-accent-300 bg-white", label: "text-amber-900" },
};

/**
 * Width of a block after the answer and the key. On a laptop the first one
 * fills the third column and any later one takes a row of its own.
 */
function extraSpan(index: number): string {
  return index === 0 ? "sm:col-span-2 lg:col-span-1" : "sm:col-span-2 lg:col-span-3";
}

function Block({
  label,
  icon,
  box = "border-line bg-white",
  labelClass = "text-muted",
  className,
  children,
}: {
  label: string;
  /** One icon; it is sized here. */
  icon: ReactNode;
  /** Border and background of the box. */
  box?: string;
  labelClass?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border-2 px-3 py-2.5", box, className)}>
      <dt
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:flex-none",
          labelClass,
        )}
      >
        {icon}
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-ink">
        {children}
      </dd>
    </div>
  );
}

function AnswerCard({
  answer,
  item,
  aiProvider,
}: {
  answer: Answer;
  item: Item;
  aiProvider: AiProviderName;
}) {
  const outcome = outcomeOf(answer, item);
  const responseTone = RESPONSE_TONES[outcome];
  const noAnswer = answer.response.trim() === "";
  const hasAccepted = item.acceptedAnswers.length > 0;
  const hasRubric = Boolean(item.rubric);
  const threeColumns = hasAccepted || hasRubric || Boolean(answer.feedback);

  return (
    <li
      className={cn(
        "rounded-2xl border-2 p-3 sm:p-4",
        // An answer waiting for the teacher stands out with an amber edge.
        answer.needsReview
          ? "border-accent-400 bg-accent-50 shadow-[0_4px_0_#f0b429]"
          : "border-line bg-canvas",
      )}
    >
      {/* The score keeps the top right corner while the chips wrap beside it. */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <OutcomeTile outcome={outcome} size="md" />
          <h4 className="font-display text-lg font-extrabold leading-none text-ink">
            Item {item.position}
          </h4>
          <Badge>{ITEM_TYPE_LABELS[item.type]}</Badge>
          {answer.needsReview && (
            <Badge tone="warning">
              <Eye className={BADGE_ICON} aria-hidden="true" />
              Needs your review
            </Badge>
          )}
        </div>
        <span className="flex h-9 flex-none items-center">
          <Score score={answer.score} max={item.points} />
        </span>
      </div>

      {answer.needsReview && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-accent-100 px-3 py-2 text-sm font-bold text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" strokeWidth={2.5} aria-hidden="true" />
          <span className="min-w-0">{reviewReason(answer, aiProvider)}</span>
        </p>
      )}

      <p className="mt-3 whitespace-pre-wrap break-words text-[15px] font-extrabold leading-snug text-ink">
        {item.question}
      </p>

      {/* The answer and the key sit side by side where there is room, to compare
          them. A laptop has room for a third column: the rubric or the other
          accepted answers when the item has them, otherwise the feedback. */}
      <dl className={cn("mt-3 grid gap-2.5 sm:grid-cols-2", threeColumns && "lg:grid-cols-3")}>
        <Block
          label="Student's answer"
          icon={<OutcomeIcon outcome={outcome} />}
          box={responseTone.box}
          labelClass={responseTone.label}
        >
          {noAnswer ? <span className="italic text-muted">No answer</span> : answer.response}
        </Block>
        <Block
          label={item.type === "short_answer" ? "Model answer" : "Correct answer"}
          icon={<KeyRound {...BLOCK_ICON} />}
        >
          {item.answerKey}
        </Block>
        {hasAccepted && (
          <Block
            label="Also accepted"
            icon={<SpellCheck {...BLOCK_ICON} />}
            className={extraSpan(0)}
          >
            {item.acceptedAnswers.join(", ")}
          </Block>
        )}
        {hasRubric && (
          <Block
            label="Rubric"
            icon={<ListChecks {...BLOCK_ICON} />}
            className={extraSpan(hasAccepted ? 1 : 0)}
          >
            {item.rubric}
          </Block>
        )}
        {answer.feedback && (
          <Block
            label="Feedback"
            icon={<MessageSquareText {...BLOCK_ICON} />}
            className={extraSpan((hasAccepted ? 1 : 0) + (hasRubric ? 1 : 0))}
          >
            {answer.feedback}
          </Block>
        )}
      </dl>

      {/* The closed form is one button and shares this row; the open form takes a row of its own. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <GradedBy answer={answer} aiProvider={aiProvider} />
        </div>
        {/* A pending answer's feedback is the "waiting for your teacher" placeholder.
            The form starts empty so that sentence is not saved with the score. */}
        <OverrideForm
          answerId={answer.id}
          points={item.points}
          score={answer.score}
          feedback={answer.gradedBy === "pending" ? "" : answer.feedback}
          needsReview={answer.needsReview}
        />
      </div>
    </li>
  );
}

// Avatars take turns through the palette so the list is easy to scan.
const AVATAR_TONES = ["brand", "accent", "soft"] as const;

export function StudentResults({
  students,
  submissions,
  items,
  aiProvider,
}: {
  students: User[];
  submissions: SubmissionWithAnswers[];
  items: Item[];
  /**
   * The AI service in use now. Only used for a submission that has no
   * recorded grading service; otherwise AI grades are labelled by the service
   * that really graded them (submission.gradingProvider).
   */
  aiProvider: AiProviderName;
}) {
  const byStudent = new Map(submissions.map((submission) => [submission.studentId, submission]));

  return (
    <ul className="space-y-3.5">
      {students.map((student, index) => {
        const submission = byStudent.get(student.id);
        const entrance = { animationDelay: `${index * 70}ms` };
        if (!submission) {
          return (
            <li
              key={student.id}
              style={entrance}
              className="flex min-h-14 animate-rise items-center gap-3 rounded-3xl border-2 border-dashed border-brand-200 px-4 py-3 sm:px-5"
            >
              <Avatar name={student.name} tone="soft" className="opacity-70" />
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h3 className="min-w-0 break-words text-base font-extrabold leading-tight text-muted sm:text-lg">
                  {student.name}
                </h3>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-muted">
                  <Clock className="h-4 w-4 flex-none" aria-hidden="true" />
                  Not submitted yet
                </span>
              </div>
            </li>
          );
        }

        const rows = answerRows(submission, items);
        const toReview = rows.filter((row) => row.answer.needsReview).length;
        const flagged = toReview > 0 || submission.needsReview;
        return (
          <li key={student.id} style={entrance} className="animate-rise">
            <StudentDetails
              defaultOpen={flagged}
              summary={
                <div className="flex items-center gap-3">
                  <Avatar name={student.name} tone={AVATAR_TONES[index % AVATAR_TONES.length]} />
                  <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-extrabold leading-tight text-ink sm:text-lg">
                        {student.name}
                      </h3>
                      <OutcomeStrip
                        className="mt-1.5"
                        outcomes={rows.map((row) => outcomeOf(row.answer, row.item))}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {flagged && (
                        <Badge tone="warning">
                          <Eye className={BADGE_ICON} aria-hidden="true" />
                          {toReview > 0 ? `${toReview} to review` : "To review"}
                        </Badge>
                      )}
                      {/* A phone has room for the badge; wider screens get the ring.
                          Only one of the two is ever displayed. */}
                      <span className="sm:hidden">
                        <Score score={submission.totalScore} max={submission.maxScore} />
                      </span>
                      <ScoreRing
                        score={submission.totalScore}
                        max={submission.maxScore}
                        size={72}
                        className="hidden sm:block"
                      />
                    </div>
                  </div>
                </div>
              }
            >
              <ul className="space-y-3.5">
                {rows.map(({ answer, item }) => (
                  <AnswerCard
                    key={answer.id}
                    answer={answer}
                    item={item}
                    aiProvider={submission.gradingProvider ?? aiProvider}
                  />
                ))}
              </ul>
            </StudentDetails>
          </li>
        );
      })}
    </ul>
  );
}
