// How each graded answer turned out, and the short line at the top of the
// results screen. Plain rules over the stored scores: no AI is involved.

import type { Answer, Item } from "@/lib/types";

export type Outcome = "full" | "partial" | "none" | "pending";

/** The order outcomes are listed in. */
export const OUTCOME_ORDER: Outcome[] = ["full", "partial", "none", "pending"];

/**
 * The words for each outcome, the tone of its chip, and the tint of a panel
 * that holds the answer. The icon and its tile come from the shared kit
 * (OutcomeTile), which uses the same four names.
 */
export const OUTCOMES: Record<
  Outcome,
  { label: string; tone: "success" | "warning" | "danger" | "neutral"; panel: string }
> = {
  full: { label: "Full points", tone: "success", panel: "border-emerald-200 bg-emerald-50" },
  partial: { label: "Partial points", tone: "warning", panel: "border-accent-200 bg-accent-50" },
  none: { label: "No points", tone: "danger", panel: "border-red-200 bg-red-50" },
  pending: { label: "Not graded yet", tone: "neutral", panel: "border-slate-200 bg-slate-50" },
};

/** Reads the item's points only, so a caller need not hold its answer key. */
export function outcomeOf(item: Pick<Item, "points">, answer: Answer | undefined): Outcome {
  if (!answer) return "none";
  if (answer.gradedBy === "pending") return "pending";
  if (answer.score >= item.points) return "full";
  return answer.score > 0 ? "partial" : "none";
}

/** How many items ended in each outcome. */
export function countOutcomes(
  items: Pick<Item, "id" | "points">[],
  answers: Map<string, Answer>,
): Record<Outcome, number> {
  const counts: Record<Outcome, number> = { full: 0, partial: 0, none: 0, pending: 0 };
  for (const item of items) counts[outcomeOf(item, answers.get(item.id))] += 1;
  return counts;
}

export interface ResultMessage {
  title: string;
  detail: string;
}

/**
 * The line beside the score. It follows the score but never scolds, and it
 * makes no claim about the score while answers still wait for the teacher.
 */
export function resultMessage(score: number, max: number, pendingCount: number): ResultMessage {
  if (pendingCount > 0) {
    return { title: "Score so far", detail: "Some answers are waiting for your teacher." };
  }
  const ratio = max > 0 ? score / max : 0;
  if (ratio >= 1) {
    return { title: "Perfect score", detail: "You got full points on every question." };
  }
  if (ratio >= 0.75) return { title: "Great work", detail: "You know this lesson well." };
  if (ratio >= 0.5) return { title: "Good work", detail: "A few things to review." };
  return { title: "Keep going", detail: "Read the feedback below, then ask the helper." };
}

/** 0.826 -> "83%". */
export function percentLabel(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
