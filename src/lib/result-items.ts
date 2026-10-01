// Pairs an activity's items with what one student answered and scored: the
// shape the parent-summary and tutor AI tasks read.
//
// It carries the answer key, so it is built on the server only, and only for
// a submission that already exists.

import type { ResultItem } from "./ai";
import type { ActivityWithItems, SubmissionWithAnswers } from "./types";

/** Every item of the activity, in order, with the student's answer and score. */
export function toResultItems(
  activity: ActivityWithItems,
  submission: SubmissionWithAnswers,
): ResultItem[] {
  const answers = new Map(submission.answers.map((answer) => [answer.itemId, answer]));
  return activity.items.map((item) => {
    const answer = answers.get(item.id);
    return {
      position: item.position,
      type: item.type,
      question: item.question,
      correctAnswer: item.answerKey,
      response: answer?.response ?? "",
      score: answer?.score ?? 0,
      points: item.points,
      feedback: answer?.feedback ?? "",
    };
  });
}
