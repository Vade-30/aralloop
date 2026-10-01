// The draft editor's working copy of an activity, kept apart from the React
// components so the conversion and validation rules can be tested on their own.
//
// A DraftItem keeps the fields of every item type at once. Switching the type
// back and forth therefore never loses what the teacher typed; toItemInput
// keeps only the fields that belong to the chosen type.

import { LIMITS, type UpdateActivityRequest } from "@/lib/contracts";
import type { ActivityWithItems, Item, ItemInput, ItemType } from "@/lib/types";

export const MIN_CHOICES = 2;
export const MAX_CHOICES = 6;
/** A new multiple-choice item starts with this many empty choices. */
const STARTING_CHOICES = 3;
export const MIN_POINTS = 1;
export const MAX_POINTS = 20;
const MAX_ACCEPTED_ANSWERS = 10;
/** Put between accepted answers when a stored item is loaded into the editor. */
const ACCEPTED_SEPARATOR = "; ";

export interface DraftItem {
  /** Stable React key. Not the database id: saving replaces every item. */
  key: string;
  type: ItemType;
  question: string;
  /** multiple_choice: the option texts. */
  choices: string[];
  /** multiple_choice: index of the correct choice, -1 while none is marked. */
  correctIndex: number;
  /** true_false: the correct answer, "" while none is chosen. */
  trueFalse: "True" | "False" | "";
  /** identification: the expected answer. short_answer: the model answer. */
  answer: string;
  /**
   * identification: other accepted answers, separated by semicolons. Not by
   * commas: an answer such as "June 12, 1898" contains one.
   */
  accepted: string;
  /** short_answer only. */
  rubric: string;
  explanation: string;
  /** Kept as typed, so the field can be empty while the teacher edits it. */
  points: string;
}

export interface Draft {
  title: string;
  instructions: string;
  items: DraftItem[];
}

/** One thing the teacher has to fix. itemKey is null for the activity itself. */
export interface DraftProblem {
  itemKey: string | null;
  message: string;
}

function padChoices(choices: string[], length: number): string[] {
  return choices.length >= length
    ? choices
    : [...choices, ...Array<string>(length - choices.length).fill("")];
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function blankItem(key: string): DraftItem {
  return {
    key,
    type: "multiple_choice",
    question: "",
    choices: padChoices([], STARTING_CHOICES),
    correctIndex: -1,
    trueFalse: "",
    answer: "",
    accepted: "",
    rubric: "",
    explanation: "",
    points: "1",
  };
}

export function fromItem(item: Item): DraftItem {
  const draft: DraftItem = {
    ...blankItem(item.id),
    type: item.type,
    question: item.question,
    choices: [],
    accepted: item.acceptedAnswers.join(ACCEPTED_SEPARATOR),
    rubric: item.rubric ?? "",
    explanation: item.explanation ?? "",
    points: String(item.points),
  };
  switch (item.type) {
    case "multiple_choice": {
      const choices = item.choices ?? [];
      // An answer key that matches no choice leaves the item unmarked, and
      // validation then asks the teacher to mark the correct one.
      const exact = choices.indexOf(item.answerKey);
      draft.choices = padChoices(choices, MIN_CHOICES);
      draft.correctIndex =
        exact >= 0 ? exact : choices.findIndex((choice) => sameText(choice, item.answerKey));
      break;
    }
    case "true_false":
      draft.trueFalse = sameText(item.answerKey, "true")
        ? "True"
        : sameText(item.answerKey, "false")
          ? "False"
          : "";
      break;
    case "identification":
    case "short_answer":
      draft.answer = item.answerKey;
      break;
  }
  return draft;
}

export function fromActivity(activity: ActivityWithItems): Draft {
  return {
    title: activity.title,
    instructions: activity.instructions,
    items: activity.items.map(fromItem),
  };
}

/** Switches an item's type, carrying the current answer over where it fits. */
export function changeType(item: DraftItem, type: ItemType): DraftItem {
  if (type === item.type) return item;
  const next: DraftItem = { ...item, type };

  if (type === "multiple_choice") {
    const hasChoices = item.choices.some((choice) => choice.trim() !== "");
    if (!hasChoices && item.answer.trim() !== "" && item.type === "identification") {
      // The identification answer becomes the first, correct, choice.
      next.choices = padChoices([item.answer.trim()], STARTING_CHOICES);
      next.correctIndex = 0;
    } else {
      next.choices = padChoices(item.choices, STARTING_CHOICES);
    }
    return next;
  }

  if (type === "identification" && item.type === "multiple_choice" && item.answer.trim() === "") {
    next.answer = item.choices[item.correctIndex]?.trim() ?? "";
  }
  return next;
}

export function addChoice(item: DraftItem): DraftItem {
  if (item.choices.length >= MAX_CHOICES) return item;
  return { ...item, choices: [...item.choices, ""] };
}

/** Removes a choice and keeps the correct mark on the same choice text. */
export function removeChoice(item: DraftItem, index: number): DraftItem {
  if (item.choices.length <= MIN_CHOICES) return item;
  const correctIndex =
    index === item.correctIndex
      ? -1
      : index < item.correctIndex
        ? item.correctIndex - 1
        : item.correctIndex;
  return { ...item, choices: item.choices.filter((_, i) => i !== index), correctIndex };
}

/**
 * "Rizal; Dr. Jose Rizal ;; " -> ["Rizal", "Dr. Jose Rizal"], without repeats.
 * A pasted line break also separates answers. A comma does not.
 */
export function parseAccepted(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of text.split(/[;\n]/)) {
    const value = part.trim();
    const id = value.toLowerCase();
    if (value === "" || seen.has(id)) continue;
    seen.add(id);
    result.push(value);
  }
  return result;
}

/** The points as typed, or null while they are not a whole number in range. */
export function parsePoints(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= MIN_POINTS && value <= MAX_POINTS ? value : null;
}

function itemProblems(item: DraftItem): string[] {
  const problems: string[] = [];
  const question = item.question.trim();
  if (question === "") {
    problems.push("Write the question.");
  } else if (question.length > LIMITS.questionMax) {
    problems.push(`Shorten the question to ${LIMITS.questionMax} characters or fewer.`);
  }

  switch (item.type) {
    case "multiple_choice": {
      const choices = item.choices.map((choice) => choice.trim());
      if (choices.length < MIN_CHOICES || choices.length > MAX_CHOICES) {
        problems.push(`Give between ${MIN_CHOICES} and ${MAX_CHOICES} choices.`);
      }
      if (choices.some((choice) => choice === "")) {
        problems.push("Fill in every choice, or remove the empty ones.");
      }
      if (choices.some((choice) => choice.length > LIMITS.choiceMax)) {
        problems.push(`Shorten each choice to ${LIMITS.choiceMax} characters or fewer.`);
      }
      const filled = choices.filter((choice) => choice !== "").map((c) => c.toLowerCase());
      if (new Set(filled).size < filled.length) {
        problems.push("Two choices are the same. Make each choice different.");
      }
      if (item.correctIndex < 0 || item.correctIndex >= choices.length) {
        problems.push("Mark the correct choice.");
      }
      break;
    }
    case "true_false":
      if (item.trueFalse === "") problems.push("Choose whether the answer is True or False.");
      break;
    case "identification": {
      const answer = item.answer.trim();
      if (answer === "") {
        problems.push("Write the correct answer.");
      } else if (answer.length > LIMITS.responseMax) {
        problems.push(`Shorten the correct answer to ${LIMITS.responseMax} characters or fewer.`);
      }
      const accepted = parseAccepted(item.accepted);
      if (accepted.length > MAX_ACCEPTED_ANSWERS) {
        problems.push(`List at most ${MAX_ACCEPTED_ANSWERS} other accepted answers.`);
      }
      if (accepted.some((value) => value.length > LIMITS.choiceMax)) {
        problems.push(
          `Shorten each accepted answer to ${LIMITS.choiceMax} characters or fewer.`,
        );
      }
      break;
    }
    case "short_answer": {
      const answer = item.answer.trim();
      if (answer === "") {
        problems.push("Write a model answer.");
      } else if (answer.length > LIMITS.responseMax) {
        problems.push(`Shorten the model answer to ${LIMITS.responseMax} characters or fewer.`);
      }
      if (item.rubric.trim().length > LIMITS.feedbackMax) {
        problems.push(`Shorten the rubric to ${LIMITS.feedbackMax} characters or fewer.`);
      }
      break;
    }
  }

  if (item.explanation.trim().length > LIMITS.feedbackMax) {
    problems.push(`Shorten the explanation to ${LIMITS.feedbackMax} characters or fewer.`);
  }
  if (parsePoints(item.points) === null) {
    problems.push(`Set the points to a whole number from ${MIN_POINTS} to ${MAX_POINTS}.`);
  }
  return problems;
}

/** Mirrors updateActivityRequest, in words a teacher can act on. */
export function validateDraft(draft: Draft): DraftProblem[] {
  const problems: DraftProblem[] = [];
  const title = draft.title.trim();
  if (title === "") {
    problems.push({ itemKey: null, message: "Give the activity a title." });
  } else if (title.length > LIMITS.lessonTitleMax) {
    problems.push({
      itemKey: null,
      message: `Shorten the title to ${LIMITS.lessonTitleMax} characters or fewer.`,
    });
  }
  if (draft.instructions.trim().length > LIMITS.feedbackMax) {
    problems.push({
      itemKey: null,
      message: `Shorten the instructions to ${LIMITS.feedbackMax} characters or fewer.`,
    });
  }
  if (draft.items.length === 0) {
    problems.push({ itemKey: null, message: "Add at least one item." });
  } else if (draft.items.length > LIMITS.itemCountMax) {
    problems.push({
      itemKey: null,
      message: `Keep the activity to ${LIMITS.itemCountMax} items or fewer.`,
    });
  }
  for (const item of draft.items) {
    for (const message of itemProblems(item)) problems.push({ itemKey: item.key, message });
  }
  return problems;
}

/** Call only on an item that passed validateDraft. */
export function toItemInput(item: DraftItem): ItemInput {
  const base = {
    type: item.type,
    question: item.question.trim(),
    explanation: item.explanation.trim() || null,
    points: parsePoints(item.points) ?? MIN_POINTS,
  };
  switch (item.type) {
    case "multiple_choice": {
      const choices = item.choices.map((choice) => choice.trim());
      return {
        ...base,
        choices,
        answerKey: choices[item.correctIndex] ?? "",
        acceptedAnswers: [],
        rubric: null,
      };
    }
    case "true_false":
      return {
        ...base,
        choices: ["True", "False"],
        answerKey: item.trueFalse,
        acceptedAnswers: [],
        rubric: null,
      };
    case "identification":
      return {
        ...base,
        choices: null,
        answerKey: item.answer.trim(),
        acceptedAnswers: parseAccepted(item.accepted),
        rubric: null,
      };
    case "short_answer":
      return {
        ...base,
        choices: null,
        answerKey: item.answer.trim(),
        acceptedAnswers: [],
        rubric: item.rubric.trim() || null,
      };
  }
}

/** Call only on a draft that passed validateDraft. */
export function toUpdateRequest(draft: Draft): UpdateActivityRequest {
  return {
    title: draft.title.trim(),
    instructions: draft.instructions.trim(),
    items: draft.items.map(toItemInput),
  };
}
