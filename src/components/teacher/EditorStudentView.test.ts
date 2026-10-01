// The editor's "Student view" tells the teacher that students get the
// questions without the answer key. These checks hold it to that: what it
// renders from a draft must leave out everything a student is not sent.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorStudentView } from "./EditorStudentView";
import { EditorSummary } from "./EditorSummary";
import { blankItem, type DraftItem } from "./editor-model";

/** Rendered HTML with tags removed, so assertions read like the screen. */
function text(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

const items: DraftItem[] = [
  {
    ...blankItem("a"),
    question: "Which gas do plants take in?",
    choices: ["Oxygen", "Carbon dioxide", "Nitrogen"],
    correctIndex: 1,
    explanation: "EXPLANATION-ONE",
    points: "2",
  },
  { ...blankItem("b"), type: "true_false", question: "Ice is frozen water.", trueFalse: "True" },
  {
    ...blankItem("c"),
    type: "identification",
    question: "Name our national hero.",
    answer: "KEY-IDENTIFICATION",
    accepted: "ACCEPTED-ONE; ACCEPTED-TWO",
  },
  {
    ...blankItem("d"),
    type: "short_answer",
    question: "Why do puddles dry up?",
    answer: "KEY-MODEL-ANSWER",
    rubric: "RUBRIC-TEXT",
    explanation: "EXPLANATION-TWO",
  },
];

describe("student view of a draft", () => {
  const html = renderToStaticMarkup(createElement(EditorStudentView, { items }));
  const page = text(html);

  it("shows each question with what the student picks from or types into", () => {
    for (const expected of [
      "Question 1 of 4",
      "Which gas do plants take in?",
      "Oxygen",
      "Carbon dioxide",
      "Nitrogen",
      "2 points",
      "Question 2 of 4",
      "True",
      "False",
      "Question 4 of 4",
      "Why do puddles dry up?",
      "Write your answer in your own words",
    ]) {
      expect(page).toContain(expected);
    }
  });

  it("leaves out the answer key, accepted answers, rubric and explanation", () => {
    for (const hidden of [
      "KEY-IDENTIFICATION",
      "ACCEPTED-ONE",
      "ACCEPTED-TWO",
      "KEY-MODEL-ANSWER",
      "RUBRIC-TEXT",
      "EXPLANATION-ONE",
      "EXPLANATION-TWO",
      "Correct answer",
    ]) {
      expect(html).not.toContain(hidden);
    }
    // Nothing marks which choice is right: no control is checked and no choice stands out.
    expect(html).not.toContain("checked");
    expect(html).not.toContain("emerald");
  });

  it("says so plainly when a question or a choice is still empty", () => {
    const empty = text(
      renderToStaticMarkup(createElement(EditorStudentView, { items: [blankItem("e")] })),
    );
    expect(empty).toContain("No question yet");
    expect(empty).toContain("Empty choice");
  });
});

describe("summary of a draft", () => {
  const entries = [{ type: "multiple_choice" as const, points: 1 }];
  const render = (readiness: { ready: number; total: number; blocker?: string }) =>
    text(renderToStaticMarkup(createElement(EditorSummary, { entries, readiness })));

  it("is ready only when every item is and nothing else stops it", () => {
    expect(render({ ready: 3, total: 3 })).toContain("Ready to publish");
    expect(render({ ready: 3, total: 3 })).toContain("3 of 3 items ready");

    const unfinished = render({ ready: 2, total: 3 });
    expect(unfinished).toContain("Not ready yet");
    expect(unfinished).toContain("2 of 3 items ready");
    expect(unfinished).not.toContain("Ready to publish");

    const blocked = render({ ready: 3, total: 3, blocker: "Give the activity a title." });
    expect(blocked).toContain("Not ready yet");
    expect(blocked).toContain("Give the activity a title.");
    expect(blocked).not.toContain("Ready to publish");
  });
});
