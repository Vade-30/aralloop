// Renders the role picker and the student's home against a fake repository,
// to check the account groups and the "Not started" and scored states.

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivitySummary, SchoolClass, Submission, User } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  requireRole: vi.fn(),
  listUsers: vi.fn(),
  getClass: vi.fn(),
  listActivities: vi.fn(),
  listSubmissionsForStudent: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
  requireRole: mocks.requireRole,
  HOME_PATH: { teacher: "/teacher", student: "/student", parent: "/parent" },
}));
vi.mock("@/lib/db/repo", () => mocks);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

import RolePickerPage from "@/app/page";
import StudentHomePage from "@/app/student/page";

const schoolClass: SchoolClass = {
  id: "class-1",
  name: "Sample Section",
  gradeLevel: "Grade 7",
  subject: "Science",
  joinCode: "SAMPLE",
};

const users: User[] = [
  { id: "teacher-1", name: "Sample Teacher", role: "teacher", classId: "class-1", childId: null },
  { id: "student-1", name: "Sample Child", role: "student", classId: "class-1", childId: null },
  { id: "student-2", name: "Other Student", role: "student", classId: "class-1", childId: null },
  { id: "parent-1", name: "Sample Parent", role: "parent", classId: "class-1", childId: "student-1" },
];

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
    itemCount: 8,
    maxScore: 10,
    submissionCount: 0,
    needsReviewCount: 0,
  };
}

const submission: Submission = {
  id: "submission-1",
  activityId: "activity-old",
  studentId: "student-1",
  totalScore: 7.5,
  maxScore: 10,
  needsReview: true,
  summary: null,
  summaryProvider: null,
  gradingProvider: null,
  submittedAt: "2026-10-01T02:00:00.000Z",
};

function html(tree: ReactNode): string {
  return renderToStaticMarkup(createElement("div", null, tree));
}

beforeEach(() => {
  mocks.getCurrentUser.mockReset().mockResolvedValue(null);
  mocks.requireRole.mockReset().mockResolvedValue(users[1]);
  mocks.listUsers.mockReset().mockResolvedValue(users);
  mocks.getClass.mockReset().mockResolvedValue(schoolClass);
  mocks.listActivities
    .mockReset()
    .mockResolvedValue([
      activityRow("activity-old", "Older activity", "2026-10-01T01:00:00.000Z"),
      activityRow("activity-new", "Newer activity", "2026-10-02T01:00:00.000Z"),
    ]);
  mocks.listSubmissionsForStudent.mockReset().mockResolvedValue([submission]);
});

describe("role picker", () => {
  it("groups the sample accounts and describes each one", async () => {
    const text = html(await RolePickerPage());
    expect(mocks.getCurrentUser).toHaveBeenCalled();
    for (const label of ["Teacher", "Students", "Parent"]) {
      expect(text).toContain(`aria-label="${label}"`);
    }
    expect(text).toContain("Teacher of Sample Section");
    expect(text).toContain("Student in Sample Section");
    expect(text).toContain("Parent of Sample Child");
    expect(text).toContain("no passwords");
    expect(text).toContain("Reset sample data");
    expect(text).not.toContain("Continue");
  });

  it("shows the loop in five steps and which steps each group does", async () => {
    const text = html(await RolePickerPage());
    const steps = ["Lesson", "AI draft", "Student answers", "Feedback", "Parent summary"];
    let last = -1;
    for (const step of steps) {
      const at = text.indexOf(`>${step}<`);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
    expect(text).toContain("Teacher in control");
    expect(text).toContain("Steps 1 and 2 of the loop");
    expect(text).toContain("Steps 3 and 4 of the loop");
    expect(text).toContain("Step 5 of the loop");
    // Nothing is chosen yet, so the first teacher is marked as the place to start.
    expect(text.match(/Start here/g)).toHaveLength(1);
  });

  it("offers to continue when an account is already chosen", async () => {
    mocks.getCurrentUser.mockResolvedValue(users[3]);
    const text = html(await RolePickerPage());
    expect(text).toContain('href="/parent"');
    expect(text).toContain("In use");
    expect(text).not.toContain("Start here");
  });

  it("explains what to do when there are no accounts", async () => {
    mocks.listUsers.mockResolvedValue([]);
    expect(html(await RolePickerPage())).toContain("No sample accounts yet");
  });
});

describe("student home", () => {
  it("lists published activities, newest first, with their state", async () => {
    const text = html(await StudentHomePage());
    expect(mocks.requireRole).toHaveBeenCalledWith("student");
    expect(mocks.listActivities).toHaveBeenCalledWith("class-1", { status: "published" });
    expect(text.indexOf("Newer activity")).toBeLessThan(text.indexOf("Older activity"));
    expect(text).toContain("Not started");
    expect(text).toContain(">Start<");
    expect(text).toContain("7.5 / 10");
    expect(text).toContain("Teacher is checking");
    expect(text).toContain(">Review<");
    expect(text).toContain("8 questions");
  });

  it("shows an empty state when nothing is published", async () => {
    mocks.listActivities.mockResolvedValue([]);
    expect(html(await StudentHomePage())).toContain("No activities yet");
  });
});
