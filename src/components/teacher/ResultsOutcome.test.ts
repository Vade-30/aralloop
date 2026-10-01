// The icon and colour an answer gets on the results page. The one rule worth
// pinning down: an answer waiting for the teacher is never shown as settled.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Answer, Item } from "@/lib/types";
import { OUTCOMES, OutcomeLegend, OutcomeStrip, outcomeOf } from "./ResultsOutcome";

const item: Item = {
  id: "item-1",
  activityId: "activity-1",
  position: 1,
  type: "short_answer",
  question: "Explain why puddles disappear on a sunny day.",
  choices: null,
  answerKey: "Heat from the sun makes the water evaporate.",
  acceptedAnswers: [],
  rubric: "Mentions heat and evaporation.",
  explanation: null,
  points: 2,
};

function answer(overrides: Partial<Answer>): Answer {
  return {
    id: "answer-1",
    submissionId: "submission-1",
    itemId: item.id,
    response: "The sun dries it.",
    score: 0,
    feedback: "",
    gradedBy: "code",
    confidence: null,
    needsReview: false,
    ...overrides,
  };
}

describe("outcomeOf", () => {
  it("follows the score once an answer is settled", () => {
    expect(outcomeOf(answer({ score: 2 }), item)).toBe("full");
    expect(outcomeOf(answer({ score: 1.5 }), item)).toBe("partial");
    expect(outcomeOf(answer({ score: 0 }), item)).toBe("none");
  });

  it("is 'review' while the teacher still has to look, whatever the score so far", () => {
    expect(outcomeOf(answer({ score: 2, gradedBy: "ai", needsReview: true }), item)).toBe("review");
    expect(outcomeOf(answer({ score: 0, gradedBy: "pending", needsReview: true }), item)).toBe(
      "review",
    );
    // Not expected in stored data, but a pending answer must not read as "no points".
    expect(outcomeOf(answer({ score: 0, gradedBy: "pending" }), item)).toBe("review");
  });

  it("goes back to the score after the teacher saves one", () => {
    expect(outcomeOf(answer({ score: 2, gradedBy: "teacher" }), item)).toBe("full");
  });
});

describe("the strip and its legend", () => {
  it("draws one tile per answer and keeps the strip out of the accessibility tree", () => {
    const html = renderToStaticMarkup(
      createElement(OutcomeStrip, { outcomes: ["full", "none", "review"] }),
    );
    expect(html.match(/<svg/g)).toHaveLength(3);
    expect(html.startsWith('<span aria-hidden="true"')).toBe(true);
  });

  it("names every outcome in words, so colour is not the only signal", () => {
    const html = renderToStaticMarkup(createElement(OutcomeLegend, {}));
    for (const { label } of Object.values(OUTCOMES)) expect(html).toContain(label);
  });
});
