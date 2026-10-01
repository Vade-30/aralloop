// The API contract: one zod schema per request body and one type per response.
// Route handlers validate with these schemas; client components import the
// same types, so the two sides cannot drift apart.
//
// Every error response has the shape ApiErrorBody with a non-2xx status.

import { z } from "zod";
import {
  ACTIVITY_TYPES,
  ITEM_TYPES,
  type Activity,
  type ActivityWithItems,
  type AiProviderName,
  type Lesson,
  type ParentSummary,
  type SubmissionWithAnswers,
  type User,
} from "./types";

export const LIMITS = {
  lessonTitleMax: 120,
  /** Longest lesson we store. */
  lessonContentMax: 20_000,
  /** Shortest lesson worth generating an activity from. */
  lessonContentMin: 80,
  itemCountMin: 3,
  itemCountMax: 15,
  itemCountDefault: 8,
  questionMax: 500,
  choiceMax: 200,
  responseMax: 2_000,
  feedbackMax: 1_000,
  tutorQuestionMax: 500,
  tutorHistoryMax: 10,
  uploadMaxBytes: 5 * 1024 * 1024,
} as const;

export interface ApiErrorBody {
  error: {
    /** Machine-readable, e.g. "validation", "forbidden", "ai_unavailable". */
    code: string;
    /** Safe to show to the user as-is. */
    message: string;
  };
}

// --- POST /api/session · DELETE /api/session --------------------------------
export const sessionRequest = z.object({ userId: z.string().min(1) });
export type SessionRequest = z.infer<typeof sessionRequest>;
export interface SessionResponse {
  user: User;
}

// --- POST /api/lessons/extract (multipart/form-data, field "file") ----------
export interface ExtractResponse {
  /** Suggested lesson title, taken from the file name. */
  title: string;
  text: string;
  /** True if the text was cut to LIMITS.lessonContentMax. */
  truncated: boolean;
}

// --- POST /api/lessons -------------------------------------------------------
export const createLessonRequest = z.object({
  title: z.string().trim().min(1).max(LIMITS.lessonTitleMax),
  content: z
    .string()
    .trim()
    .min(LIMITS.lessonContentMin)
    .max(LIMITS.lessonContentMax),
});
export type CreateLessonRequest = z.infer<typeof createLessonRequest>;
export interface CreateLessonResponse {
  lesson: Lesson;
}

// --- POST /api/lessons/[lessonId]/activities ---------------------------------
// Runs the AI and stores the result as a draft activity.
export const generateActivityRequest = z.object({
  itemCount: z
    .number()
    .int()
    .min(LIMITS.itemCountMin)
    .max(LIMITS.itemCountMax)
    .default(LIMITS.itemCountDefault),
  /** "auto" lets the AI choose the format that fits the lesson. */
  preferredType: z.enum(["auto", ...ACTIVITY_TYPES]).default("auto"),
});
export type GenerateActivityRequest = z.input<typeof generateActivityRequest>;
export interface ActivityResponse {
  activity: ActivityWithItems;
}

// --- PATCH /api/activities/[activityId] --------------------------------------
// Replaces the title, instructions and the whole item list. Drafts only.
export const itemInput = z.object({
  type: z.enum(ITEM_TYPES),
  question: z.string().trim().min(1).max(LIMITS.questionMax),
  choices: z
    .array(z.string().trim().min(1).max(LIMITS.choiceMax))
    .min(2)
    .max(6)
    .nullable(),
  answerKey: z.string().trim().min(1).max(LIMITS.responseMax),
  acceptedAnswers: z.array(z.string().trim().min(1).max(LIMITS.choiceMax)).max(10),
  rubric: z.string().trim().max(LIMITS.feedbackMax).nullable(),
  explanation: z.string().trim().max(LIMITS.feedbackMax).nullable(),
  points: z.number().int().min(1).max(20),
});
export const updateActivityRequest = z.object({
  title: z.string().trim().min(1).max(LIMITS.lessonTitleMax),
  instructions: z.string().trim().max(LIMITS.feedbackMax),
  items: z.array(itemInput).min(1).max(LIMITS.itemCountMax),
});
export type UpdateActivityRequest = z.infer<typeof updateActivityRequest>;

// --- POST /api/activities/[activityId]/publish -------------------------------
export interface PublishResponse {
  activity: Activity;
}

// --- DELETE /api/activities/[activityId] (drafts only) -----------------------
export interface OkResponse {
  ok: true;
}

// --- POST /api/activities/[activityId]/submissions ---------------------------
export const submitRequest = z.object({
  answers: z
    .array(
      z.object({
        itemId: z.string().min(1),
        response: z.string().max(LIMITS.responseMax),
      }),
    )
    .min(1),
});
export type SubmitRequest = z.infer<typeof submitRequest>;
export interface SubmissionResponse {
  submission: SubmissionWithAnswers;
  /**
   * Set when something degraded but the submission was still saved, e.g. AI
   * grading was unavailable and free-text answers await the teacher.
   */
  notice: string | null;
}

// --- PATCH /api/answers/[answerId] (teacher override) ------------------------
export const overrideAnswerRequest = z.object({
  score: z.number().min(0),
  feedback: z.string().trim().max(LIMITS.feedbackMax).optional(),
});
export type OverrideAnswerRequest = z.infer<typeof overrideAnswerRequest>;

// --- POST /api/submissions/[submissionId]/summary ----------------------------
// Returns the stored parent summary, writing it first if there is none yet.
// Summaries are written on demand (the first time someone opens them) so that
// they always reflect the teacher's final scores and cost one AI call each.
export const summaryRequest = z.object({
  /** Teacher only: write a new summary even if one is stored. */
  regenerate: z.boolean().default(false),
});
export type SummaryRequest = z.input<typeof summaryRequest>;
export interface SummaryResponse {
  summary: ParentSummary;
  provider: AiProviderName;
}

// --- POST /api/submissions/[submissionId]/ask --------------------------------
// The after-submission tutor. Only available once the student has submitted.
export const tutorMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4_000),
});
export const askRequest = z.object({
  question: z.string().trim().min(1).max(LIMITS.tutorQuestionMax),
  history: z.array(tutorMessage).max(LIMITS.tutorHistoryMax).default([]),
});
export type AskRequest = z.input<typeof askRequest>;
export type TutorMessage = z.infer<typeof tutorMessage>;
export interface AskResponse {
  reply: string;
  provider: AiProviderName;
}

// --- POST /api/demo/reset ----------------------------------------------------
// Wipes all data and restores the sample class. Returns OkResponse.
