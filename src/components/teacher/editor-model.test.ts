// The draft editor's rules: what it loads from a stored activity, how the
// type switch behaves, what it refuses to save, and that what it does save
// satisfies the API contract.

import { describe, expect, it } from "vitest";
import { LIMITS, updateActivityRequest } from "@/lib/contracts";
import type { Item } from "@/lib/types";
import {
  addChoice,
  blankItem,
  changeType,
  fromItem,
  parseAccepted,
  removeChoice,
  toItemInput,
  toUpdateRequest,
  validateDraft,
  type Draft,
  type DraftItem,
} from "./editor-model";

function item(overrides: Partial<Item>): Item {
  return {
    id: "item-1",
    activityId: "activity-1",
    position: 1,
    type: "multiple_choice",
    question: "Which gas do plants take in?",
    choices: ["Oxygen", "Carbon dioxide", "Nitrogen"],
    answerKey: "Carbon dioxide",
    acceptedAnswers: [],
    rubric: null,
    explanation: "Plants use carbon dioxide to make food.",
    points: 1,
    ...overrides,
  };
}

const multipleChoice = item({});
const trueFalse = item({
  id: "item-2",
  type: "true_false",
  question: "Plants make their own food.",
  choices: ["True", "False"],
  answerKey: "True",
});
const identification = item({
  id: "item-3",
  type: "identification",
  question: "What is the green pigment in leaves called?",
  choices: null,
  answerKey: "Chlorophyll",
  acceptedAnswers: ["chlorophyl"],
});
const shortAnswer = item({
  id: "item-4",
  type: "short_answer",
  question: "Why do plants need sunlight?",
  choices: null,
  answerKey: "Sunlight gives the energy plants use to make food.",
  rubric: "Mentions energy and making food.",
  points: 3,
});

function draftOf(items: DraftItem[]): Draft {
  return { title: "Photosynthesis check", instructions: "Answer every item.", items };
}

function messages(draft: Draft): string[] {
  return validateDraft(draft).map((problem) => problem.message);
}

describe("fromItem and toItemInput", () => {
  it.each([multipleChoice, trueFalse, identification, shortAnswer])(
    "round-trips a stored $type item unchanged",
    (stored) => {
      const { id, activityId, position, ...expected } = stored;
      void id;
      void activityId;
      void position;
      expect(toItemInput(fromItem(stored))).toEqual(expected);
    },
  );

  it("does not split accepted answers that contain a comma when a draft is saved unchanged", () => {
    const stored = item({
      ...identification,
      answerKey: "June 12, 1898",
      acceptedAnswers: ["Hunyo 12, 1898", "1,898", "Kawit, Cavite"],
    });
    const draft = fromItem(stored);
    expect(draft.accepted).toBe("Hunyo 12, 1898; 1,898; Kawit, Cavite");
    expect(toItemInput(draft).acceptedAnswers).toEqual(stored.acceptedAnswers);
  });

  it("leaves a multiple-choice item unmarked when the key matches no choice", () => {
    const draft = fromItem(item({ answerKey: "Helium" }));
    expect(draft.correctIndex).toBe(-1);
    expect(messages(draftOf([draft]))).toContain("Mark the correct choice.");
  });

  it("matches the key to a choice even when only the letter case differs", () => {
    expect(fromItem(item({ answerKey: "carbon dioxide" })).correctIndex).toBe(1);
  });

  it("reads a lower-case true/false key", () => {
    expect(fromItem(item({ ...trueFalse, answerKey: "false" })).trueFalse).toBe("False");
  });
});

describe("multiple-choice editing", () => {
  it("keeps the answer key equal to the correct choice as its text is edited", () => {
    const draft = fromItem(multipleChoice);
    const edited = { ...draft, choices: ["Oxygen", "Carbon dioxide (CO2)", "Nitrogen"] };
    expect(toItemInput(edited).answerKey).toBe("Carbon dioxide (CO2)");
  });

  it("keeps the correct mark on the same choice when an earlier one is removed", () => {
    const next = removeChoice(fromItem(multipleChoice), 0);
    expect(next.choices).toEqual(["Carbon dioxide", "Nitrogen"]);
    expect(next.correctIndex).toBe(0);
  });

  it("clears the correct mark when the correct choice is removed", () => {
    expect(removeChoice(fromItem(multipleChoice), 1).correctIndex).toBe(-1);
  });

  it("keeps between 2 and 6 choices", () => {
    let draft = fromItem(multipleChoice);
    for (let i = 0; i < 10; i += 1) draft = addChoice(draft);
    expect(draft.choices).toHaveLength(6);
    for (let i = 0; i < 10; i += 1) draft = removeChoice(draft, 0);
    expect(draft.choices).toHaveLength(2);
  });
});

describe("changeType", () => {
  it("gives a new multiple-choice item at least three choice inputs", () => {
    const next = changeType(fromItem(shortAnswer), "multiple_choice");
    expect(next.choices.length).toBeGreaterThanOrEqual(3);
    expect(next.correctIndex).toBe(-1);
  });

  it("turns an identification answer into the first, correct, choice", () => {
    const next = changeType(fromItem(identification), "multiple_choice");
    expect(next.choices[0]).toBe("Chlorophyll");
    expect(next.correctIndex).toBe(0);
  });

  it("carries the correct choice over as the identification answer", () => {
    const next = changeType(fromItem(multipleChoice), "identification");
    expect(toItemInput(next)).toMatchObject({ choices: null, answerKey: "Carbon dioxide" });
  });

  it("makes true/false ask for the answer and save True/False choices", () => {
    const next = changeType(fromItem(multipleChoice), "true_false");
    expect(messages(draftOf([next]))).toContain("Choose whether the answer is True or False.");
    expect(toItemInput({ ...next, trueFalse: "False" })).toMatchObject({
      choices: ["True", "False"],
      answerKey: "False",
    });
  });

  it("drops choices, accepted answers and rubric that do not belong to the type", () => {
    const next = changeType(fromItem(identification), "short_answer");
    expect(toItemInput(next)).toMatchObject({ choices: null, acceptedAnswers: [], rubric: null });
  });

  it("restores the original fields when the type is switched back", () => {
    const original = fromItem(multipleChoice);
    const back = changeType(changeType(original, "short_answer"), "multiple_choice");
    expect(toItemInput(back)).toEqual(toItemInput(original));
  });
});

describe("parseAccepted", () => {
  it("splits on semicolons, trims, and drops blanks and repeats", () => {
    expect(parseAccepted(" Rizal; Dr. Jose Rizal ;; rizal ;")).toEqual(["Rizal", "Dr. Jose Rizal"]);
  });

  it("also splits on a pasted line break", () => {
    expect(parseAccepted("Rizal\nDr. Jose Rizal")).toEqual(["Rizal", "Dr. Jose Rizal"]);
  });

  it("keeps an answer that contains a comma in one piece", () => {
    expect(parseAccepted("Hunyo 12, 1898; 1,898")).toEqual(["Hunyo 12, 1898", "1,898"]);
  });
});

describe("validateDraft", () => {
  it("accepts an untouched stored activity", () => {
    const draft = draftOf([multipleChoice, trueFalse, identification, shortAnswer].map(fromItem));
    expect(validateDraft(draft)).toEqual([]);
  });

  it("names the item a problem belongs to", () => {
    const broken = { ...fromItem(trueFalse), question: "  " };
    const problems = validateDraft(draftOf([fromItem(multipleChoice), broken]));
    expect(problems).toEqual([{ itemKey: broken.key, message: "Write the question." }]);
  });

  it("reports a blank new item's missing parts", () => {
    expect(messages(draftOf([blankItem("new-1")]))).toEqual([
      "Write the question.",
      "Fill in every choice, or remove the empty ones.",
      "Mark the correct choice.",
    ]);
  });

  it("rejects repeated choices, since the key could not tell them apart", () => {
    const draft = { ...fromItem(multipleChoice), choices: ["Oxygen", "oxygen ", "Nitrogen"] };
    expect(messages(draftOf([draft]))).toContain(
      "Two choices are the same. Make each choice different.",
    );
  });

  it.each(["", "0", "21", "2.5", "abc"])("rejects %j as points", (points) => {
    expect(messages(draftOf([{ ...fromItem(multipleChoice), points }]))).toEqual([
      "Set the points to a whole number from 1 to 20.",
    ]);
  });

  it("requires a title and at least one item", () => {
    expect(messages({ title: " ", instructions: "", items: [] })).toEqual([
      "Give the activity a title.",
      "Add at least one item.",
    ]);
  });

  it("rejects more items than the limit", () => {
    const items = Array.from({ length: LIMITS.itemCountMax + 1 }, (_, index) => ({
      ...fromItem(multipleChoice),
      key: `item-${index}`,
    }));
    expect(messages(draftOf(items))).toEqual([
      `Keep the activity to ${LIMITS.itemCountMax} items or fewer.`,
    ]);
  });
});

describe("toUpdateRequest", () => {
  it("produces a body the API contract accepts, for every item type", () => {
    const draft = draftOf([multipleChoice, trueFalse, identification, shortAnswer].map(fromItem));
    const body = toUpdateRequest(draft);
    expect(updateActivityRequest.safeParse(body).success).toBe(true);
    expect(body.items.map((entry) => entry.type)).toEqual([
      "multiple_choice",
      "true_false",
      "identification",
      "short_answer",
    ]);
  });

  it("trims text and turns empty optional fields into null", () => {
    const draft = draftOf([
      { ...fromItem(shortAnswer), question: "  Why?  ", rubric: "   ", explanation: "" },
    ]);
    expect(toUpdateRequest({ ...draft, title: "  Check  " })).toMatchObject({
      title: "Check",
      items: [{ question: "Why?", rubric: null, explanation: null }],
    });
  });

  it("stops a draft that the contract would reject", () => {
    const invalid = draftOf([{ ...fromItem(multipleChoice), choices: ["Only one", ""] }]);
    expect(validateDraft(invalid)).not.toEqual([]);
    expect(updateActivityRequest.safeParse(toUpdateRequest(invalid)).success).toBe(false);
  });
});
