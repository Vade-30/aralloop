// One graded item: the question, the answer that was given, the correct
// answer, the feedback and who decided the score. It shows the answer key, so
// it must only be rendered for an activity the student has already submitted.

import type { ReactNode } from "react";
import { AiLabel, Badge, formatScore } from "@/components/ui";
import {
  ITEM_TYPE_LABELS,
  type AiProviderName,
  type Answer,
  type Item,
} from "@/lib/types";

type Outcome = "full" | "partial" | "none" | "pending";

const OUTCOMES: Record<
  Outcome,
  { label: string; tone: "success" | "warning" | "danger" | "neutral" }
> = {
  full: { label: "Full points", tone: "success" },
  partial: { label: "Partial points", tone: "warning" },
  none: { label: "No points", tone: "danger" },
  pending: { label: "Not graded yet", tone: "neutral" },
};

function outcomeOf(item: Item, answer: Answer | undefined): Outcome {
  if (!answer) return "none";
  if (answer.gradedBy === "pending") return "pending";
  if (answer.score >= item.points) return "full";
  return answer.score > 0 ? "partial" : "none";
}

function GradedBy({ answer, provider }: { answer: Answer; provider: AiProviderName }) {
  switch (answer.gradedBy) {
    case "code":
      return <Badge>Checked by answer key</Badge>;
    case "ai":
      return <AiLabel provider={provider}>Graded by AI</AiLabel>;
    case "teacher":
      return <Badge tone="brand">Set by teacher</Badge>;
    case "pending":
      return <Badge tone="warning">Waiting for teacher</Badge>;
  }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-slate-900">{children}</dd>
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
  /** The AI service in use, for the "Graded by AI" label. */
  provider: AiProviderName;
  /** "Your answer" for the student, "{name}'s answer" for a parent. */
  answerLabel: string;
}) {
  const outcome = OUTCOMES[outcomeOf(item, answer)];
  const response = answer?.response.trim() ?? "";

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">
          Question {item.position} · {ITEM_TYPE_LABELS[item.type]}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={outcome.tone}>{outcome.label}</Badge>
          <span className="text-sm font-semibold text-slate-900">
            {formatScore(answer?.score ?? 0)} / {formatScore(item.points)}
          </span>
        </div>
      </div>

      <p className="mt-2 whitespace-pre-wrap break-words text-base font-medium text-slate-900">
        {item.question}
      </p>

      <dl className="mt-3 space-y-3 text-sm">
        <Row label={answerLabel}>
          {response ? response : <span className="italic text-slate-500">No answer</span>}
        </Row>
        <Row label={item.type === "short_answer" ? "Model answer" : "Correct answer"}>
          {item.answerKey}
          {item.acceptedAnswers.length > 0 && (
            <span className="block text-slate-600">
              Also accepted: {item.acceptedAnswers.join(", ")}
            </span>
          )}
        </Row>
        {answer?.feedback && <Row label="Feedback">{answer.feedback}</Row>}
        {item.explanation && <Row label="Explanation">{item.explanation}</Row>}
      </dl>

      {answer && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <GradedBy answer={answer} provider={provider} />
          {answer.needsReview && answer.gradedBy !== "pending" && (
            <Badge tone="warning">Teacher is checking</Badge>
          )}
        </div>
      )}
    </li>
  );
}
