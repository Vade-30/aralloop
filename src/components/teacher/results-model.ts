// Class statistics for the results page. Plain arithmetic over the stored
// submissions: no AI is involved in any number shown there.

import type { Answer, Item, SubmissionWithAnswers } from "@/lib/types";

export interface ItemStat {
  item: Item;
  /** Submissions that earned full points on this item. */
  fullCount: number;
  /** 0..1, or null when nobody has submitted yet. */
  share: number | null;
  mostMissed: boolean;
}

/** "Most missed" needs at least this many submissions to mean anything. */
const MOST_MISSED_MIN_SUBMISSIONS = 2;

/**
 * For each item, the share of submissions that earned full points. An answer
 * still waiting for the teacher counts as not earned yet.
 */
export function itemAnalysis(items: Item[], submissions: SubmissionWithAnswers[]): ItemStat[] {
  const total = submissions.length;
  const stats = items.map((item) => {
    const fullCount = submissions.filter((submission) =>
      submission.answers.some(
        (answer) => answer.itemId === item.id && answer.score >= item.points,
      ),
    ).length;
    return { item, fullCount, share: total > 0 ? fullCount / total : null, mostMissed: false };
  });

  if (total >= MOST_MISSED_MIN_SUBMISSIONS && stats.length > 0) {
    const lowest = Math.min(...stats.map((stat) => stat.fullCount));
    // When everyone got everything right, nothing was missed.
    if (lowest < total) {
      for (const stat of stats) stat.mostMissed = stat.fullCount === lowest;
    }
  }
  return stats;
}

/** Mean of each student's score as a share of the maximum, 0..1. Null if none. */
export function classAverage(submissions: SubmissionWithAnswers[]): number | null {
  if (submissions.length === 0) return null;
  const sum = submissions.reduce(
    (acc, submission) =>
      acc + (submission.maxScore > 0 ? submission.totalScore / submission.maxScore : 0),
    0,
  );
  return sum / submissions.length;
}

/** Answers across the class that still wait for the teacher. */
export function countNeedingReview(submissions: SubmissionWithAnswers[]): number {
  return submissions.reduce(
    (acc, submission) => acc + submission.answers.filter((answer) => answer.needsReview).length,
    0,
  );
}

export interface AnswerRow {
  answer: Answer;
  item: Item;
}

/**
 * A student's answers paired with their items: the ones waiting for review
 * first, then in the order of the activity. Answers whose item no longer
 * exists are skipped.
 */
export function answerRows(submission: SubmissionWithAnswers, items: Item[]): AnswerRow[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const rows: AnswerRow[] = [];
  for (const answer of submission.answers) {
    const item = byId.get(answer.itemId);
    if (item) rows.push({ answer, item });
  }
  return rows.sort(
    (a, b) =>
      Number(b.answer.needsReview) - Number(a.answer.needsReview) ||
      a.item.position - b.item.position,
  );
}

/** 0.826 -> "83%". */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
