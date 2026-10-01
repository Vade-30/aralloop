// Inputs and outputs of the four AI tasks. The task functions themselves are
// in generate-activity.ts, grade.ts, parent-summary.ts and tutor.ts.

import type { ActivityType, ItemType } from "../types";

export interface GenerateActivityInput {
  lessonTitle: string;
  lessonContent: string;
  gradeLevel: string;
  subject: string;
  itemCount: number;
  /** "auto" lets the model choose the format that fits the lesson. */
  preferredType: ActivityType | "auto";
}

/** One answer that code could not settle and the model must judge. */
export interface FreeTextAnswer {
  itemId: string;
  /** identification (no exact match with the key) or short_answer. */
  type: Extract<ItemType, "identification" | "short_answer">;
  question: string;
  answerKey: string;
  acceptedAnswers: string[];
  rubric: string | null;
  points: number;
  response: string;
}

export interface GradeFreeTextInput {
  lessonTitle: string;
  gradeLevel: string;
  answers: FreeTextAnswer[];
}

export interface FreeTextGrade {
  itemId: string;
  /** 0..points. Whole numbers for identification; halves allowed for short answers. */
  score: number;
  /** One or two sentences addressed to the student. */
  feedback: string;
  /** 0..1 — how sure the model is of the score. */
  confidence: number;
}

/** One graded item, as shown to the parent-summary and tutor tasks. */
export interface ResultItem {
  position: number;
  type: ItemType;
  question: string;
  correctAnswer: string;
  response: string;
  score: number;
  points: number;
  feedback: string;
}

export interface ParentSummaryInput {
  studentName: string;
  gradeLevel: string;
  subject: string;
  lessonTitle: string;
  activityTitle: string;
  totalScore: number;
  maxScore: number;
  /** True if some answers still wait for the teacher, so the score may change. */
  pendingReview: boolean;
  items: ResultItem[];
}

export interface TutorInput {
  /** Decides the voice: talking to the learner, or to a parent helping one. */
  audience: "student" | "parent";
  studentName: string;
  gradeLevel: string;
  lessonTitle: string;
  lessonContent: string;
  activityTitle: string;
  items: ResultItem[];
  question: string;
  history: { role: "user" | "assistant"; content: string }[];
}
