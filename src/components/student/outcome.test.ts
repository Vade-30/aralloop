// The rules behind the results screen: how one answer turned out, the counts
// in the score card, and the line beside the score.

import { describe, expect, it } from "vitest";
import type { Answer, Item } from "@/lib/types";
import { countOutcomes, outcomeOf, percentLabel, resultMessage } from "./outcome";

function item(id: string, points: number): Item {
  return {
    id,
    activityId: "activity-1",
    position: 1,
    type: "short_answer",
    question: "Why?",
    choices: null,
    answerKey: "Because.",
    acceptedAnswers: [],
    rubric: null,
    explanation: null,
    points,
  };
}

function answer(itemId: string, score: number, gradedBy: Answer["gradedBy"] = "ai"): Answer {
  return {
    id: `answer-${itemId}`,
    submissionId: "submission-1",
    itemId,
    response: "Something",
    score,
    feedback: "",
    gradedBy,
    confidence: null,
    needsReview: false,
  };
}

describe("outcomeOf", () => {
  it("sorts a graded answer by its share of the points", () => {
    expect(outcomeOf(item("a", 2), answer("a", 2))).toBe("full");
    expect(outcomeOf(item("a", 2), answer("a", 1))).toBe("partial");
    expect(outcomeOf(item("a", 2), answer("a", 0))).toBe("none");
  });

  it("treats a missing answer as no points", () => {
    expect(outcomeOf(item("a", 2), undefined)).toBe("none");
  });

  it("does not judge an answer the teacher has not graded yet", () => {
    expect(outcomeOf(item("a", 2), answer("a", 0, "pending"))).toBe("pending");
  });
});

describe("countOutcomes", () => {
  it("counts every item once, answered or not", () => {
    const items = [item("a", 1), item("b", 2), item("c", 2), item("d", 1), item("e", 1)];
    const answers = new Map(
      [
        answer("a", 1),
        answer("b", 1),
        answer("c", 0),
        answer("d", 0, "pending"),
      ].map((entry) => [entry.itemId, entry]),
    );
    expect(countOutcomes(items, answers)).toEqual({ full: 1, partial: 1, none: 2, pending: 1 });
  });
});

describe("resultMessage", () => {
  it("follows the score", () => {
    expect(resultMessage(10, 10, 0).title).toBe("Perfect score");
    expect(resultMessage(8, 10, 0).title).toBe("Great work");
    expect(resultMessage(7.5, 10, 0).title).toBe("Great work");
    expect(resultMessage(5, 10, 0)).toEqual({
      title: "Good work",
      detail: "A few things to review.",
    });
    expect(resultMessage(2, 10, 0).title).toBe("Keep going");
    expect(resultMessage(0, 0, 0).title).toBe("Keep going");
  });

  it("makes no claim about the score while answers wait for the teacher", () => {
    for (const score of [0, 5, 10]) {
      expect(resultMessage(score, 10, 2)).toEqual({
        title: "Score so far",
        detail: "Some answers are waiting for your teacher.",
      });
    }
  });

  it("never scolds and never shouts", () => {
    const messages = [
      resultMessage(0, 10, 0),
      resultMessage(5, 10, 0),
      resultMessage(8, 10, 0),
      resultMessage(10, 10, 0),
      resultMessage(0, 10, 1),
    ];
    for (const { title, detail } of messages) {
      expect(`${title} ${detail}`).not.toMatch(/!|fail|poor|bad|wrong/i);
    }
  });
});

describe("percentLabel", () => {
  it("rounds to a whole percent", () => {
    expect(percentLabel(0.826)).toBe("83%");
    expect(percentLabel(1)).toBe("100%");
    expect(percentLabel(0)).toBe("0%");
  });
});
