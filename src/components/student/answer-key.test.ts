// Checks the rule the student screens must not break: before a student has
// submitted, nothing the activity page sends to the browser contains the
// answer key. The page is called with a fake repository, then both the props
// handed to the client form and the rendered HTML are searched.

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ActivityWithItems,
  Lesson,
  SubmissionWithAnswers,
  User,
} from "@/lib/types";

const mocks = vi.hoisted(() => ({
  getActivity: vi.fn(),
  getLesson: vi.fn(),
  getSubmission: vi.fn(),
}));

const student: User = {
  id: "student-1",
  name: "Sample Student",
  role: "student",
  classId: "class-1",
  childId: null,
};

vi.mock("@/lib/session", () => ({
  requireRole: async () => student,
}));
vi.mock("@/lib/db/repo", () => mocks);
vi.mock("@/lib/ai", () => ({
  getAiStatus: () => ({ provider: "mock", model: "sample", fallback: null }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

import StudentActivityPage from "@/app/student/activities/[activityId]/page";
import { AnswerForm } from "./AnswerForm";

// Every string here must stay on the server until the student submits.
const SECRETS = [
  "KEY-MITOCHONDRIA",
  "ACCEPTED-POWERHOUSE",
  "RUBRIC-MENTIONS-ENERGY",
  "EXPLANATION-CELLS",
  "KEY-MODEL-ANSWER",
];

const activity: ActivityWithItems = {
  id: "activity-1",
  lessonId: "lesson-1",
  classId: "class-1",
  title: "Parts of the cell",
  instructions: "Answer every question.",
  type: "mixed",
  aiReason: "REASON-FOR-FORMAT",
  status: "published",
  aiProvider: "mock",
  aiModel: "sample",
  createdAt: "2026-10-01T00:00:00.000Z",
  publishedAt: "2026-10-01T01:00:00.000Z",
  items: [
    {
      id: "item-1",
      activityId: "activity-1",
      position: 1,
      type: "identification",
      question: "Which part of the cell releases energy?",
      choices: null,
      answerKey: "KEY-MITOCHONDRIA",
      acceptedAnswers: ["ACCEPTED-POWERHOUSE"],
      rubric: null,
      explanation: "EXPLANATION-CELLS",
      points: 1,
    },
    {
      id: "item-2",
      activityId: "activity-1",
      position: 2,
      type: "short_answer",
      question: "Why do cells need energy?",
      choices: null,
      answerKey: "KEY-MODEL-ANSWER",
      acceptedAnswers: [],
      rubric: "RUBRIC-MENTIONS-ENERGY",
      explanation: null,
      points: 2,
    },
    {
      id: "item-3",
      activityId: "activity-1",
      position: 3,
      type: "multiple_choice",
      question: "Which one is a cell part?",
      choices: ["Nucleus", "Planet", "River"],
      answerKey: "Nucleus",
      acceptedAnswers: [],
      rubric: null,
      explanation: null,
      points: 1,
    },
  ],
};

const lesson: Lesson = {
  id: "lesson-1",
  classId: "class-1",
  title: "The cell",
  content: "LESSON-CONTENT",
  createdAt: "2026-10-01T00:00:00.000Z",
};

const submission: SubmissionWithAnswers = {
  id: "submission-1",
  activityId: "activity-1",
  studentId: "student-1",
  totalScore: 1,
  maxScore: 4,
  needsReview: true,
  summary: null,
  summaryProvider: null,
  gradingProvider: null,
  submittedAt: "2026-10-01T02:00:00.000Z",
  answers: [
    {
      id: "answer-1",
      submissionId: "submission-1",
      itemId: "item-1",
      response: "nucleus",
      score: 0,
      feedback: "FEEDBACK-ONE",
      gradedBy: "code",
      confidence: null,
      needsReview: false,
    },
    {
      id: "answer-2",
      submissionId: "submission-1",
      itemId: "item-2",
      response: "To move",
      score: 1,
      feedback: "FEEDBACK-TWO",
      gradedBy: "ai",
      confidence: 0.4,
      needsReview: true,
    },
  ],
};

function open(activityId = "activity-1"): Promise<ReactNode> {
  return StudentActivityPage({
    params: Promise.resolve({ activityId }),
    searchParams: Promise.resolve({}),
  });
}

interface ElementLike {
  type: unknown;
  props: Record<string, unknown>;
}

function isElement(value: unknown): value is ElementLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "$$typeof" in value &&
    "props" in value
  );
}

/** Every element in a tree of not-yet-rendered React elements. */
function elementsIn(node: unknown, found: ElementLike[] = []): ElementLike[] {
  if (Array.isArray(node)) {
    for (const child of node) elementsIn(child, found);
  } else if (isElement(node)) {
    found.push(node);
    for (const value of Object.values(node.props)) elementsIn(value, found);
  }
  return found;
}

beforeEach(() => {
  mocks.getActivity.mockReset().mockResolvedValue(activity);
  mocks.getLesson.mockReset().mockResolvedValue(lesson);
  mocks.getSubmission.mockReset().mockResolvedValue(null);
});

describe("student activity page, before submitting", () => {
  it("gives the answer form public items only", async () => {
    const tree = await open();
    const forms = elementsIn(tree).filter((element) => element.type === AnswerForm);
    expect(forms).toHaveLength(1);

    const props = forms[0].props;
    expect(Object.keys(props).sort()).toEqual(["activityId", "items"]);
    const items = props.items as Record<string, unknown>[];
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(
        ["activityId", "choices", "id", "points", "position", "question", "type"].sort(),
      );
    }
  });

  it("passes no answer key, rubric or explanation to any element", async () => {
    const tree = await open();
    // Props are what React sends to the browser for client components. Nested
    // elements are left out here because each is listed in its own right.
    const sent = JSON.stringify(
      elementsIn(tree).map((element) => element.props),
      (_key, value: unknown) => (isElement(value) ? undefined : value),
    );
    const text = renderToStaticMarkup(createElement("div", null, tree));

    for (const secret of [...SECRETS, "REASON-FOR-FORMAT", "LESSON-CONTENT"]) {
      expect(sent).not.toContain(secret);
      expect(text).not.toContain(secret);
    }
    // The questions and choices are there, so the search above is meaningful.
    expect(text).toContain("Which part of the cell releases energy?");
    expect(text).toContain("Planet");
    expect(text).toContain("Submit answers");
  });

  it("is not found for a draft or another class's activity", async () => {
    mocks.getActivity.mockResolvedValue({ ...activity, status: "draft" });
    await expect(open()).rejects.toThrow("NOT_FOUND");

    mocks.getActivity.mockResolvedValue({ ...activity, classId: "class-2" });
    await expect(open()).rejects.toThrow("NOT_FOUND");

    mocks.getActivity.mockResolvedValue(null);
    await expect(open()).rejects.toThrow("NOT_FOUND");
    expect(mocks.getSubmission).not.toHaveBeenCalled();
  });
});

describe("student activity page, after submitting", () => {
  it("shows the score, the correct answers, the feedback and how each was graded", async () => {
    mocks.getSubmission.mockResolvedValue(submission);
    const text = renderToStaticMarkup(createElement("div", null, await open()));

    expect(elementsIn(await open()).some((element) => element.type === AnswerForm)).toBe(
      false,
    );
    expect(text).toContain("KEY-MITOCHONDRIA");
    expect(text).toContain("ACCEPTED-POWERHOUSE");
    expect(text).toContain("EXPLANATION-CELLS");
    expect(text).toContain("FEEDBACK-TWO");
    expect(text).toContain("Teacher is checking some answers, so your score may change.");
    expect(text).toContain("Checked by answer key");
    // The page runs in sample mode here, so AI grades are labelled as samples.
    expect(text).toContain("Sample mode");
    expect(text).toContain("Partial points");
    expect(text).toContain("No points");
    // The score card names each question's outcome, the unanswered one included.
    expect(text).toContain("Question 1: No points");
    expect(text).toContain("Question 2: Partial points");
    expect(text).toContain("Question 3: No points");
    expect(text).toContain("Ask about this activity");
  });

  it("labels an AI grade by the service that graded it, not the one in use now", async () => {
    // Graded by a real service earlier; the page itself runs in sample mode.
    mocks.getSubmission.mockResolvedValue({ ...submission, gradingProvider: "openai" });
    const text = renderToStaticMarkup(createElement("div", null, await open()));

    expect(text).toContain("Graded by AI");
    // The helper below the answers still follows the current mode.
    expect(text).toContain("The app is in sample mode");
  });
});
