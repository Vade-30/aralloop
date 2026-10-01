// Tests for code-based grading and the single batched AI call. The AI layer is
// mocked, so nothing here reaches a real model.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { gradeFreeText } from "./ai";
import { AiError } from "./ai/errors";
import { LIMITS } from "./contracts";
import {
  REVIEW_CONFIDENCE_THRESHOLD,
  checkByCode,
  gradeSubmission,
  normalizeAnswer,
} from "./grading";
import type { ActivityWithItems, Item, Lesson } from "./types";

vi.mock("./ai", () => ({ gradeFreeText: vi.fn() }));
const gradeFreeTextMock = vi.mocked(gradeFreeText);

function makeItem(overrides: Partial<Item> & Pick<Item, "id" | "type">): Item {
  return {
    activityId: "act-1",
    position: 1,
    question: "Sample question?",
    choices: null,
    answerKey: "Chloroplast",
    acceptedAnswers: [],
    rubric: null,
    explanation: null,
    points: 1,
    ...overrides,
  };
}

const multipleChoice = makeItem({
  id: "mc",
  type: "multiple_choice",
  position: 1,
  question: "Which part of a plant cell makes food?",
  choices: ["Nucleus", "Chloroplast", "Cell wall", "Vacuole"],
  answerKey: "Chloroplast",
  points: 1,
});
const trueFalse = makeItem({
  id: "tf",
  type: "true_false",
  position: 2,
  question: "Plants need sunlight to make food.",
  choices: ["True", "False"],
  answerKey: "True",
  points: 1,
});
const identification = makeItem({
  id: "id",
  type: "identification",
  position: 3,
  question: "What gas do plants take in?",
  answerKey: "Carbon dioxide",
  acceptedAnswers: ["CO2"],
  points: 2,
});
const shortAnswer = makeItem({
  id: "sa",
  type: "short_answer",
  position: 4,
  question: "Explain why leaves are green.",
  answerKey: "Leaves contain chlorophyll, which reflects green light.",
  rubric: "Mentions chlorophyll and that it reflects green light.",
  points: 4,
});

function makeActivity(items: Item[]): ActivityWithItems {
  return {
    id: "act-1",
    lessonId: "lesson-1",
    classId: "class-1",
    title: "Photosynthesis check",
    instructions: "Answer every item.",
    type: "mixed",
    aiReason: "The lesson has both facts and ideas to explain.",
    status: "published",
    aiProvider: "mock",
    aiModel: "sample",
    createdAt: "2026-01-01T00:00:00.000Z",
    publishedAt: "2026-01-01T00:00:00.000Z",
    items,
  };
}

const lesson: Lesson = {
  id: "lesson-1",
  classId: "class-1",
  title: "How plants make food",
  content: "Plants make food through photosynthesis.",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function grade(items: Item[], responses: Record<string, string>) {
  return gradeSubmission({
    activity: makeActivity(items),
    lesson,
    gradeLevel: "Grade 6",
    responses,
  });
}

/** Makes the mocked AI return these grades as the offline sample provider. */
function aiReturns(
  grades: { itemId: string; score: number; feedback: string; confidence: number }[],
) {
  gradeFreeTextMock.mockResolvedValue({ data: grades, provider: "mock", model: "sample" });
}

beforeEach(() => {
  gradeFreeTextMock.mockReset();
});

describe("normalizeAnswer", () => {
  it("lowercases, trims and collapses spaces", () => {
    expect(normalizeAnswer("  Carbon \n  Dioxide ")).toBe("carbon dioxide");
  });

  it("strips accents", () => {
    expect(normalizeAnswer("Niño")).toBe("nino");
    expect(normalizeAnswer("Café Olé")).toBe("cafe ole");
    expect(normalizeAnswer("piña")).toBe(normalizeAnswer("pina"));
  });

  it("replaces punctuation with spaces", () => {
    expect(normalizeAnswer("Chloroplast.")).toBe("chloroplast");
    expect(normalizeAnswer("carbon-dioxide!")).toBe("carbon dioxide");
    expect(normalizeAnswer("(H2O)")).toBe("h2o");
    expect(normalizeAnswer("“Mitochondria”, of course")).toBe("mitochondria of course");
  });

  it("drops a leading English article", () => {
    expect(normalizeAnswer("The Sun")).toBe("sun");
    expect(normalizeAnswer("a cell")).toBe("cell");
    expect(normalizeAnswer("An atom")).toBe("atom");
  });

  it("drops a leading Filipino article", () => {
    expect(normalizeAnswer("Ang araw")).toBe("araw");
    expect(normalizeAnswer("si Maria")).toBe("maria");
    expect(normalizeAnswer("mga halaman")).toBe("halaman");
    expect(normalizeAnswer("Ang mga halaman")).toBe("halaman");
  });

  it("keeps articles that are not at the start or are part of a word", () => {
    expect(normalizeAnswer("Theory")).toBe("theory");
    expect(normalizeAnswer("light from the sun")).toBe("light from the sun");
    expect(normalizeAnswer("A")).toBe("a");
  });

  it("keeps decimal points and minus signs that belong to a number", () => {
    expect(normalizeAnswer("-5")).toBe("-5");
    expect(normalizeAnswer("3.5.")).toBe("3.5");
    expect(normalizeAnswer("5 - 3")).toBe("5 3");
    expect(normalizeAnswer("-5")).not.toBe(normalizeAnswer("5"));
  });

  it("returns an empty string for blank or punctuation-only text", () => {
    expect(normalizeAnswer("   ")).toBe("");
    expect(normalizeAnswer("?!")).toBe("");
  });
});

describe("checkByCode", () => {
  it("decides multiple choice against the key", () => {
    expect(checkByCode(multipleChoice, "Chloroplast")).toBe("correct");
    expect(checkByCode(multipleChoice, "  chloroplast ")).toBe("correct");
    expect(checkByCode(multipleChoice, "Nucleus")).toBe("wrong");
    expect(checkByCode(multipleChoice, "")).toBe("wrong");
  });

  it("does not confuse two choices that normalise to the same text", () => {
    const item = makeItem({
      id: "mc2",
      type: "multiple_choice",
      choices: ["5", "-5", "A cell", "The cell"],
      answerKey: "The cell",
    });
    expect(checkByCode(item, "The cell")).toBe("correct");
    expect(checkByCode(item, "A cell")).toBe("wrong");
  });

  it("decides true or false, including short and Filipino forms", () => {
    for (const response of ["True", "true", "T", "t", "Tama", "yes", "YES"]) {
      expect(checkByCode(trueFalse, response)).toBe("correct");
    }
    for (const response of ["False", "f", "Mali", "no", "maybe", ""]) {
      expect(checkByCode(trueFalse, response)).toBe("wrong");
    }
    const falseItem = makeItem({ id: "tf2", type: "true_false", answerKey: "False" });
    expect(checkByCode(falseItem, "mali")).toBe("correct");
    expect(checkByCode(falseItem, "F")).toBe("correct");
    expect(checkByCode(falseItem, "tama")).toBe("wrong");
  });

  it("accepts a true or false key written in Filipino", () => {
    const item = makeItem({
      id: "tf3",
      type: "true_false",
      choices: ["Tama", "Mali"],
      answerKey: "Tama",
    });
    expect(checkByCode(item, "Tama")).toBe("correct");
    expect(checkByCode(item, "True")).toBe("correct");
    expect(checkByCode(item, "Mali")).toBe("wrong");
  });

  it("marks identification correct on the key or an accepted answer", () => {
    expect(checkByCode(identification, "carbon dioxide")).toBe("correct");
    expect(checkByCode(identification, "The Carbon-Dioxide.")).toBe("correct");
    expect(checkByCode(identification, "co2")).toBe("correct");
  });

  it("leaves other identification answers undecided and blanks wrong", () => {
    expect(checkByCode(identification, "carbon dioxyde")).toBe("undecided");
    expect(checkByCode(identification, "oxygen")).toBe("undecided");
    expect(checkByCode(identification, "")).toBe("wrong");
    expect(checkByCode(identification, "   ")).toBe("wrong");
  });

  it("does not treat a negative number as its positive", () => {
    const item = makeItem({ id: "id2", type: "identification", answerKey: "-5" });
    expect(checkByCode(item, "-5")).toBe("correct");
    expect(checkByCode(item, "5")).toBe("undecided");
  });

  it("leaves short answers undecided unless blank", () => {
    expect(checkByCode(shortAnswer, "Because of chlorophyll.")).toBe("undecided");
    expect(checkByCode(shortAnswer, "")).toBe("wrong");
    expect(checkByCode(shortAnswer, " \n ")).toBe("wrong");
  });
});

describe("gradeSubmission", () => {
  it("grades objective items by code without calling the AI", async () => {
    const result = await grade([multipleChoice, trueFalse, identification], {
      mc: "Chloroplast",
      tf: "False",
      id: "CO2",
    });

    expect(gradeFreeTextMock).not.toHaveBeenCalled();
    expect(result.answers).toEqual([
      {
        itemId: "mc",
        response: "Chloroplast",
        score: 1,
        feedback: "Correct.",
        gradedBy: "code",
        confidence: null,
        needsReview: false,
      },
      {
        itemId: "tf",
        response: "False",
        score: 0,
        feedback: 'The correct answer is "True".',
        gradedBy: "code",
        confidence: null,
        needsReview: false,
      },
      {
        itemId: "id",
        response: "CO2",
        score: 2,
        feedback: "Correct.",
        gradedBy: "code",
        confidence: null,
        needsReview: false,
      },
    ]);
    expect(result.totalScore).toBe(3);
    expect(result.maxScore).toBe(4);
    expect(result.needsReview).toBe(false);
    expect(result.aiProvider).toBeNull();
    expect(result.notice).toBeNull();
  });

  it("returns answers in position order whatever order the items arrive in", async () => {
    const result = await grade([identification, multipleChoice, trueFalse], {
      mc: "Chloroplast",
      tf: "True",
      id: "CO2",
    });
    expect(result.answers.map((answer) => answer.itemId)).toEqual(["mc", "tf", "id"]);
  });

  it("gives blanks a zero without calling the AI", async () => {
    const result = await grade([multipleChoice, trueFalse, identification, shortAnswer], {
      mc: "",
      id: "   ",
    });

    expect(gradeFreeTextMock).not.toHaveBeenCalled();
    expect(result.answers).toHaveLength(4);
    for (const answer of result.answers) {
      expect(answer).toMatchObject({
        response: "",
        score: 0,
        feedback: "No answer was given.",
        gradedBy: "code",
        confidence: null,
        needsReview: false,
      });
    }
    expect(result.totalScore).toBe(0);
    expect(result.maxScore).toBe(8);
    expect(result.aiProvider).toBeNull();
    expect(result.notice).toBeNull();
  });

  it("sends only the undecided answers to the AI, in one call", async () => {
    aiReturns([
      { itemId: "id", score: 2, feedback: "Right gas, small spelling slip.", confidence: 0.92 },
      { itemId: "sa", score: 2.5, feedback: "You named chlorophyll.", confidence: 0.85 },
    ]);

    const result = await grade([multipleChoice, trueFalse, identification, shortAnswer], {
      mc: "Chloroplast",
      tf: "True",
      id: "carbon dioxyde",
      sa: "  Because of chlorophyll.  ",
    });

    expect(gradeFreeTextMock).toHaveBeenCalledTimes(1);
    expect(gradeFreeTextMock).toHaveBeenCalledWith({
      lessonTitle: "How plants make food",
      gradeLevel: "Grade 6",
      answers: [
        {
          itemId: "id",
          type: "identification",
          question: identification.question,
          answerKey: "Carbon dioxide",
          acceptedAnswers: ["CO2"],
          rubric: null,
          points: 2,
          response: "carbon dioxyde",
        },
        {
          itemId: "sa",
          type: "short_answer",
          question: shortAnswer.question,
          answerKey: shortAnswer.answerKey,
          acceptedAnswers: [],
          rubric: shortAnswer.rubric,
          points: 4,
          response: "Because of chlorophyll.",
        },
      ],
    });

    expect(result.answers[2]).toEqual({
      itemId: "id",
      response: "carbon dioxyde",
      score: 2,
      feedback: "Right gas, small spelling slip.",
      gradedBy: "ai",
      confidence: 0.92,
      needsReview: false,
    });
    expect(result.answers[3]).toEqual({
      itemId: "sa",
      response: "Because of chlorophyll.",
      score: 2.5,
      feedback: "You named chlorophyll.",
      gradedBy: "ai",
      confidence: 0.85,
      needsReview: false,
    });
    expect(result.totalScore).toBe(6.5);
    expect(result.maxScore).toBe(8);
    expect(result.needsReview).toBe(false);
    expect(result.aiProvider).toBe("mock");
    expect(result.notice).toBeNull();
  });

  it("flags a low-confidence AI grade for the teacher", async () => {
    aiReturns([
      { itemId: "id", score: 0, feedback: "This names a different gas.", confidence: 0.7 },
      { itemId: "sa", score: 3, feedback: "Mostly there.", confidence: 0.69 },
    ]);

    const result = await grade([identification, shortAnswer], {
      id: "oxygen",
      sa: "The green stuff in leaves bounces green light.",
    });

    expect(REVIEW_CONFIDENCE_THRESHOLD).toBe(0.7);
    // Exactly at the threshold is not flagged; just below it is.
    expect(result.answers[0]).toMatchObject({ gradedBy: "ai", needsReview: false });
    expect(result.answers[1]).toMatchObject({
      gradedBy: "ai",
      score: 3,
      confidence: 0.69,
      needsReview: true,
    });
    expect(result.needsReview).toBe(true);
    expect(result.notice).toBeNull();
  });

  it("keeps AI scores inside 0..points and on the allowed steps", async () => {
    aiReturns([
      { itemId: "id", score: 1.5, feedback: "Close.", confidence: 2 },
      { itemId: "sa", score: 9, feedback: "   ", confidence: 0.9 },
    ]);

    const result = await grade([identification, shortAnswer], { id: "carbon", sa: "Chlorophyll." });

    // Identification scores are whole points; confidence is capped at 1.
    expect(result.answers[0]).toMatchObject({ score: 2, confidence: 1 });
    expect(result.answers[1]).toMatchObject({ score: 4, feedback: "Correct." });
    expect(result.totalScore).toBe(6);
  });

  it("still grades the submission when the AI fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    gradeFreeTextMock.mockRejectedValue(new AiError("rate_limit"));

    const result = await grade([multipleChoice, trueFalse, identification, shortAnswer], {
      mc: "Chloroplast",
      tf: "True",
      id: "carbon dioxyde",
      sa: "Because of chlorophyll.",
    });

    expect(gradeFreeTextMock).toHaveBeenCalledTimes(1);
    expect(result.answers[0]).toMatchObject({ score: 1, gradedBy: "code" });
    expect(result.answers[1]).toMatchObject({ score: 1, gradedBy: "code" });
    for (const answer of result.answers.slice(2)) {
      expect(answer).toMatchObject({
        score: 0,
        feedback: "This answer is waiting for your teacher to check.",
        gradedBy: "pending",
        confidence: null,
        needsReview: true,
      });
    }
    expect(result.answers[3].response).toBe("Because of chlorophyll.");
    expect(result.totalScore).toBe(2);
    expect(result.maxScore).toBe(8);
    expect(result.needsReview).toBe(true);
    expect(result.aiProvider).toBeNull();
    expect(result.notice).toMatch(/could not be checked automatically/);
    expect(result.notice).toMatch(/teacher will review/);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("does not fail on an error that is not an AiError", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    gradeFreeTextMock.mockRejectedValue(new TypeError("fetch failed"));

    const result = await grade([shortAnswer], { sa: "Because of chlorophyll." });

    expect(result.answers[0]).toMatchObject({ gradedBy: "pending", needsReview: true });
    expect(result.notice).not.toBeNull();
    logged.mockRestore();
  });

  it("leaves an answer for the teacher when the AI skips it", async () => {
    aiReturns([{ itemId: "id", score: 2, feedback: "Correct gas.", confidence: 0.95 }]);

    const result = await grade([identification, shortAnswer], {
      id: "carbon dioxyde",
      sa: "Because of chlorophyll.",
    });

    expect(result.answers[0]).toMatchObject({ gradedBy: "ai", score: 2 });
    expect(result.answers[1]).toMatchObject({ gradedBy: "pending", score: 0, needsReview: true });
    expect(result.needsReview).toBe(true);
    expect(result.aiProvider).toBe("mock");
    expect(result.notice).not.toBeNull();
  });

  it("ignores responses for items that are not in the activity", async () => {
    const result = await grade([multipleChoice], { mc: "Chloroplast", other: "x" });
    expect(result.answers).toHaveLength(1);
    expect(result.totalScore).toBe(1);
  });

  it("trims a response and cuts it to the longest allowed length", async () => {
    aiReturns([{ itemId: "sa", score: 1, feedback: "Too long to follow.", confidence: 0.9 }]);
    const long = "x".repeat(LIMITS.responseMax + 500);

    const result = await grade([shortAnswer], { sa: `  ${long}  ` });

    expect(result.answers[0].response).toHaveLength(LIMITS.responseMax);
    const sent = gradeFreeTextMock.mock.calls[0][0].answers[0].response;
    expect(sent).toHaveLength(LIMITS.responseMax);
  });
});
