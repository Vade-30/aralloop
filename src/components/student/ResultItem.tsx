// One graded item: the question, the answer that was given, the correct
// answer, the feedback and who decided the score. It shows the answer key, so
// it must only be rendered for an activity the student has already submitted.

import {
  CircleCheck,
  Eye,
  Hourglass,
  KeyRound,
  Lightbulb,
  MessageCircle,
  PenLine,
  UserCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { AiLabel, Badge, OutcomeTile, cn, formatScore } from "@/components/ui";
import {
  ITEM_TYPE_LABELS,
  type AiProviderName,
  type Answer,
  type Item,
} from "@/lib/types";
import { OUTCOMES, outcomeOf } from "./outcome";

/** Cards rise one after another; later ones do not wait any longer than this. */
const STAGGER_MS = 70;
const STAGGER_MAX_STEPS = 8;

const CHIP_ICON = "h-3.5 w-3.5";

function GradedBy({ answer, provider }: { answer: Answer; provider: AiProviderName }) {
  switch (answer.gradedBy) {
    case "code":
      return (
        <Badge>
          <KeyRound className={CHIP_ICON} aria-hidden="true" />
          Checked by answer key
        </Badge>
      );
    case "ai":
      return <AiLabel provider={provider}>Graded by AI</AiLabel>;
    case "teacher":
      return (
        <Badge tone="brand">
          <UserCheck className={CHIP_ICON} aria-hidden="true" />
          Set by teacher
        </Badge>
      );
    case "pending":
      return (
        <Badge tone="warning">
          <Hourglass className={CHIP_ICON} aria-hidden="true" />
          Waiting for teacher
        </Badge>
      );
  }
}

/** One labelled part of the result: a term and its text, with an icon. */
function Row({
  label,
  icon,
  className,
  children,
}: {
  label: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 rounded-2xl border-2 px-3.5 py-3", className)}>
      <dt className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-muted [&>svg]:h-4 [&>svg]:w-4 [&>svg]:flex-none">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-[15px] font-bold leading-relaxed text-ink">
        {children}
      </dd>
    </div>
  );
}

export function ResultItem({
  item,
  answer,
  provider,
  answerLabel,
}: {
  item: Item;
  /** Undefined if nothing was stored for this item. */
  answer: Answer | undefined;
  /** The AI service that graded this submission, for the "Graded by AI" label. */
  provider: AiProviderName;
  /** "Your answer" for the student, "{name}'s answer" for a parent. */
  answerLabel: string;
}) {
  const outcomeName = outcomeOf(item, answer);
  const outcome = OUTCOMES[outcomeName];
  const response = answer?.response.trim() ?? "";
  const delay = Math.min(Math.max(item.position - 1, 0), STAGGER_MAX_STEPS) * STAGGER_MS;

  return (
    <li
      className="animate-rise rounded-3xl border-2 border-line bg-white p-4 shadow-edge sm:p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <OutcomeTile outcome={outcomeName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <p className="text-xs font-black uppercase tracking-wider text-brand-600">
              Question {item.position} · {ITEM_TYPE_LABELS[item.type]}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={outcome.tone}>{outcome.label}</Badge>
              <span className="font-display text-lg font-extrabold leading-none text-ink">
                {formatScore(answer?.score ?? 0)} / {formatScore(item.points)}
              </span>
            </div>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-base font-extrabold leading-snug text-ink sm:text-lg">
            {item.question}
          </p>
        </div>
      </div>

      {/* The two answers sit side by side where there is room, to compare them. */}
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Row
          label={answerLabel}
          icon={<PenLine aria-hidden="true" />}
          className={outcome.panel}
        >
          {response ? response : <span className="font-semibold italic text-muted">No answer</span>}
        </Row>
        <Row
          label={item.type === "short_answer" ? "Model answer" : "Correct answer"}
          icon={<CircleCheck className="text-emerald-600" aria-hidden="true" />}
          className="border-line bg-white"
        >
          {item.answerKey}
          {item.acceptedAnswers.length > 0 && (
            <span className="mt-0.5 block text-sm font-semibold text-muted">
              Also accepted: {item.acceptedAnswers.join(", ")}
            </span>
          )}
        </Row>
        {answer?.feedback && (
          <Row
            label="Feedback"
            icon={<MessageCircle className="text-brand-600" aria-hidden="true" />}
            className="border-line bg-canvas sm:col-span-2"
          >
            {answer.feedback}
          </Row>
        )}
        {item.explanation && (
          <Row
            label="Explanation"
            icon={<Lightbulb className="text-accent-600" aria-hidden="true" />}
            className="border-transparent bg-brand-50 sm:col-span-2"
          >
            {item.explanation}
          </Row>
        )}
      </dl>

      {answer && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <GradedBy answer={answer} provider={provider} />
          {answer.needsReview && answer.gradedBy !== "pending" && (
            <Badge tone="warning">
              <Eye className={CHIP_ICON} aria-hidden="true" />
              Teacher is checking
            </Badge>
          )}
        </div>
      )}
    </li>
  );
}
