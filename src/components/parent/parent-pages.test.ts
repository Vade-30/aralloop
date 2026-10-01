// Checks the parent screens against a fake repository: a parent can open only
// their own child's submissions, and the screens render the states they
// promise (results, not answered yet, no linked child, summary loading).

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ActivitySummary,
  ActivityWithItems,
  ParentSummary,
  SchoolClass,
  SubmissionWithAnswers,
  User,
} from "@/lib/types";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getClass: vi.fn(),
  getUser: vi.fn(),
  getActivity: vi.fn(),
  getLesson: vi.fn(),
  getSubmissionById: vi.fn(),
  listActivities: vi.fn(),
  listSubmissionsForStudent: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireRole: mocks.requireRole }));
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

import ParentHomePage from "@/app/parent/page";
import ParentSubmissionPage from "@/app/parent/submissions/[submissionId]/page";

const parent: User = {
  id: "parent-1",
  name: "Sample Parent",
  role: "parent",
  classId: "class-1",
  childId: "student-1",
};
const child: User = {
  id: "student-1",
  name: "Sample Child",
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

const activity: ActivityWithItems = {
  id: "activity-1",
  lessonId: "lesson-1",
  classId: "class-1",
  title: "Parts of the cell",
  instructions: "",
  type: "identification",
  aiReason: "",
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
      answerKey: "Mitochondria",
      acceptedAnswers: [],
      rubric: null,
      explanation: null,
      points: 1,
    },
  ],
};

function summaryRow(id: string, title: string): ActivitySummary {
  const { items, ...rest } = activity;
  return {
    ...rest,
    id,
    title,
    lessonTitle: "The cell",
    itemCount: items.length,
    maxScore: 1,
    submissionCount: 1,
    needsReviewCount: 0,
  };
}

const submission: SubmissionWithAnswers = {
  id: "submission-1",
  activityId: "activity-1",
  studentId: "student-1",
  totalScore: 1,
  maxScore: 1,
  needsReview: false,
  summary: null,
  summaryProvider: null,
  gradingProvider: null,
  submittedAt: "2026-10-01T02:00:00.000Z",
  answers: [
    {
      id: "answer-1",
      submissionId: "submission-1",
      itemId: "item-1",
      response: "mitochondria",
      score: 1,
      feedback: "",
      gradedBy: "code",
      confidence: null,
      needsReview: false,
    },
  ],
};

const summary: ParentSummary = {
  en: {
    overview: "OVERVIEW-EN",
    didWell: ["WELL-EN"],
    toPractice: ["PRACTISE-EN"],
    homeTip: "TIP-EN",
  },
  fil: {
    overview: "OVERVIEW-FIL",
    didWell: ["WELL-FIL"],
    toPractice: ["PRACTISE-FIL"],
    homeTip: "TIP-FIL",
  },
};

function html(tree: ReactNode): string {
  return renderToStaticMarkup(createElement("div", null, tree));
}

function openSubmission(submissionId = "submission-1"): Promise<ReactNode> {
  return ParentSubmissionPage({
    params: Promise.resolve({ submissionId }),
    searchParams: Promise.resolve({}),
  });
}

beforeEach(() => {
  mocks.requireRole.mockReset().mockResolvedValue(parent);
  mocks.getClass.mockReset().mockResolvedValue(schoolClass);
  mocks.getUser.mockReset().mockResolvedValue(child);
  mocks.getActivity.mockReset().mockResolvedValue(activity);
  mocks.getLesson.mockReset().mockResolvedValue({
    id: "lesson-1",
    classId: "class-1",
    title: "The cell",
    content: "",
    createdAt: "2026-10-01T00:00:00.000Z",
  });
  mocks.getSubmissionById.mockReset().mockResolvedValue(submission);
  mocks.listActivities
    .mockReset()
    .mockResolvedValue([
      summaryRow("activity-1", "Parts of the cell"),
      summaryRow("activity-2", "Cell division"),
    ]);
  mocks.listSubmissionsForStudent.mockReset().mockResolvedValue([submission]);
});

describe("parent home", () => {
  it("lists the child's results and the activities not answered yet", async () => {
    const text = html(await ParentHomePage());
    expect(mocks.requireRole).toHaveBeenCalledWith("parent");
    expect(mocks.listActivities).toHaveBeenCalledWith("class-1", { status: "published" });
    expect(text).toContain("Sample Child");
    expect(text).toContain("Parts of the cell");
    expect(text).toContain('href="/parent/submissions/submission-1"');
    expect(text).toContain("Cell division");
    expect(text).toContain("Not answered yet");
    // Both lists are there as labelled sections, the answered one first.
    expect(text).toContain('aria-labelledby="results-title"');
    expect(text).toContain('aria-labelledby="waiting-title"');
    expect(text.indexOf('id="results-title"')).toBeLessThan(text.indexOf('id="waiting-title"'));
    expect(text.indexOf("Parts of the cell")).toBeLessThan(text.indexOf("Cell division"));
  });

  it("sums up the child's results in the tiles at the top", async () => {
    mocks.listSubmissionsForStudent.mockResolvedValue([
      submission,
      {
        ...submission,
        id: "submission-2",
        activityId: "activity-3",
        totalScore: 1,
        maxScore: 2,
        needsReview: true,
      },
    ]);
    const text = html(await ParentHomePage());
    // One full score and one half score: each activity counts the same.
    expect(text).toContain("75%");
    expect(text).toContain("Average score");
    expect(text).toContain("Teacher is checking");
    expect(text).toContain('aria-label="Score: 1 out of 2"');
    // One of the two published activities is answered.
    expect(text).toContain('aria-valuenow="1"');
    expect(text).toContain('aria-valuemax="2"');
  });

  it("says so when the child has answered nothing yet", async () => {
    mocks.listSubmissionsForStudent.mockResolvedValue([]);
    const text = html(await ParentHomePage());
    expect(text).toContain("Sample Child has not answered an activity yet.");
    expect(text).toContain("Cell division");
    expect(text).not.toContain("/parent/submissions/");
  });

  it("says so when no child is linked", async () => {
    mocks.requireRole.mockResolvedValue({ ...parent, childId: null });
    const text = html(await ParentHomePage());
    expect(text).toContain("No student is linked to this account");
    expect(mocks.listSubmissionsForStudent).not.toHaveBeenCalled();
  });

  it("shows an empty state when there is nothing yet", async () => {
    mocks.listActivities.mockResolvedValue([]);
    mocks.listSubmissionsForStudent.mockResolvedValue([]);
    expect(html(await ParentHomePage())).toContain("Nothing to show yet");
  });
});

describe("parent submission page", () => {
  it("is not found for another student's submission", async () => {
    mocks.getSubmissionById.mockResolvedValue({ ...submission, studentId: "student-2" });
    await expect(openSubmission()).rejects.toThrow("NOT_FOUND");
    // Nothing about the other student's activity is loaded.
    expect(mocks.getActivity).not.toHaveBeenCalled();
  });

  it("is not found when the submission is missing or no child is linked", async () => {
    mocks.getSubmissionById.mockResolvedValue(null);
    await expect(openSubmission()).rejects.toThrow("NOT_FOUND");

    mocks.getSubmissionById.mockResolvedValue(submission);
    mocks.requireRole.mockResolvedValue({ ...parent, childId: null });
    await expect(openSubmission()).rejects.toThrow("NOT_FOUND");
  });

  it("shows a stored summary in English first, labelled by who wrote it", async () => {
    mocks.getSubmissionById.mockResolvedValue({
      ...submission,
      needsReview: true,
      summary,
      summaryProvider: "openai",
    });
    const text = html(await openSubmission());
    expect(text).toContain('lang="en"');
    expect(text).toContain("OVERVIEW-EN");
    expect(text).toContain("WELL-EN");
    expect(text).toContain("PRACTISE-EN");
    expect(text).toContain("TIP-EN");
    expect(text).not.toContain("OVERVIEW-FIL");
    expect(text).toContain("AI-written summary");
    expect(text).toContain('aria-pressed="true"');
    expect(text).toContain("so this score may change");
    expect(text).not.toContain("Writing the summary");
    // The language switch is a labelled pair of buttons with one pressed.
    expect(text).toContain('aria-label="Summary language"');
    expect(text.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(text.match(/aria-pressed="false"/g)).toHaveLength(1);
  });

  it("shows the score and how each question went at the top", async () => {
    const text = html(await openSubmission());
    expect(text).toContain('aria-label="Score: 1 out of 1"');
    expect(text).toContain("Sample Child&#x27;s score");
    expect(text).toContain("Question 1: Full points");
    expect(text).not.toContain("so this score may change");
  });

  it("marks an answer the teacher has not graded yet", async () => {
    mocks.getSubmissionById.mockResolvedValue({
      ...submission,
      totalScore: 0,
      needsReview: true,
      answers: [{ ...submission.answers[0], score: 0, gradedBy: "pending", needsReview: true }],
    });
    const text = html(await openSubmission());
    expect(text).toContain("Question 1: Not graded yet");
    expect(text).toContain("so this score may change");
  });

  it("starts writing the summary when none is stored", async () => {
    const text = html(await openSubmission());
    expect(text).toContain("Writing the summary. This takes a few seconds.");
    expect(text).toContain("How can I help my child practise this at home?");
    expect(text).toContain("<details");
    expect(text).toContain("Mitochondria");
  });
});
