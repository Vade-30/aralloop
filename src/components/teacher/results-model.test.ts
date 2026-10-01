// The numbers on the results page, checked against small hand-worked classes.

import { describe, expect, it } from "vitest";
import type { Answer, Item, SubmissionWithAnswers } from "@/lib/types";
import {
  answerRows,
  classAverage,
  countNeedingReview,
  formatPercent,
  itemAnalysis,
} from "./results-model";

function item(position: number, points: number): Item {
  return {
    id: `item-${position}`,
    activityId: "activity-1",
    position,
    type: "short_answer",
    question: `Question ${position}`,
    choices: null,
    answerKey: "Model answer",
    acceptedAnswers: [],
    rubric: null,
    explanation: null,
    points,
  };
}

function answer(itemId: string, score: number, needsReview = false): Answer {
  return {
    id: `answer-${itemId}-${score}-${needsReview}`,
    submissionId: "submission",
    itemId,
    response: "A response",
    score,
    feedback: "",
    gradedBy: needsReview ? "pending" : "code",
    confidence: null,
    needsReview,
  };
}

function submission(studentId: string, answers: Answer[], maxScore: number): SubmissionWithAnswers {
  return {
    id: `submission-${studentId}`,
    activityId: "activity-1",
    studentId,
    totalScore: answers.reduce((sum, entry) => sum + entry.score, 0),
    maxScore,
    needsReview: answers.some((entry) => entry.needsReview),
    summary: null,
    summaryProvider: null,
    submittedAt: "2026-10-02T01:00:00.000Z",
    answers,
  };
}

// Item 1 is worth 1 point, item 2 is worth 2, item 3 is worth 1.
const items = [item(1, 1), item(2, 2), item(3, 1)];

describe("itemAnalysis", () => {
  it("counts only full points, and flags the lowest item as most missed", () => {
    const submissions = [
      submission("a", [answer("item-1", 1), answer("item-2", 2), answer("item-3", 1)], 4),
      submission("b", [answer("item-1", 1), answer("item-2", 1), answer("item-3", 1)], 4),
      submission("c", [answer("item-1", 0), answer("item-2", 1.5), answer("item-3", 1)], 4),
    ];
    const stats = itemAnalysis(items, submissions);
    expect(stats.map((stat) => stat.fullCount)).toEqual([2, 1, 3]);
    expect(stats.map((stat) => stat.share)).toEqual([2 / 3, 1 / 3, 1]);
    expect(stats.map((stat) => stat.mostMissed)).toEqual([false, true, false]);
  });

  it("flags every item that ties for the lowest share", () => {
    const submissions = [
      submission("a", [answer("item-1", 0), answer("item-2", 0), answer("item-3", 1)], 4),
      submission("b", [answer("item-1", 0), answer("item-2", 0), answer("item-3", 1)], 4),
    ];
    expect(itemAnalysis(items, submissions).map((stat) => stat.mostMissed)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("flags nothing with fewer than two submissions", () => {
    const one = [submission("a", [answer("item-1", 0), answer("item-2", 2), answer("item-3", 1)], 4)];
    expect(itemAnalysis(items, one).some((stat) => stat.mostMissed)).toBe(false);
  });

  it("flags nothing when everyone earned full points on every item", () => {
    const perfect = ["a", "b"].map((student) =>
      submission(student, [answer("item-1", 1), answer("item-2", 2), answer("item-3", 1)], 4),
    );
    expect(itemAnalysis(items, perfect).some((stat) => stat.mostMissed)).toBe(false);
  });

  it("has no share before anyone submits", () => {
    expect(itemAnalysis(items, []).map((stat) => stat.share)).toEqual([null, null, null]);
  });

  it("counts a missing answer as not earned", () => {
    const submissions = [
      submission("a", [answer("item-1", 1)], 4),
      submission("b", [answer("item-1", 1), answer("item-2", 2), answer("item-3", 1)], 4),
    ];
    expect(itemAnalysis(items, submissions).map((stat) => stat.fullCount)).toEqual([2, 1, 1]);
  });
});

describe("classAverage", () => {
  it("is the mean of each student's share of the maximum", () => {
    const submissions = [
      submission("a", [answer("item-1", 1), answer("item-2", 2), answer("item-3", 1)], 4),
      submission("b", [answer("item-1", 1), answer("item-2", 1)], 4),
    ];
    expect(classAverage(submissions)).toBe(0.75);
  });

  it("is null with no submissions and survives a zero maximum", () => {
    expect(classAverage([])).toBeNull();
    expect(classAverage([submission("a", [], 0)])).toBe(0);
  });
});

describe("countNeedingReview", () => {
  it("counts flagged answers across the class", () => {
    const submissions = [
      submission("a", [answer("item-1", 1), answer("item-2", 0, true)], 4),
      submission("b", [answer("item-2", 0, true), answer("item-3", 0, true)], 4),
    ];
    expect(countNeedingReview(submissions)).toBe(3);
  });
});

describe("answerRows", () => {
  it("lists answers waiting for review first, then follows the item order", () => {
    const rows = answerRows(
      submission(
        "a",
        [answer("item-3", 1), answer("item-1", 1), answer("item-2", 0, true)],
        4,
      ),
      items,
    );
    expect(rows.map((row) => row.item.position)).toEqual([2, 1, 3]);
  });

  it("skips an answer whose item is gone", () => {
    const rows = answerRows(submission("a", [answer("item-9", 1), answer("item-1", 1)], 4), items);
    expect(rows.map((row) => row.item.id)).toEqual(["item-1"]);
  });
});

describe("formatPercent", () => {
  it("rounds to a whole percentage", () => {
    expect([formatPercent(0), formatPercent(0.826), formatPercent(1)]).toEqual([
      "0%",
      "83%",
      "100%",
    ]);
  });
});
