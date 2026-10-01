// Domain types shared by the database layer, the AI layer, the API routes and
// the UI. Dates are ISO strings so the same objects can cross the
// server/client boundary unchanged.

export type Role = "teacher" | "student" | "parent";

export const ITEM_TYPES = [
  "multiple_choice",
  "true_false",
  "identification",
  "short_answer",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** An activity is one item type throughout, or "mixed". */
export const ACTIVITY_TYPES = [...ITEM_TYPES, "mixed"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type ActivityStatus = "draft" | "published";

/** "mock" is the offline sample mode used when no AI key is configured. */
export type AiProviderName = "openai" | "gemini" | "mock";

/**
 * Who decided an answer's score.
 * - code: checked against the answer key by plain code
 * - ai: graded by the model against the rubric
 * - teacher: set or confirmed by the teacher
 * - pending: AI grading was unavailable, waiting for the teacher
 */
export type GradedBy = "code" | "ai" | "teacher" | "pending";

export interface SchoolClass {
  id: string;
  name: string;
  gradeLevel: string;
  subject: string;
  joinCode: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  classId: string;
  /** Set for parents only: the student this parent follows. */
  childId: string | null;
}

export interface Lesson {
  id: string;
  classId: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface Item {
  id: string;
  activityId: string;
  /** 1-based order within the activity. */
  position: number;
  type: ItemType;
  question: string;
  /**
   * multiple_choice: the options. true_false: ["True", "False"].
   * identification and short_answer: null.
   */
  choices: string[] | null;
  /**
   * multiple_choice / true_false: the exact text of the correct choice.
   * identification: the expected answer.
   * short_answer: a model answer.
   */
  answerKey: string;
  /** identification only: other spellings or names that are also correct. */
  acceptedAnswers: string[];
  /** short_answer only: what a full-credit answer must contain. */
  rubric: string | null;
  /** Shown to the student after submitting. */
  explanation: string | null;
  points: number;
}

/** The only shape of an item that may reach a student before they submit. */
export type PublicItem = Pick<
  Item,
  "id" | "activityId" | "position" | "type" | "question" | "choices" | "points"
>;

/** An item as produced by the AI or the teacher's editor, before it is stored. */
export type ItemInput = Omit<Item, "id" | "activityId" | "position">;

export interface Activity {
  id: string;
  lessonId: string;
  classId: string;
  title: string;
  instructions: string;
  type: ActivityType;
  /** The AI's one-or-two sentence explanation of why it chose this format. */
  aiReason: string;
  status: ActivityStatus;
  aiProvider: AiProviderName;
  aiModel: string;
  createdAt: string;
  publishedAt: string | null;
}

export interface ActivityWithItems extends Activity {
  items: Item[];
}

/** Row for activity lists. */
export interface ActivitySummary extends Activity {
  lessonTitle: string;
  itemCount: number;
  maxScore: number;
  submissionCount: number;
  /** Submissions with at least one answer waiting for teacher review. */
  needsReviewCount: number;
}

export interface Answer {
  id: string;
  submissionId: string;
  itemId: string;
  response: string;
  score: number;
  feedback: string;
  gradedBy: GradedBy;
  /** 0..1, AI-graded answers only. */
  confidence: number | null;
  needsReview: boolean;
}

export type NewAnswer = Omit<Answer, "id" | "submissionId">;

export interface ParentSummaryText {
  /** Two or three plain sentences: what the lesson was and how the child did. */
  overview: string;
  didWell: string[];
  toPractice: string[];
  /** One concrete thing to do at home. */
  homeTip: string;
}

export interface ParentSummary {
  en: ParentSummaryText;
  fil: ParentSummaryText;
}

export interface Submission {
  id: string;
  activityId: string;
  studentId: string;
  totalScore: number;
  maxScore: number;
  /** True while any answer is waiting for teacher review. */
  needsReview: boolean;
  summary: ParentSummary | null;
  summaryProvider: AiProviderName | null;
  submittedAt: string;
}

export interface SubmissionWithAnswers extends Submission {
  answers: Answer[];
}

/** What the AI returns when it turns a lesson into an activity. */
export interface GeneratedActivity {
  title: string;
  instructions: string;
  type: ActivityType;
  reason: string;
  items: ItemInput[];
}

export interface AiStatus {
  /** The provider that will be tried first. */
  provider: AiProviderName;
  model: string;
  /** Tried when the first provider fails; null if none is configured. */
  fallback: AiProviderName | null;
}

export interface AiResult<T> {
  data: T;
  provider: AiProviderName;
  model: string;
}

export function toPublicItem(item: Item): PublicItem {
  return {
    id: item.id,
    activityId: item.activityId,
    position: item.position,
    type: item.type,
    question: item.question,
    choices: item.choices,
    points: item.points,
  };
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True or false",
  identification: "Identification",
  short_answer: "Short answer",
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  ...ITEM_TYPE_LABELS,
  mixed: "Mixed",
};
