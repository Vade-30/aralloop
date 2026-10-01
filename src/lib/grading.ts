// Grades a submission. Objective items are checked here by plain code. Only
// answers that code cannot settle are sent to the model, in one batch per
// submission, so a submission costs at most one AI call.
//
// An AI failure never loses a submission: the unsettled answers are marked
// "pending" and wait for the teacher instead.

import { gradeFreeText } from "./ai";
import type { FreeTextAnswer, FreeTextGrade } from "./ai";
import { LIMITS } from "./contracts";
import type {
  ActivityWithItems,
  AiProviderName,
  Item,
  Lesson,
  NewAnswer,
} from "./types";

/** Below this confidence an AI grade is flagged for the teacher. */
export const REVIEW_CONFIDENCE_THRESHOLD = 0.7;

const LEADING_ARTICLES = new Set(["the", "a", "an", "ang", "si", "mga"]);

const PENDING_FEEDBACK = "This answer is waiting for your teacher to check.";
const PENDING_NOTICE =
  "Some of your answers could not be checked automatically. Your teacher will review them, so your score may change.";

/**
 * A decimal point between two digits and a minus sign in front of a number
 * are part of the answer, not punctuation: without this "-5" would equal "5"
 * and "3.5" would equal "35".
 */
function isPartOfNumber(mark: string, index: number, text: string): boolean {
  const before = text[index - 1] ?? "";
  const after = text[index + 1] ?? "";
  if (mark === ".") return /\d/.test(before) && /\d/.test(after);
  if (mark === "-") return /\d/.test(after) && !/[\p{L}\p{N}]/u.test(before);
  return false;
}

/** Lowercases, strips accents, punctuation, leading articles and extra spaces. */
export function normalizeAnswer(text: string): string {
  const plain = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/−/g, "-")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, (mark: string, index: number, whole: string) =>
      isPartOfNumber(mark, index, whole) ? mark : " ",
    );
  const words = plain.split(/\s+/).filter(Boolean);
  // "ang mga halaman" drops both; a lone "a" (a choice letter) is kept.
  while (words.length > 1 && LEADING_ARTICLES.has(words[0])) words.shift();
  return words.join(" ");
}

/**
 * The form two answers are compared in. Answers made only of symbols ("+",
 * "<") normalise to nothing, so those are compared as typed.
 */
function comparable(text: string): string {
  return normalizeAnswer(text) || text.trim().toLowerCase();
}

const TRUE_WORDS = new Set(["true", "t", "tama", "yes"]);
const FALSE_WORDS = new Set(["false", "f", "mali", "no"]);

function toBoolean(text: string): boolean | null {
  const word = normalizeAnswer(text);
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  return null;
}

function matchesChoice(item: Item, given: string): boolean {
  const key = item.answerKey.trim();
  if (given === key) return true;
  if (comparable(given) !== comparable(key)) return false;
  // Two different choices can normalise to the same text ("A cell" and "The
  // cell", "5" and "-5"). Picking the other one is still wrong.
  const choices = (item.choices ?? []).map((choice) => choice.trim());
  return !(choices.includes(given) && choices.includes(key));
}

/**
 * Checks a response against the answer key without AI.
 * - multiple_choice / true_false: always decided.
 * - identification: decided only when the response matches the key or an
 *   accepted answer after normalising; otherwise "undecided" (the model then
 *   judges misspellings and equivalent names).
 * - short_answer: always "undecided", except an empty response, which is wrong.
 */
export function checkByCode(
  item: Item,
  response: string,
): "correct" | "wrong" | "undecided" {
  const given = response.trim();
  if (given === "") return "wrong";

  switch (item.type) {
    case "multiple_choice":
      return matchesChoice(item, given) ? "correct" : "wrong";
    case "true_false": {
      const expected = toBoolean(item.answerKey);
      const matches =
        expected === null
          ? comparable(given) === comparable(item.answerKey)
          : toBoolean(given) === expected;
      return matches ? "correct" : "wrong";
    }
    case "identification": {
      const accepted = [item.answerKey, ...item.acceptedAnswers].map(comparable);
      return accepted.includes(comparable(given)) ? "correct" : "undecided";
    }
    case "short_answer":
      return "undecided";
  }
}

export interface GradedSubmission {
  /** One per item of the activity, in item order. Missing responses are "". */
  answers: NewAnswer[];
  totalScore: number;
  maxScore: number;
  needsReview: boolean;
  /** The provider that graded the free-text answers, if any were sent. */
  aiProvider: AiProviderName | null;
  /**
   * Set when AI grading failed. Those answers get score 0, gradedBy
   * "pending" and needsReview true, and the submission is still saved.
   */
  notice: string | null;
}

function codeAnswer(item: Item, response: string, correct: boolean): NewAnswer {
  let feedback = "Correct.";
  if (!correct) {
    feedback =
      response === ""
        ? "No answer was given."
        : `The correct answer is "${item.answerKey.trim()}".`;
  }
  return {
    itemId: item.id,
    response,
    score: correct ? item.points : 0,
    feedback,
    gradedBy: "code",
    confidence: null,
    needsReview: false,
  };
}

function pendingAnswer(item: Item, response: string): NewAnswer {
  return {
    itemId: item.id,
    response,
    score: 0,
    feedback: PENDING_FEEDBACK,
    gradedBy: "pending",
    confidence: null,
    needsReview: true,
  };
}

/**
 * Turns the model's grade into a stored answer. The score is kept inside
 * 0..points and on the allowed steps (halves for short answers, whole points
 * otherwise). Returns null if the grade is unusable.
 */
function aiAnswer(
  item: Item,
  response: string,
  grade: FreeTextGrade | undefined,
): NewAnswer | null {
  if (!grade || !Number.isFinite(grade.score)) return null;

  const step = item.type === "short_answer" ? 0.5 : 1;
  const rounded = Math.round(grade.score / step) * step;
  const score = Math.min(item.points, Math.max(0, rounded));
  const confidence = Number.isFinite(grade.confidence)
    ? Math.min(1, Math.max(0, grade.confidence))
    : 0;
  const feedback =
    grade.feedback.trim().slice(0, LIMITS.feedbackMax) ||
    (score === item.points
      ? "Correct."
      : `This answer earned ${score} of ${item.points} points.`);

  return {
    itemId: item.id,
    response,
    score,
    feedback,
    gradedBy: "ai",
    confidence,
    needsReview: confidence < REVIEW_CONFIDENCE_THRESHOLD,
  };
}

/** Grades a whole submission. Never throws because of an AI failure. */
export async function gradeSubmission(input: {
  activity: ActivityWithItems;
  lesson: Lesson;
  gradeLevel: string;
  /** itemId -> the student's response. */
  responses: Record<string, string>;
}): Promise<GradedSubmission> {
  const items = [...input.activity.items].sort((a, b) => a.position - b.position);

  const responseOf = (item: Item): string => {
    const raw: unknown = input.responses[item.id];
    return typeof raw === "string" ? raw.trim().slice(0, LIMITS.responseMax) : "";
  };

  // Pass 1: settle what code can, and collect the rest for the model.
  const settled = new Map<string, NewAnswer>();
  const undecided: FreeTextAnswer[] = [];
  for (const item of items) {
    const response = responseOf(item);
    const verdict = checkByCode(item, response);
    if (verdict !== "undecided") {
      settled.set(item.id, codeAnswer(item, response, verdict === "correct"));
    } else if (item.type === "identification" || item.type === "short_answer") {
      undecided.push({
        itemId: item.id,
        type: item.type,
        question: item.question,
        answerKey: item.answerKey,
        acceptedAnswers: item.acceptedAnswers,
        rubric: item.rubric,
        points: item.points,
        response,
      });
    }
  }

  // Pass 2: one AI call for everything code could not settle.
  let aiProvider: AiProviderName | null = null;
  let notice: string | null = null;
  const grades = new Map<string, FreeTextGrade>();
  if (undecided.length > 0) {
    try {
      const result = await gradeFreeText({
        lessonTitle: input.lesson.title,
        gradeLevel: input.gradeLevel,
        answers: undecided,
      });
      for (const grade of result.data) grades.set(grade.itemId, grade);
      aiProvider = result.provider;
    } catch (error) {
      console.error(
        "[grading] AI grading failed:",
        error instanceof Error ? error.message : error,
      );
      notice = PENDING_NOTICE;
    }
  }

  const answers = items.map((item): NewAnswer => {
    const byCode = settled.get(item.id);
    if (byCode) return byCode;
    const response = responseOf(item);
    const byAi = aiAnswer(item, response, grades.get(item.id));
    if (byAi) return byAi;
    // The call failed, or the model skipped this answer.
    notice = PENDING_NOTICE;
    return pendingAnswer(item, response);
  });

  return {
    answers,
    totalScore: answers.reduce((sum, answer) => sum + answer.score, 0),
    maxScore: items.reduce((sum, item) => sum + item.points, 0),
    needsReview: answers.some((answer) => answer.needsReview),
    aiProvider,
    notice,
  };
}
