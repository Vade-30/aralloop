// Tests for the database layer: the sample data and every write path in
// repo.ts. They run against an in-memory PGlite (see vitest.config.ts), so
// the SQL is exercised by a real PostgreSQL engine.
//
// The tests share one database and run in file order. Tests that change the
// sample data restore it with resetDemoData().

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { GeneratedActivity, ItemInput, NewAnswer } from "../types";
import { closeDb, getDb, query } from "./client";
import {
  DuplicateSubmissionError,
  createActivity,
  createLesson,
  createSubmission,
  deleteActivity,
  getActivity,
  getAnswer,
  getClass,
  getLesson,
  getSubmission,
  getSubmissionById,
  getUser,
  listActivities,
  listLessons,
  listStudents,
  listSubmissions,
  listSubmissionsForStudent,
  listUsers,
  overrideAnswer,
  publishActivity,
  resetDemoData,
  setSubmissionSummary,
  updateActivity,
} from "./repo";
import { SCHEMA_SQL, TABLES } from "./schema";
import { SEED_CONTENT_IDS, SEED_IDS, seedIfEmpty } from "./seed";

const [MIGUEL, ALTHEA, JOSHUA] = SEED_IDS.studentIds;
const PLANT_CELL = SEED_CONTENT_IDS.plantCellActivityId;
const WATER_CYCLE = SEED_CONTENT_IDS.waterCycleActivityId;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

async function rowCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    const [row] = await query<{ count: number }>(
      `select count(*)::int as count from ${table}`,
    );
    counts[table] = row.count;
  }
  return counts;
}

const multipleChoice: ItemInput = {
  type: "multiple_choice",
  question: "Which planet is closest to the Sun?",
  choices: ["Venus", "Mercury", "Earth", "Mars"],
  answerKey: "Mercury",
  acceptedAnswers: [],
  rubric: null,
  explanation: "Mercury has the smallest orbit.",
  points: 1,
};

const identification: ItemInput = {
  type: "identification",
  question: "What is the star at the center of the solar system?",
  choices: null,
  answerKey: "Sun",
  acceptedAnswers: ["The Sun", "Sol"],
  rubric: null,
  explanation: null,
  points: 2,
};

const shortAnswer: ItemInput = {
  type: "short_answer",
  question: "Why does the Moon seem to change shape?",
  choices: null,
  answerKey: "We see different amounts of its lit half as it goes around the Earth.",
  acceptedAnswers: [],
  rubric: "3 points: mentions the lit half, the orbit and the changing view.",
  explanation: "The Moon is always half lit. Our view of that half changes.",
  points: 3,
};

const generated: GeneratedActivity = {
  title: "The solar system",
  instructions: "Answer every item.",
  type: "mixed",
  reason: "The lesson mixes names with one idea that needs explaining.",
  items: [multipleChoice, identification, shortAnswer],
};

/** A draft activity under the plant cell lesson, for the write-path tests. */
function createDraft() {
  return createActivity({
    lessonId: SEED_CONTENT_IDS.plantCellLessonId,
    classId: SEED_IDS.classId,
    generated,
    provider: "mock",
    model: "test-model",
  });
}

afterAll(async () => {
  await closeDb();
});

describe("sample data", () => {
  it("has the class, the teacher, three students and one parent", async () => {
    expect(await getClass(SEED_IDS.classId)).toEqual({
      id: SEED_IDS.classId,
      name: "Grade 7 - Sampaguita",
      gradeLevel: "Grade 7",
      subject: "Science",
      joinCode: "SAMPA7",
    });

    const users = await listUsers();
    // Teachers, then students, then parents, each by name.
    expect(users.map((user) => user.name)).toEqual([
      "Ms. Carmela Reyes",
      "Althea Cruz",
      "Joshua Dela Cruz",
      "Miguel Santos",
      "Mrs. Liza Santos",
    ]);
    expect(users.map((user) => user.role)).toEqual([
      "teacher",
      "student",
      "student",
      "student",
      "parent",
    ]);

    expect((await getUser(SEED_IDS.teacherId))?.name).toBe("Ms. Carmela Reyes");
    expect((await getUser(MIGUEL))?.name).toBe("Miguel Santos");
    expect((await getUser(ALTHEA))?.name).toBe("Althea Cruz");
    expect((await getUser(JOSHUA))?.name).toBe("Joshua Dela Cruz");
    expect(await getUser(SEED_IDS.parentId)).toEqual({
      id: SEED_IDS.parentId,
      name: "Mrs. Liza Santos",
      role: "parent",
      classId: SEED_IDS.classId,
      childId: MIGUEL,
    });

    const students = await listStudents(SEED_IDS.classId);
    expect(students.map((student) => student.id)).toEqual([ALTHEA, JOSHUA, MIGUEL]);
  });

  it("has two lessons of 350 to 450 words, newest first", async () => {
    const lessons = await listLessons(SEED_IDS.classId);
    expect(lessons.map((lesson) => lesson.id)).toEqual([
      SEED_CONTENT_IDS.waterCycleLessonId,
      SEED_CONTENT_IDS.plantCellLessonId,
    ]);
    for (const lesson of lessons) {
      expect(lesson.createdAt).toMatch(ISO);
      expect(wordCount(lesson.content)).toBeGreaterThanOrEqual(350);
      expect(wordCount(lesson.content)).toBeLessThanOrEqual(450);
    }
    expect(await getLesson(SEED_CONTENT_IDS.plantCellLessonId)).toEqual(lessons[1]);
  });

  it("has two published activities with complete answer keys", async () => {
    const plantCell = await getActivity(PLANT_CELL);
    const waterCycle = await getActivity(WATER_CYCLE);
    if (!plantCell || !waterCycle) throw new Error("sample activities are missing");

    expect(plantCell.type).toBe("mixed");
    expect(plantCell.items.map((item) => item.type)).toEqual([
      "multiple_choice",
      "multiple_choice",
      "true_false",
      "identification",
      "identification",
      "short_answer",
    ]);
    expect(waterCycle.items).toHaveLength(5);
    expect(
      waterCycle.items.filter((item) => item.type === "short_answer"),
    ).toHaveLength(2);

    for (const activity of [plantCell, waterCycle]) {
      expect(activity.status).toBe("published");
      expect(activity.aiProvider).toBe("mock");
      expect(activity.aiModel).toBe("sample-data");
      expect(activity.aiReason.length).toBeGreaterThan(20);
      expect(activity.createdAt).toMatch(ISO);
      expect(activity.publishedAt).toMatch(ISO);
      expect(activity.items.map((item) => item.position)).toEqual(
        activity.items.map((_, index) => index + 1),
      );
      // The stored type must describe the items.
      const types = new Set(activity.items.map((item) => item.type));
      expect(activity.type).toBe(types.size === 1 ? [...types][0] : "mixed");

      for (const item of activity.items) {
        expect(item.explanation).toBeTruthy();
        expect(item.answerKey).toBeTruthy();
        if (item.type === "multiple_choice" || item.type === "true_false") {
          expect(item.choices).toContain(item.answerKey);
        } else {
          expect(item.choices).toBeNull();
        }
        if (item.type === "true_false") {
          expect(item.choices).toEqual(["True", "False"]);
        }
        if (item.type === "identification") {
          expect(item.acceptedAnswers.length).toBeGreaterThan(0);
        } else {
          expect(item.acceptedAnswers).toEqual([]);
        }
        if (item.type === "short_answer") {
          expect(item.rubric).toBeTruthy();
        } else {
          expect(item.rubric).toBeNull();
        }
      }
    }
  });

  it("stores totals that agree with the answers", async () => {
    for (const activityId of [PLANT_CELL, WATER_CYCLE]) {
      const activity = await getActivity(activityId);
      if (!activity) throw new Error("sample activity is missing");
      const maxScore = activity.items.reduce((sum, item) => sum + item.points, 0);
      const submissions = await listSubmissions(activityId);
      expect(submissions.length).toBeGreaterThan(0);

      for (const submission of submissions) {
        // One answer per item, in item order.
        expect(submission.answers.map((answer) => answer.itemId)).toEqual(
          activity.items.map((item) => item.id),
        );
        expect(submission.totalScore).toBe(
          submission.answers.reduce((sum, answer) => sum + answer.score, 0),
        );
        expect(submission.maxScore).toBe(maxScore);
        expect(submission.needsReview).toBe(
          submission.answers.some((answer) => answer.needsReview),
        );
        expect(submission.submittedAt).toMatch(ISO);

        submission.answers.forEach((answer, index) => {
          const item = activity.items[index];
          expect(answer.score).toBeGreaterThanOrEqual(0);
          expect(answer.score).toBeLessThanOrEqual(item.points);
          expect(answer.feedback).toBeTruthy();
          if (answer.gradedBy === "ai") {
            expect(answer.confidence).not.toBeNull();
            expect(answer.needsReview).toBe((answer.confidence ?? 0) < 0.7);
          } else {
            expect(answer.gradedBy).toBe("code");
            expect(answer.confidence).toBeNull();
            expect(answer.needsReview).toBe(false);
          }
          // Choice items are always settled by code, with all or nothing.
          if (item.type === "multiple_choice" || item.type === "true_false") {
            expect(answer.gradedBy).toBe("code");
            expect(answer.score).toBe(
              answer.response === item.answerKey ? item.points : 0,
            );
          }
          if (item.type === "short_answer") expect(answer.gradedBy).toBe("ai");
        });
      }
    }
  });

  it("has all three students on the plant cell activity, by name", async () => {
    const submissions = await listSubmissions(PLANT_CELL);
    expect(submissions.map((submission) => submission.studentId)).toEqual([
      ALTHEA,
      JOSHUA,
      MIGUEL,
    ]);
    expect(submissions.map((submission) => submission.totalScore)).toEqual([9, 6, 7]);
    expect(submissions.every((submission) => !submission.needsReview)).toBe(true);
  });

  it("gives Miguel about 70 percent and a stored summary in both languages", async () => {
    const submission = await getSubmission(PLANT_CELL, MIGUEL);
    if (!submission) throw new Error("Miguel's submission is missing");
    expect(submission.totalScore).toBe(7);
    expect(submission.maxScore).toBe(10);
    expect(submission.answers.filter((answer) => answer.score === 0)).toHaveLength(2);
    expect(submission.summaryProvider).toBe("mock");
    // The sample grades were written by hand, so they are labelled as samples.
    expect(submission.gradingProvider).toBe("mock");
    for (const text of [submission.summary?.en, submission.summary?.fil]) {
      expect(text?.overview).toBeTruthy();
      expect(text?.didWell.length).toBeGreaterThan(0);
      expect(text?.toPractice.length).toBeGreaterThan(0);
      expect(text?.homeTip).toBeTruthy();
    }
    expect(await getSubmissionById(submission.id)).toEqual(submission);
  });

  it("leaves the water cycle activity open for Miguel", async () => {
    expect(await getSubmission(WATER_CYCLE, MIGUEL)).toBeNull();

    const submissions = await listSubmissions(WATER_CYCLE);
    expect(submissions.map((submission) => submission.studentId)).toEqual([
      ALTHEA,
      JOSHUA,
    ]);
    for (const submission of submissions) {
      expect(submission.summary).toBeNull();
      expect(submission.summaryProvider).toBeNull();
    }

    const mine = await listSubmissionsForStudent(MIGUEL);
    expect(mine.map((submission) => submission.activityId)).toEqual([PLANT_CELL]);
    // Newest first.
    const joshuas = await listSubmissionsForStudent(JOSHUA);
    expect(joshuas.map((submission) => submission.activityId)).toEqual([
      WATER_CYCLE,
      PLANT_CELL,
    ]);
  });

  it("flags one of Joshua's short answers for the teacher", async () => {
    const activity = await getActivity(WATER_CYCLE);
    const submission = await getSubmission(WATER_CYCLE, JOSHUA);
    if (!activity || !submission) throw new Error("sample data is missing");
    expect(submission.needsReview).toBe(true);

    const flagged = submission.answers.filter((answer) => answer.needsReview);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].gradedBy).toBe("ai");
    expect(flagged[0].confidence).toBe(0.45);
    const item = activity.items.find((candidate) => candidate.id === flagged[0].itemId);
    expect(item?.type).toBe("short_answer");

    expect((await getSubmission(WATER_CYCLE, ALTHEA))?.needsReview).toBe(false);
  });

  it("is not inserted twice", async () => {
    const before = await rowCounts();
    await seedIfEmpty(await getDb());
    expect(await rowCounts()).toEqual(before);
  });
});

describe("lessons", () => {
  it("creates a lesson and lists it first", async () => {
    const lesson = await createLesson({
      classId: SEED_IDS.classId,
      title: "The solar system",
      content: "The Sun is a star. Eight planets go around it.",
    });
    expect(lesson.id).toBeTruthy();
    expect(lesson.classId).toBe(SEED_IDS.classId);
    expect(lesson.createdAt).toMatch(ISO);
    expect(await getLesson(lesson.id)).toEqual(lesson);
    expect((await listLessons(SEED_IDS.classId))[0]).toEqual(lesson);
  });

  it("returns null for ids that do not exist", async () => {
    expect(await getClass("missing")).toBeNull();
    expect(await getUser("missing")).toBeNull();
    expect(await getLesson("missing")).toBeNull();
    expect(await getActivity("missing")).toBeNull();
    expect(await getSubmission("missing", MIGUEL)).toBeNull();
    expect(await getSubmissionById("missing")).toBeNull();
    expect(await getAnswer("missing")).toBeNull();
    expect(await listSubmissions("missing")).toEqual([]);
  });
});

describe("activities", () => {
  it("stores a generated activity as a draft and reads it back", async () => {
    const created = await createDraft();

    expect(created).toMatchObject({
      lessonId: SEED_CONTENT_IDS.plantCellLessonId,
      classId: SEED_IDS.classId,
      title: generated.title,
      instructions: generated.instructions,
      type: "mixed",
      aiReason: generated.reason,
      status: "draft",
      aiProvider: "mock",
      aiModel: "test-model",
      publishedAt: null,
    });
    expect(created.createdAt).toMatch(ISO);

    // jsonb fields come back as real arrays and null, not as JSON text.
    expect(created.items).toHaveLength(3);
    created.items.forEach((item, index) => {
      const { id, activityId, position, ...rest } = item;
      expect(id).toBeTruthy();
      expect(activityId).toBe(created.id);
      expect(position).toBe(index + 1);
      expect(rest).toEqual(generated.items[index]);
    });
    expect(new Set(created.items.map((item) => item.id)).size).toBe(3);

    expect(await getActivity(created.id)).toEqual(created);
    await deleteActivity(created.id);
  });

  it("replaces the items and recomputes the type on update", async () => {
    const draft = await createDraft();

    const single = await updateActivity(draft.id, {
      title: "The solar system, edited",
      instructions: "Choose the best answer.",
      items: [
        { ...multipleChoice, points: 2 },
        { ...multipleChoice, question: "Which planet is the largest?", answerKey: "Venus" },
      ],
    });
    if (!single) throw new Error("update returned null");
    expect(single.title).toBe("The solar system, edited");
    expect(single.instructions).toBe("Choose the best answer.");
    expect(single.type).toBe("multiple_choice");
    expect(single.status).toBe("draft");
    expect(single.aiReason).toBe(generated.reason);
    expect(single.items.map((item) => item.position)).toEqual([1, 2]);
    expect(single.items.map((item) => item.points)).toEqual([2, 1]);
    expect(single.items[1].question).toBe("Which planet is the largest?");
    // The old items are gone, not kept beside the new ones.
    const oldIds = new Set(draft.items.map((item) => item.id));
    expect(single.items.some((item) => oldIds.has(item.id))).toBe(false);
    const [stored] = await query<{ count: number }>(
      "select count(*)::int as count from items where activity_id = $1",
      [draft.id],
    );
    expect(stored.count).toBe(2);
    expect(await getActivity(draft.id)).toEqual(single);

    const mixed = await updateActivity(draft.id, {
      title: single.title,
      instructions: single.instructions,
      items: [shortAnswer, multipleChoice, identification],
    });
    expect(mixed?.type).toBe("mixed");
    expect(mixed?.items.map((item) => item.type)).toEqual([
      "short_answer",
      "multiple_choice",
      "identification",
    ]);
    expect(mixed?.items[2].acceptedAnswers).toEqual(["The Sun", "Sol"]);

    expect(
      await updateActivity("missing", { title: "x", instructions: "", items: [shortAnswer] }),
    ).toBeNull();
    await deleteActivity(draft.id);
  });

  it("refuses to update a published activity, so students' answers are kept", async () => {
    const before = await getActivity(PLANT_CELL);
    const countsBefore = await rowCounts();

    expect(
      await updateActivity(PLANT_CELL, { title: "x", instructions: "", items: [shortAnswer] }),
    ).toBeNull();

    expect(await getActivity(PLANT_CELL)).toEqual(before);
    expect(await rowCounts()).toEqual(countsBefore);
  });

  it("publishes a draft and stamps the time", async () => {
    const draft = await createDraft();
    const published = await publishActivity(draft.id);
    expect(published?.status).toBe("published");
    expect(published?.publishedAt).toMatch(ISO);

    const stored = await getActivity(draft.id);
    expect(stored?.status).toBe("published");
    expect(stored?.publishedAt).toBe(published?.publishedAt);
    expect(stored?.items).toHaveLength(3);

    expect(await publishActivity("missing")).toBeNull();
    await deleteActivity(draft.id);
  });

  it("lists activities newest first with their counts", async () => {
    const draft = await createDraft();

    const all = await listActivities(SEED_IDS.classId);
    expect(all.map((activity) => activity.id)).toEqual([draft.id, WATER_CYCLE, PLANT_CELL]);

    expect(all[0]).toMatchObject({
      status: "draft",
      lessonTitle: "The parts of a plant cell",
      itemCount: 3,
      maxScore: 6,
      submissionCount: 0,
      needsReviewCount: 0,
    });
    expect(all[1]).toMatchObject({
      status: "published",
      lessonTitle: "The water cycle and why it matters to a farming community",
      itemCount: 5,
      maxScore: 10,
      submissionCount: 2,
      needsReviewCount: 1,
    });
    expect(all[2]).toMatchObject({
      status: "published",
      lessonTitle: "The parts of a plant cell",
      itemCount: 6,
      maxScore: 10,
      submissionCount: 3,
      needsReviewCount: 0,
    });
    expect(all[2].createdAt).toMatch(ISO);

    const published = await listActivities(SEED_IDS.classId, { status: "published" });
    expect(published.map((activity) => activity.id)).toEqual([WATER_CYCLE, PLANT_CELL]);
    const drafts = await listActivities(SEED_IDS.classId, { status: "draft" });
    expect(drafts.map((activity) => activity.id)).toEqual([draft.id]);
    expect(await listActivities("missing")).toEqual([]);

    await deleteActivity(draft.id);
    expect(await getActivity(draft.id)).toBeNull();
    expect(await listActivities(SEED_IDS.classId)).toHaveLength(2);
  });
});

describe("submissions", () => {
  async function miguelsWaterCycleAnswers(): Promise<NewAnswer[]> {
    const activity = await getActivity(WATER_CYCLE);
    if (!activity) throw new Error("sample activity is missing");
    const [choice, trueFalse, term, lateRain, trees] = activity.items;
    return [
      // Given out of item order on purpose: they must come back in item order.
      {
        itemId: trees.id,
        response: "Trees stop floods.",
        score: 1.5,
        feedback: "One way, partly explained.",
        gradedBy: "ai",
        confidence: 0.5,
        needsReview: true,
      },
      {
        itemId: choice.id,
        response: "The Sun",
        score: 1,
        feedback: "Correct.",
        gradedBy: "code",
        confidence: null,
        needsReview: false,
      },
      {
        itemId: trueFalse.id,
        response: "False",
        score: 0,
        feedback: "The correct answer is True.",
        gradedBy: "code",
        confidence: null,
        needsReview: false,
      },
      {
        itemId: term.id,
        response: "Condensation",
        score: 2,
        feedback: "Correct.",
        gradedBy: "code",
        confidence: null,
        needsReview: false,
      },
      {
        itemId: lateRain.id,
        response: "",
        score: 0,
        feedback: "No answer was given.",
        gradedBy: "pending",
        confidence: null,
        needsReview: true,
      },
    ];
  }

  it("stores a graded submission and rejects a second one", async () => {
    const activity = await getActivity(WATER_CYCLE);
    const answers = await miguelsWaterCycleAnswers();
    const created = await createSubmission({
      activityId: WATER_CYCLE,
      studentId: MIGUEL,
      answers,
      totalScore: 4.5,
      maxScore: 10,
      gradingProvider: "gemini",
    });

    expect(created).toMatchObject({
      activityId: WATER_CYCLE,
      studentId: MIGUEL,
      totalScore: 4.5,
      maxScore: 10,
      needsReview: true,
      summary: null,
      summaryProvider: null,
      gradingProvider: "gemini",
    });
    expect(created.submittedAt).toMatch(ISO);
    expect(created.answers.map((answer) => answer.itemId)).toEqual(
      activity?.items.map((item) => item.id),
    );
    const trees = created.answers[4];
    expect(trees).toMatchObject({
      submissionId: created.id,
      response: "Trees stop floods.",
      score: 1.5,
      gradedBy: "ai",
      confidence: 0.5,
      needsReview: true,
    });
    expect(created.answers[3].gradedBy).toBe("pending");
    expect(await getSubmission(WATER_CYCLE, MIGUEL)).toEqual(created);
    expect(await getAnswer(trees.id)).toEqual(trees);

    await expect(
      createSubmission({
        activityId: WATER_CYCLE,
        studentId: MIGUEL,
        answers,
        totalScore: 10,
        maxScore: 10,
      }),
    ).rejects.toBeInstanceOf(DuplicateSubmissionError);

    // The rejected attempt left nothing behind.
    expect(await getSubmission(WATER_CYCLE, MIGUEL)).toEqual(created);
    const [stored] = await query<{ count: number }>(
      "select count(*)::int as count from answers where submission_id = $1",
      [created.id],
    );
    expect(stored.count).toBe(5);

    const [summary] = (await listActivities(SEED_IDS.classId)).filter(
      (candidate) => candidate.id === WATER_CYCLE,
    );
    expect(summary.submissionCount).toBe(3);
    expect(summary.needsReviewCount).toBe(2);

    await resetDemoData();
  });

  it("does not need review when no answer does", async () => {
    const answers = (await miguelsWaterCycleAnswers()).map((answer) => ({
      ...answer,
      gradedBy: "code" as const,
      confidence: null,
      needsReview: false,
    }));
    const created = await createSubmission({
      activityId: WATER_CYCLE,
      studentId: MIGUEL,
      answers,
      totalScore: 4.5,
      maxScore: 10,
    });
    expect(created.needsReview).toBe(false);
    await resetDemoData();
  });

  it("rolls back when an answer cannot be stored", async () => {
    const answers = await miguelsWaterCycleAnswers();
    answers[0] = { ...answers[0], itemId: "missing-item" };
    const attempt = createSubmission({
      activityId: WATER_CYCLE,
      studentId: MIGUEL,
      answers,
      totalScore: 0,
      maxScore: 10,
    });
    await expect(attempt).rejects.toThrow();
    await expect(attempt).rejects.not.toBeInstanceOf(DuplicateSubmissionError);
    expect(await getSubmission(WATER_CYCLE, MIGUEL)).toBeNull();
  });

  it("stores a parent summary", async () => {
    const submission = await getSubmission(WATER_CYCLE, ALTHEA);
    if (!submission) throw new Error("sample submission is missing");
    const text = {
      overview: "Althea did well.",
      didWell: ["She explained late rain."],
      toPractice: ["Explaining how trees help."],
      homeTip: "Talk about where rain goes.",
    };
    await setSubmissionSummary(submission.id, { en: text, fil: text }, "gemini");

    const stored = await getSubmissionById(submission.id);
    expect(stored?.summary).toEqual({ en: text, fil: text });
    expect(stored?.summaryProvider).toBe("gemini");
    await resetDemoData();
  });

  it("recomputes totals and clears the summary on a teacher override", async () => {
    // Joshua's flagged answer: the review flag must clear.
    const joshua = await getSubmission(WATER_CYCLE, JOSHUA);
    if (!joshua) throw new Error("sample submission is missing");
    const flagged = joshua.answers.find((answer) => answer.needsReview);
    if (!flagged) throw new Error("no flagged answer in the sample data");

    const reviewed = await overrideAnswer(flagged.id, {
      score: 2,
      feedback: "You named one effect and hinted at the reason.",
    });
    if (!reviewed) throw new Error("override returned null");
    expect(reviewed.id).toBe(joshua.id);
    expect(reviewed.totalScore).toBe(joshua.totalScore - flagged.score + 2);
    expect(reviewed.totalScore).toBe(
      reviewed.answers.reduce((sum, answer) => sum + answer.score, 0),
    );
    expect(reviewed.maxScore).toBe(joshua.maxScore);
    expect(reviewed.needsReview).toBe(false);
    expect(reviewed.answers.find((answer) => answer.id === flagged.id)).toMatchObject({
      score: 2,
      feedback: "You named one effect and hinted at the reason.",
      gradedBy: "teacher",
      needsReview: false,
      response: flagged.response,
    });
    // Other answers are untouched.
    expect(reviewed.answers.filter((answer) => answer.id !== flagged.id)).toEqual(
      joshua.answers.filter((answer) => answer.id !== flagged.id),
    );
    expect(await getSubmissionById(joshua.id)).toEqual(reviewed);
    const [summary] = (await listActivities(SEED_IDS.classId)).filter(
      (candidate) => candidate.id === WATER_CYCLE,
    );
    expect(summary.needsReviewCount).toBe(0);

    // Miguel's submission has a stored summary: it must be cleared.
    const miguel = await getSubmission(PLANT_CELL, MIGUEL);
    if (!miguel) throw new Error("sample submission is missing");
    expect(miguel.summary).not.toBeNull();
    const wrong = miguel.answers[1];
    expect(wrong.score).toBe(0);

    const changed = await overrideAnswer(wrong.id, { score: 0.5 });
    expect(changed?.totalScore).toBe(7.5);
    expect(changed?.summary).toBeNull();
    expect(changed?.summaryProvider).toBeNull();
    // Feedback is kept when none is given.
    expect(changed?.answers[1]).toMatchObject({
      score: 0.5,
      feedback: wrong.feedback,
      gradedBy: "teacher",
    });

    expect(await overrideAnswer("missing", { score: 1 })).toBeNull();
    await resetDemoData();
  });
});

describe("demo reset", () => {
  it("wipes everything and restores the sample data", async () => {
    const before = await rowCounts();
    expect(before).toEqual({
      answers: 28,
      submissions: 5,
      items: 11,
      activities: 2,
      lessons: 2,
      users: 5,
      classes: 1,
    });
    const original = await getSubmission(PLANT_CELL, MIGUEL);

    const lesson = await createLesson({
      classId: SEED_IDS.classId,
      title: "Extra lesson",
      content: "This lesson is removed by the reset.",
    });
    const draft = await createActivity({
      lessonId: lesson.id,
      classId: SEED_IDS.classId,
      generated,
      provider: "mock",
      model: "test-model",
    });
    await deleteActivity(PLANT_CELL);
    expect(await getSubmission(PLANT_CELL, MIGUEL)).toBeNull();

    await resetDemoData();

    expect(await rowCounts()).toEqual(before);
    expect(await getLesson(lesson.id)).toBeNull();
    expect(await getActivity(draft.id)).toBeNull();
    expect(await getSubmission(PLANT_CELL, MIGUEL)).toEqual(original);
    expect(await getSubmission(WATER_CYCLE, MIGUEL)).toBeNull();
  });
});

describe("schema upgrade", () => {
  it("adds grading_provider to a database made before the column existed", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const old = new PGlite();
    try {
      const statements = SCHEMA_SQL.split(";").filter((statement) => statement.trim());
      // The earlier schema: no grading_provider column and no alter statement.
      for (const statement of statements) {
        if (statement.includes("alter table submissions")) continue;
        await old.query(statement.replace(/^\s*grading_provider .*\n/m, ""));
      }
      const columns = async () =>
        (
          await old.query<{ column_name: string }>(
            "select column_name from information_schema.columns where table_name = 'submissions'",
          )
        ).rows.map((row) => row.column_name);
      expect(await columns()).not.toContain("grading_provider");

      // What the app does on every start. Running it twice must be harmless.
      for (let run = 0; run < 2; run++) {
        for (const statement of statements) await old.query(statement);
      }
      expect(await columns()).toContain("grading_provider");
    } finally {
      await old.close();
    }
  });
});

describe("db/schema.sql", () => {
  it("is the same SQL the app applies", () => {
    const file = readFileSync(path.resolve("db/schema.sql"), "utf8");
    const withoutHeader = file
      .split(/\r?\n/)
      .filter((line) => !line.startsWith("--"))
      .join("\n");
    expect(withoutHeader.trim()).toBe(SCHEMA_SQL.trim());
  });
});
