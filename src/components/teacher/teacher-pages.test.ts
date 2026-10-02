// Renders the teacher screens against the sample data in an in-memory
// database (see vitest.config.ts). Only the session and the router are faked,
// so the pages run their real repository calls.
//
// These checks cover what the server sends: that each screen loads, shows the
// states it promises, and refuses another class's data. They do not click
// anything; the editor's rules are tested in editor-model.test.ts.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedActivity, Item, SubmissionWithAnswers, User } from "@/lib/types";

const mocks = vi.hoisted(() => ({ requireRole: vi.fn() }));

vi.mock("@/lib/session", () => ({ requireRole: mocks.requireRole }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

import ActivityPage from "@/app/teacher/activities/[activityId]/page";
import ResultsPage from "@/app/teacher/activities/[activityId]/results/page";
import LessonPage from "@/app/teacher/lessons/[lessonId]/page";
import NewLessonPage from "@/app/teacher/lessons/new/page";
import TeacherDashboardPage from "@/app/teacher/page";
import { StudentResults } from "@/components/teacher/StudentResults";
import { closeDb } from "@/lib/db/client";
import {
  createActivity,
  createLesson,
  deleteActivity,
  getUser,
  listStudents,
  overrideAnswer,
  listSubmissions,
  resetDemoData,
} from "@/lib/db/repo";
import { SEED_CONTENT_IDS, SEED_IDS } from "@/lib/db/seed";

const searchParams = Promise.resolve({});
const activityProps = (activityId: string) => ({
  params: Promise.resolve({ activityId }),
  searchParams,
});
const lessonProps = (lessonId: string) => ({ params: Promise.resolve({ lessonId }), searchParams });

/** Rendered HTML with tags removed, so assertions read like the screen. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

const generated: GeneratedActivity = {
  title: "Water cycle quick check",
  instructions: "Answer each item.",
  type: "mixed",
  reason: "The lesson mixes terms to recall with a process to explain.",
  items: [
    {
      type: "multiple_choice",
      question: "What is water vapour turning into droplets called?",
      choices: ["Evaporation", "Condensation", "Precipitation"],
      answerKey: "Condensation",
      acceptedAnswers: [],
      rubric: null,
      explanation: "Vapour cools and condenses into droplets.",
      points: 1,
    },
    {
      type: "short_answer",
      question: "Explain why puddles disappear on a sunny day.",
      choices: null,
      answerKey: "Heat from the sun makes the water evaporate.",
      acceptedAnswers: [],
      rubric: "Mentions heat and evaporation.",
      explanation: null,
      points: 2,
    },
  ],
};

let teacher: User;

beforeEach(async () => {
  const found = await getUser(SEED_IDS.teacherId);
  if (!found) throw new Error("The sample teacher is missing.");
  teacher = found;
  mocks.requireRole.mockReset();
  mocks.requireRole.mockResolvedValue(teacher);
});

afterAll(async () => {
  await resetDemoData();
  await closeDb();
});

describe("dashboard", () => {
  it("shows the class, its lessons and each activity's progress", async () => {
    const page = text(renderToStaticMarkup(await TeacherDashboardPage()));
    expect(mocks.requireRole).toHaveBeenCalledWith("teacher");
    expect(page).toContain("Join code");
    expect(page).toContain("New lesson");
    expect(page).toContain("3 students in this class");
    expect(page).toContain("Published");
    // The plant cell activity was answered by everyone, the water cycle one by two.
    expect(page).toContain("3 of 3 submitted");
    expect(page).toContain("2 of 3 submitted");
  });

  it("links a published activity to its results and a draft to the editor", async () => {
    const draft = await createActivity({
      lessonId: SEED_CONTENT_IDS.waterCycleLessonId,
      classId: teacher.classId,
      generated,
      provider: "mock",
      model: "sample",
    });
    try {
      const html = renderToStaticMarkup(await TeacherDashboardPage());
      expect(html).toContain(
        `href="/teacher/activities/${SEED_CONTENT_IDS.plantCellActivityId}/results"`,
      );
      expect(html).toContain(`href="/teacher/activities/${draft.id}"`);
      expect(html).not.toContain(`href="/teacher/activities/${draft.id}/results"`);
      expect(text(html)).toContain("Draft");
    } finally {
      await deleteActivity(draft.id);
    }
  });

  it("offers a lesson page link for a lesson with no activity", async () => {
    const lesson = await createLesson({
      classId: teacher.classId,
      title: "A lesson without an activity",
      content: "Sample lesson text. ".repeat(10),
    });
    try {
      const html = renderToStaticMarkup(await TeacherDashboardPage());
      expect(text(html)).toContain("No activity yet.");
      expect(html).toContain(`href="/teacher/lessons/${lesson.id}"`);
    } finally {
      await resetDemoData();
    }
  });
});

describe("new lesson", () => {
  it("renders the form with its labelled fields", async () => {
    const page = text(renderToStaticMarkup(await NewLessonPage()));
    for (const label of [
      "Lesson title",
      "Lesson text",
      "Upload files or photos instead",
      "Number of items",
      "Format",
      "Let the AI choose (recommended)",
      "Generate activity",
      "0 / 20,000 characters",
    ]) {
      expect(page).toContain(label);
    }
  });
});

describe("lesson page", () => {
  it("shows the lesson, its activities and the generate form", async () => {
    const page = text(
      renderToStaticMarkup(await LessonPage(lessonProps(SEED_CONTENT_IDS.plantCellLessonId))),
    );
    expect(page).toContain("Lesson text");
    expect(page).toContain("Generate another activity");
    expect(page).toContain("3 of 3 submitted");
  });

  it("is not found for a missing lesson or another class's lesson", async () => {
    await expect(LessonPage(lessonProps("no-such-lesson"))).rejects.toThrow("NOT_FOUND");
    mocks.requireRole.mockResolvedValue({ ...teacher, classId: "another-class" });
    await expect(LessonPage(lessonProps(SEED_CONTENT_IDS.plantCellLessonId))).rejects.toThrow(
      "NOT_FOUND",
    );
  });
});

describe("activity page", () => {
  it("opens a draft in the editor, labelled as an AI draft students cannot see", async () => {
    const draft = await createActivity({
      lessonId: SEED_CONTENT_IDS.waterCycleLessonId,
      classId: teacher.classId,
      generated,
      provider: "openai",
      model: "sample",
    });
    try {
      const html = renderToStaticMarkup(await ActivityPage(activityProps(draft.id)));
      const page = text(html);
      for (const expected of [
        "Edit anything the AI wrote",
        "Why this format",
        generated.reason,
        "AI-generated draft",
        "Nothing is visible to students until you publish.",
        // A draft the AI wrote in full opens with every item ready.
        "Ready to publish",
        "2 of 2 items ready",
        "Student view",
        "Item 1",
        "Item 2",
        "Mark choice 2 as correct",
        "Model answer",
        "Rubric",
        "Add item",
        "Save draft",
        "Publish to class",
        "Delete draft",
      ]) {
        expect(page).toContain(expected);
      }
      // The correct choice arrives already marked. The answer type is a radio
      // group too, so this looks at the group that marks the correct choice.
      expect(html).toMatch(/<input[^>]*type="radio"[^>]*name="[^"]*-correct"[^>]*checked=""/);
      // Each item's answer type arrives chosen as well.
      expect(html).toMatch(/<input[^>]*name="[^"]*-type"[^>]*checked=""[^>]*value="short_answer"/);
    } finally {
      await deleteActivity(draft.id);
    }
  });

  it("says so when the draft came from sample mode rather than real AI", async () => {
    const draft = await createActivity({
      lessonId: SEED_CONTENT_IDS.waterCycleLessonId,
      classId: teacher.classId,
      generated,
      provider: "mock",
      model: "sample",
    });
    try {
      const page = text(renderToStaticMarkup(await ActivityPage(activityProps(draft.id))));
      expect(page).toContain("Sample mode · not real AI");
      expect(page).not.toContain("AI-generated draft");
      expect(page).toContain("Edit anything in this sample draft");
      expect(page).not.toContain("the AI wrote");
    } finally {
      await deleteActivity(draft.id);
    }
  });

  it("shows a published activity read-only with its answer key", async () => {
    const page = text(
      renderToStaticMarkup(
        await ActivityPage(activityProps(SEED_CONTENT_IDS.plantCellActivityId)),
      ),
    );
    expect(page).toContain("View results");
    expect(page).toContain("Items and answer key");
    expect(page).not.toContain("Save draft");
    expect(page).not.toContain("Publish to class");
  });

  it("is not found for a missing activity or another class's activity", async () => {
    await expect(ActivityPage(activityProps("no-such-activity"))).rejects.toThrow("NOT_FOUND");
    mocks.requireRole.mockResolvedValue({ ...teacher, classId: "another-class" });
    await expect(
      ActivityPage(activityProps(SEED_CONTENT_IDS.plantCellActivityId)),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      ResultsPage(activityProps(SEED_CONTENT_IDS.plantCellActivityId)),
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("results page", () => {
  it("sends a draft back to the editor", async () => {
    const draft = await createActivity({
      lessonId: SEED_CONTENT_IDS.waterCycleLessonId,
      classId: teacher.classId,
      generated,
      provider: "mock",
      model: "sample",
    });
    try {
      await expect(ResultsPage(activityProps(draft.id))).rejects.toThrow(
        `REDIRECT /teacher/activities/${draft.id}`,
      );
    } finally {
      await deleteActivity(draft.id);
    }
  });

  it("lists every student, with a muted row for one who has not submitted", async () => {
    const students = await listStudents(teacher.classId);
    const page = text(
      renderToStaticMarkup(
        await ResultsPage(activityProps(SEED_CONTENT_IDS.waterCycleActivityId)),
      ),
    );
    for (const student of students) expect(page).toContain(student.name);
    expect(page).toContain("2 of 3");
    expect(page.match(/Not submitted yet/g)).toHaveLength(1);
    expect(page).toContain("Item analysis");
    expect(page).toContain("earned full points");
    expect(page).toContain("Class average");
  });

  it("shows each answer with how it was graded and a way to change the score", async () => {
    const submissions = await listSubmissions(SEED_CONTENT_IDS.plantCellActivityId);
    const answers = submissions.flatMap((submission) => submission.answers);
    const page = text(
      renderToStaticMarkup(
        await ResultsPage(activityProps(SEED_CONTENT_IDS.plantCellActivityId)),
      ),
    );
    expect(page).toContain("3 of 3");
    expect(page).not.toContain("Not submitted yet");
    expect(page).toContain("Student's answer");
    if (answers.some((answer) => answer.gradedBy === "code")) {
      expect(page).toContain("Checked by answer key");
    }
    // Answers waiting for review open their form; the rest offer a button.
    const waiting = answers.filter((answer) => answer.needsReview).length;
    expect(page.match(/Save score/g) ?? []).toHaveLength(waiting);
    expect(page.match(/Change score/g) ?? []).toHaveLength(answers.length - waiting);
    expect(page.match(/Needs your review/g) ?? []).toHaveLength(waiting);
  });

  it("does not call a flagged sample-mode grade the AI's", async () => {
    // The sample submissions were graded in sample mode; one answer is flagged.
    const page = text(
      renderToStaticMarkup(
        await ResultsPage(activityProps(SEED_CONTENT_IDS.waterCycleActivityId)),
      ),
    );
    expect(page).toContain("Needs your review");
    expect(page).toContain("This is a sample check, not AI.");
    expect(page).not.toContain("The AI was not sure about this grade.");
  });

  it("says the AI was not sure when a real AI service gave the flagged grade", () => {
    const submission: SubmissionWithAnswers = {
      id: "submission-1",
      activityId: "activity-1",
      studentId: teacher.id,
      totalScore: 1,
      maxScore: 2,
      needsReview: true,
      summary: null,
      summaryProvider: null,
      gradingProvider: "gemini",
      submittedAt: "2026-10-02T00:00:00.000Z",
      answers: [
        {
          id: "answer-1",
          submissionId: "submission-1",
          itemId: "item-1",
          response: "The sun dries it.",
          score: 1,
          feedback: "Partly right.",
          gradedBy: "ai",
          confidence: 0.5,
          needsReview: true,
        },
      ],
    };
    const item: Item = {
      id: "item-1",
      activityId: "activity-1",
      position: 1,
      ...generated.items[1],
    };
    const page = text(
      renderToStaticMarkup(
        createElement(StudentResults, {
          students: [teacher],
          submissions: [submission],
          items: [item],
          // The service configured now must not change how a stored grade is described.
          aiProvider: "mock",
        }),
      ),
    );
    expect(page).toContain("The AI was not sure about this grade.");
    expect(page).not.toContain("sample check");
  });

  it("labels a score the teacher set and shows the new feedback", async () => {
    const submissions = await listSubmissions(SEED_CONTENT_IDS.plantCellActivityId);
    const target = submissions.flatMap((submission) => submission.answers)[0];
    try {
      await overrideAnswer(target.id, { score: 0, feedback: "Checked in class." });
      const page = text(
        renderToStaticMarkup(
          await ResultsPage(activityProps(SEED_CONTENT_IDS.plantCellActivityId)),
        ),
      );
      expect(page).toContain("Set by teacher");
      expect(page).toContain("Checked in class.");
    } finally {
      await resetDemoData();
    }
  });
});
