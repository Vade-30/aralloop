// Renders the student home against a fake repository, and the answer form on
// its own. The home must sort activities into "To do" and "Done" and count
// them correctly; the form must show one question at a time while keeping
// every question, and the submit button, in the page.

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ActivitySummary,
  PublicItem,
  SchoolClass,
  Submission,
  User,
} from "@/lib/types";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getClass: vi.fn(),
  listActivities: vi.fn(),
  listSubmissionsForStudent: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/db/repo", () => mocks);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

import StudentHomePage from "@/app/student/page";
import { AnswerForm } from "./AnswerForm";

const student: User = {
  id: "student-1",
  name: "Sample Student",
  role: "student",
  classId: "class-1",
  childId: null,
};

const schoolClass: SchoolClass = {
  id: "class-1",
  name: "Sample Section",
  gradeLevel: "Grade 7",
  subject: "Science",
  joinCode: "SAMPLE",
};

function activityRow(id: string, title: string, publishedAt: string): ActivitySummary {
  return {
    id,
    lessonId: "lesson-1",
    classId: "class-1",
    title,
    instructions: "",
    type: "mixed",
    aiReason: "",
    status: "published",
    aiProvider: "mock",
    aiModel: "sample",
    createdAt: "2026-10-01T00:00:00.000Z",
    publishedAt,
    lessonTitle: "The cell",
    itemCount: 3,
    maxScore: 4,
    submissionCount: 0,
    needsReviewCount: 0,
  };
}

// The answered activity is the newer one, so sorting by date alone would put
// it first; the page must still list the unanswered one first.
const answered = activityRow("activity-done", "Parts of the cell", "2026-10-02T00:00:00.000Z");
const unanswered = activityRow("activity-new", "Cell division", "2026-10-01T00:00:00.000Z");

const submission: Submission = {
  id: "submission-1",
  activityId: "activity-done",
  studentId: "student-1",
  totalScore: 2,
  maxScore: 4,
  needsReview: true,
  summary: null,
  summaryProvider: null,
  gradingProvider: null,
  submittedAt: "2026-10-02T02:00:00.000Z",
};

const items: PublicItem[] = [
  {
    id: "item-1",
    activityId: "activity-new",
    position: 1,
    type: "identification",
    question: "Which part of the cell releases energy?",
    choices: null,
    points: 1,
  },
  {
    id: "item-2",
    activityId: "activity-new",
    position: 2,
    type: "short_answer",
    question: "Why do cells need energy?",
    choices: null,
    points: 2,
  },
  {
    id: "item-3",
    activityId: "activity-new",
    position: 3,
    type: "multiple_choice",
    question: "Which one is a cell part?",
    choices: ["Nucleus", "Planet", "River"],
    points: 1,
  },
];

function html(tree: ReactNode): string {
  return renderToStaticMarkup(createElement("div", null, tree));
}

/** Rendered HTML with tags removed, so assertions read like the screen. */
function text(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

beforeEach(() => {
  mocks.requireRole.mockReset().mockResolvedValue(student);
  mocks.getClass.mockReset().mockResolvedValue(schoolClass);
  mocks.listActivities.mockReset().mockResolvedValue([unanswered, answered]);
  mocks.listSubmissionsForStudent.mockReset().mockResolvedValue([submission]);
});

describe("student home", () => {
  it("greets the student by first name and loads only their own class and answers", async () => {
    const markup = html(await StudentHomePage());
    expect(mocks.requireRole).toHaveBeenCalledWith("student");
    expect(mocks.listActivities).toHaveBeenCalledWith("class-1", { status: "published" });
    expect(mocks.listSubmissionsForStudent).toHaveBeenCalledWith("student-1");
    expect(text(markup)).toContain("Hello, Sample");
    expect(text(markup)).not.toContain("Hello, Sample Student");
    expect(text(markup)).toContain("Sample Section · Science");
  });

  it("lists activities to do before the ones already answered", async () => {
    const markup = html(await StudentHomePage());
    const toDo = markup.indexOf("Cell division");
    const done = markup.indexOf("Parts of the cell");
    expect(toDo).toBeGreaterThan(-1);
    expect(done).toBeGreaterThan(toDo);

    // One link each: "Start" for the new activity, "Review" for the answered one.
    expect(markup.match(/href="\/student\/activities\/activity-new"/g)).toHaveLength(1);
    expect(markup.match(/href="\/student\/activities\/activity-done"/g)).toHaveLength(1);
    const screen = text(markup);
    expect(screen).toContain("Not started");
    expect(screen).toContain("Start");
    expect(screen).toContain("Review");
    // The answered activity shows its score, read out in words.
    expect(markup).toContain('aria-label="Score: 2 out of 4"');
    expect(screen).toContain("Your score 2 / 4");
  });

  it("counts what is to do, done, the average and what the teacher is checking", async () => {
    const screen = text(html(await StudentHomePage()));
    expect(screen).toContain("1 To do");
    expect(screen).toContain("1 Done");
    expect(screen).toContain("50% Average score");
    expect(screen).toContain("1 Teacher is checking");
    expect(screen).toContain("1 activity to do");
  });

  it("shows no average and no review chip when nothing is answered", async () => {
    mocks.listSubmissionsForStudent.mockResolvedValue([]);
    const screen = text(html(await StudentHomePage()));
    expect(screen).toContain("2 To do");
    expect(screen).toContain("0 Done");
    expect(screen).toContain("– Average score");
    expect(screen).toContain("0 Teacher is checking");
    expect(screen).toContain("Nothing done yet");
  });

  it("says so when every activity is answered", async () => {
    mocks.listActivities.mockResolvedValue([answered]);
    const screen = text(html(await StudentHomePage()));
    expect(screen).toContain("You have answered every activity.");
    expect(screen).toContain("Nothing to do right now");
  });

  it("shows an empty state when the class has no activities", async () => {
    mocks.listActivities.mockResolvedValue([]);
    mocks.listSubmissionsForStudent.mockResolvedValue([]);
    const screen = text(html(await StudentHomePage()));
    expect(screen).toContain("No activities yet");
    expect(screen).not.toContain("Activities done");
  });

  it("ignores answers to activities that are not listed", async () => {
    // For example an activity of a class the student has since left.
    mocks.listSubmissionsForStudent.mockResolvedValue([
      submission,
      { ...submission, id: "submission-2", activityId: "activity-elsewhere", totalScore: 4 },
    ]);
    const screen = text(html(await StudentHomePage()));
    expect(screen).toContain("1 Done");
    expect(screen).toContain("50% Average score");
  });
});

describe("answer form", () => {
  const markup = () => html(createElement(AnswerForm, { activityId: "activity-new", items }));

  it("starts on the first question with every other step hidden", () => {
    const page = markup();
    expect(text(page)).toContain("Question 1 of 3");
    // Hidden: questions 2 and 3, the review list and the submit buttons.
    expect(page.match(/ hidden=""/g)).toHaveLength(4);
    const firstHidden = page.indexOf(' hidden=""');
    expect(page.indexOf("Which part of the cell releases energy?")).toBeLessThan(firstHidden);
    expect(page.indexOf("Why do cells need energy?")).toBeGreaterThan(firstHidden);
  });

  it("keeps every question in the page as a labelled control", () => {
    const page = markup();
    expect(page).toContain('<label for="answer-item-1"');
    expect(page).toContain('id="answer-item-1"');
    expect(page).toContain('<label for="answer-item-2"');
    expect(page).toContain('<textarea id="answer-item-2"');
    expect(page).toContain('aria-describedby="answer-item-2-count"');
    // Choices are real radio buttons in one group, inside a fieldset with a legend.
    expect(page.match(/type="radio"/g)).toHaveLength(3);
    expect(page.match(/name="answer-item-3"/g)).toHaveLength(3);
    expect(page).toContain("<fieldset");
    expect(page).toContain("<legend");
    for (const choice of ["Nucleus", "Planet", "River"]) {
      expect(page).toContain(`value="${choice}"`);
    }
  });

  it("offers a way to every question, the review step and the single submit", () => {
    const page = markup();
    const screen = text(page);
    for (const position of [1, 2, 3]) {
      expect(page).toContain(`aria-label="Question ${position}, not answered"`);
    }
    expect(page.match(/aria-current="step"/g)).toHaveLength(1);
    expect(screen).toContain("Next");
    expect(screen).toContain("Review answers");
    expect(screen).toContain("No answer");
    expect(screen).toContain("You answered 0 of 3 questions. You can submit only once.");
    expect(page.match(/type="submit"/g)).toHaveLength(1);
    expect(screen).toContain("Submit answers");
  });
});
