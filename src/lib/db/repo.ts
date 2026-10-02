// All SQL lives here. Every function maps snake_case rows to the camelCase
// types in ../types, and converts timestamps to ISO strings.
//
// Reads that are also needed inside a transaction take the query function as
// their first argument, so they see the transaction's own writes.

import type {
  Activity,
  ActivityStatus,
  ActivitySummary,
  ActivityType,
  ActivityWithItems,
  AiProviderName,
  Answer,
  GeneratedActivity,
  GradedBy,
  Item,
  ItemInput,
  ItemType,
  Lesson,
  NewAnswer,
  ParentSummary,
  Role,
  SchoolClass,
  Submission,
  SubmissionWithAnswers,
  User,
} from "../types";
import { newJoinCode } from "../auth";
import { getDb, query, transaction, type QueryFn } from "./client";
import { insertRows, resetAndSeed, toJsonb } from "./seed";

/** Thrown by createSubmission when the student already submitted this activity. */
export class DuplicateSubmissionError extends Error {
  constructor() {
    super("This activity was already submitted.");
    this.name = "DuplicateSubmissionError";
  }
}

/** Thrown when someone signs up with an email that already has an account. */
export class EmailTakenError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailTakenError";
  }
}

// --- rows and mappers --------------------------------------------------------

type Timestamp = Date | string;

interface ClassRow {
  id: string;
  name: string;
  grade_level: string;
  subject: string;
  join_code: string;
}

interface UserRow {
  id: string;
  name: string;
  role: Role;
  class_id: string;
  child_id: string | null;
}

interface LessonRow {
  id: string;
  class_id: string;
  title: string;
  content: string;
  created_at: Timestamp;
}

interface ActivityRow {
  id: string;
  lesson_id: string;
  class_id: string;
  title: string;
  instructions: string;
  type: ActivityType;
  ai_reason: string;
  status: ActivityStatus;
  ai_provider: AiProviderName;
  ai_model: string;
  created_at: Timestamp;
  published_at: Timestamp | null;
}

interface ActivitySummaryRow extends ActivityRow {
  lesson_title: string;
  item_count: number;
  max_score: number;
  submission_count: number;
  needs_review_count: number;
}

interface ItemRow {
  id: string;
  activity_id: string;
  position: number;
  type: ItemType;
  question: string;
  choices: unknown;
  answer_key: string;
  accepted_answers: unknown;
  rubric: string | null;
  explanation: string | null;
  points: number;
}

interface SubmissionRow {
  id: string;
  activity_id: string;
  student_id: string;
  total_score: number;
  max_score: number;
  needs_review: boolean;
  summary: unknown;
  summary_provider: AiProviderName | null;
  grading_provider: AiProviderName | null;
  submitted_at: Timestamp;
}

interface AnswerRow {
  id: string;
  submission_id: string;
  item_id: string;
  response: string;
  score: number;
  feedback: string;
  graded_by: GradedBy;
  confidence: number | null;
  needs_review: boolean;
}

const toIso = (value: Timestamp): string => new Date(value).toISOString();

/** Both drivers parse jsonb already; the string case is only a safety net. */
function fromJsonb<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function toClass(row: ClassRow): SchoolClass {
  return {
    id: row.id,
    name: row.name,
    gradeLevel: row.grade_level,
    subject: row.subject,
    joinCode: row.join_code,
  };
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    classId: row.class_id,
    childId: row.child_id,
  };
}

function toLesson(row: LessonRow): Lesson {
  return {
    id: row.id,
    classId: row.class_id,
    title: row.title,
    content: row.content,
    createdAt: toIso(row.created_at),
  };
}

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    classId: row.class_id,
    title: row.title,
    instructions: row.instructions,
    type: row.type,
    aiReason: row.ai_reason,
    status: row.status,
    aiProvider: row.ai_provider,
    aiModel: row.ai_model,
    createdAt: toIso(row.created_at),
    publishedAt: row.published_at === null ? null : toIso(row.published_at),
  };
}

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    activityId: row.activity_id,
    position: row.position,
    type: row.type,
    question: row.question,
    choices: fromJsonb<string[]>(row.choices),
    answerKey: row.answer_key,
    acceptedAnswers: fromJsonb<string[]>(row.accepted_answers) ?? [],
    rubric: row.rubric,
    explanation: row.explanation,
    points: row.points,
  };
}

function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    activityId: row.activity_id,
    studentId: row.student_id,
    totalScore: Number(row.total_score),
    maxScore: Number(row.max_score),
    needsReview: row.needs_review,
    summary: fromJsonb<ParentSummary>(row.summary),
    summaryProvider: row.summary_provider,
    gradingProvider: row.grading_provider ?? null,
    submittedAt: toIso(row.submitted_at),
  };
}

function toAnswer(row: AnswerRow): Answer {
  return {
    id: row.id,
    submissionId: row.submission_id,
    itemId: row.item_id,
    response: row.response,
    score: Number(row.score),
    feedback: row.feedback,
    gradedBy: row.graded_by,
    confidence: row.confidence === null ? null : Number(row.confidence),
    needsReview: row.needs_review,
  };
}

// --- shared reads and writes -------------------------------------------------

const ITEM_COLUMNS = [
  "id",
  "activity_id",
  "position",
  "type",
  "question",
  "choices::jsonb",
  "answer_key",
  "accepted_answers::jsonb",
  "rubric",
  "explanation",
  "points",
] as const;

const ANSWER_COLUMNS = [
  "id",
  "submission_id",
  "item_id",
  "response",
  "score",
  "feedback",
  "graded_by",
  "confidence",
  "needs_review",
] as const;

/** Positions follow the array order, starting at 1. */
async function insertItems(
  q: QueryFn,
  activityId: string,
  items: ItemInput[],
): Promise<void> {
  await insertRows(
    q,
    "items",
    ITEM_COLUMNS,
    items.map((item, index) => [
      crypto.randomUUID(),
      activityId,
      index + 1,
      item.type,
      item.question,
      toJsonb(item.choices),
      item.answerKey,
      toJsonb(item.acceptedAnswers ?? []),
      item.rubric,
      item.explanation,
      item.points,
    ]),
  );
}

async function loadActivity(
  q: QueryFn,
  id: string,
): Promise<ActivityWithItems | null> {
  const [row] = await q<ActivityRow>("select * from activities where id = $1", [id]);
  if (!row) return null;
  const items = await q<ItemRow>(
    "select * from items where activity_id = $1 order by position, id",
    [id],
  );
  return { ...toActivity(row), items: items.map(toItem) };
}

/**
 * Loads submissions with their answers in two statements, however many
 * submissions match. `where` and `orderBy` are constants written in this
 * file; `s` is the submission and `u` the student.
 */
async function loadSubmissions(
  q: QueryFn,
  where: string,
  params: unknown[],
  orderBy = "s.submitted_at desc, s.id",
): Promise<SubmissionWithAnswers[]> {
  const submissions = await q<SubmissionRow>(
    `select s.*
       from submissions s
       join users u on u.id = s.student_id
      where ${where}
      order by ${orderBy}`,
    params,
  );
  if (submissions.length === 0) return [];
  const answers = await q<AnswerRow>(
    `select an.*
       from answers an
       join submissions s on s.id = an.submission_id
       join items i on i.id = an.item_id
      where ${where}
      order by i.position, an.id`,
    params,
  );
  const bySubmission = new Map<string, Answer[]>();
  for (const row of answers) {
    const list = bySubmission.get(row.submission_id) ?? [];
    list.push(toAnswer(row));
    bySubmission.set(row.submission_id, list);
  }
  return submissions.map((row) => ({
    ...toSubmission(row),
    answers: bySubmission.get(row.id) ?? [],
  }));
}

async function loadSubmissionById(
  q: QueryFn,
  id: string,
): Promise<SubmissionWithAnswers | null> {
  const [submission] = await loadSubmissions(q, "s.id = $1", [id]);
  return submission ?? null;
}

/** One item type throughout, otherwise "mixed". Null when there are no items. */
function typeFromItems(items: ItemInput[]): ActivityType | null {
  if (items.length === 0) return null;
  const first = items[0].type;
  return items.every((item) => item.type === first) ? first : "mixed";
}

/**
 * True for PostgreSQL's unique_violation. Both drivers put the SQLSTATE on
 * error.code; the message check covers a driver that does not.
 */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === "23505") return true;
  return (
    typeof message === "string" &&
    /duplicate key value violates unique constraint/i.test(message)
  );
}

// --- classes and users -------------------------------------------------------

export async function getClass(id: string): Promise<SchoolClass | null> {
  const [row] = await query<ClassRow>("select * from classes where id = $1", [id]);
  return row ? toClass(row) : null;
}

export async function getClassByJoinCode(joinCode: string): Promise<SchoolClass | null> {
  const [row] = await query<ClassRow>("select * from classes where join_code = $1", [
    joinCode,
  ]);
  return row ? toClass(row) : null;
}

/**
 * Users, teachers first, then students, then parents, each by name. With a
 * class id, only the users of that class.
 */
export async function listUsers(classId?: string): Promise<User[]> {
  const rows = await query<UserRow>(
    `select *
       from users
      where $1::text is null or class_id = $1
      order by case role when 'teacher' then 0 when 'student' then 1 else 2 end,
               name, id`,
    [classId ?? null],
  );
  return rows.map(toUser);
}

export async function getUser(id: string): Promise<User | null> {
  const [row] = await query<UserRow>("select * from users where id = $1", [id]);
  return row ? toUser(row) : null;
}

/** Students of a class, by name. */
export async function listStudents(classId: string): Promise<User[]> {
  const rows = await query<UserRow>(
    "select * from users where class_id = $1 and role = 'student' order by name, id",
    [classId],
  );
  return rows.map(toUser);
}

// --- accounts and sessions ---------------------------------------------------

/**
 * The account with this email and its stored password hash, for checking a
 * password. The hash stays out of the User type so it cannot reach a page.
 */
export async function getUserWithPassword(
  email: string,
): Promise<{ user: User; passwordHash: string | null } | null> {
  const [row] = await query<UserRow & { password_hash: string | null }>(
    "select * from users where email = $1",
    [email],
  );
  return row ? { user: toUser(row), passwordHash: row.password_hash } : null;
}

interface NewAccount {
  name: string;
  email: string;
  passwordHash: string;
}

async function insertUser(
  q: QueryFn,
  input: NewAccount & { role: Role; classId: string; childId: string | null },
): Promise<User> {
  const [row] = await q<UserRow>(
    `insert into users (id, name, role, class_id, child_id, email, password_hash)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      crypto.randomUUID(),
      input.name,
      input.role,
      input.classId,
      input.childId,
      input.email,
      input.passwordHash,
    ],
  );
  return toUser(row);
}

/** The name of the unique constraint an error is about, as far as it says. */
function violatedConstraint(error: unknown): string {
  const { constraint, message } = error as { constraint?: unknown; message?: unknown };
  return `${typeof constraint === "string" ? constraint : ""} ${typeof message === "string" ? message : ""}`;
}

/**
 * Creates a class with a new join code and its teacher, both or neither.
 * Throws EmailTakenError if the email already has an account.
 */
export async function createTeacherWithClass(
  input: NewAccount & { className: string; gradeLevel: string; subject: string },
): Promise<User> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await transaction(async (q) => {
        const classId = crypto.randomUUID();
        await q(
          `insert into classes (id, name, grade_level, subject, join_code)
           values ($1, $2, $3, $4, $5)`,
          [classId, input.className, input.gradeLevel, input.subject, newJoinCode()],
        );
        return insertUser(q, { ...input, role: "teacher", classId, childId: null });
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      if (!violatedConstraint(error).includes("join_code")) throw new EmailTakenError();
      // Another class already has this join code: try again with a new one.
      if (attempt >= 3) throw error;
    }
  }
}

/**
 * Adds a student or a parent to a class that exists. Throws EmailTakenError
 * if the email already has an account.
 */
export async function createMember(
  input: NewAccount & { role: "student" | "parent"; classId: string; childId: string | null },
): Promise<User> {
  try {
    return await insertUser(query, input);
  } catch (error) {
    if (isUniqueViolation(error)) throw new EmailTakenError();
    throw error;
  }
}

/** Stores a session under the hash of its token. Old sessions are cleared out. */
export async function createSession(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await query("delete from sessions where expires_at < now()");
  await query(
    "insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3::timestamptz)",
    [tokenHash, userId, expiresAt.toISOString()],
  );
}

/** The user a session belongs to, or null if it is unknown or has expired. */
export async function getSessionUser(tokenHash: string): Promise<User | null> {
  const [row] = await query<UserRow>(
    `select u.*
       from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [tokenHash],
  );
  return row ? toUser(row) : null;
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await query("delete from sessions where token_hash = $1", [tokenHash]);
}

// --- lessons -----------------------------------------------------------------

/** Newest first. */
export async function listLessons(classId: string): Promise<Lesson[]> {
  const rows = await query<LessonRow>(
    "select * from lessons where class_id = $1 order by created_at desc, id",
    [classId],
  );
  return rows.map(toLesson);
}

export async function getLesson(id: string): Promise<Lesson | null> {
  const [row] = await query<LessonRow>("select * from lessons where id = $1", [id]);
  return row ? toLesson(row) : null;
}

export async function createLesson(input: {
  classId: string;
  title: string;
  content: string;
}): Promise<Lesson> {
  const [row] = await query<LessonRow>(
    `insert into lessons (id, class_id, title, content)
     values ($1, $2, $3, $4)
     returning *`,
    [crypto.randomUUID(), input.classId, input.title, input.content],
  );
  return toLesson(row);
}

// --- activities --------------------------------------------------------------

/** Stores an AI-generated activity and its items as a draft. */
export async function createActivity(input: {
  lessonId: string;
  classId: string;
  generated: GeneratedActivity;
  provider: AiProviderName;
  model: string;
}): Promise<ActivityWithItems> {
  const id = crypto.randomUUID();
  const { generated } = input;
  return transaction(async (q) => {
    await q(
      `insert into activities
         (id, lesson_id, class_id, title, instructions, type, ai_reason,
          status, ai_provider, ai_model)
       values ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9)`,
      [
        id,
        input.lessonId,
        input.classId,
        generated.title,
        generated.instructions,
        generated.type,
        generated.reason,
        input.provider,
        input.model,
      ],
    );
    await insertItems(q, id, generated.items);
    const activity = await loadActivity(q, id);
    if (!activity) throw new Error("The activity could not be read back after saving.");
    return activity;
  });
}

/** Items are ordered by position. */
export async function getActivity(id: string): Promise<ActivityWithItems | null> {
  return loadActivity(query, id);
}

/** Newest first. Pass a status to filter. */
export async function listActivities(
  classId: string,
  options?: { status?: Activity["status"] },
): Promise<ActivitySummary[]> {
  // The counts are grouped once per table and joined, so the cost does not
  // grow with the number of activities the way per-row subqueries would.
  const rows = await query<ActivitySummaryRow>(
    `select a.*,
            l.title as lesson_title,
            coalesce(i.item_count, 0)::int as item_count,
            coalesce(i.max_score, 0)::int as max_score,
            coalesce(s.submission_count, 0)::int as submission_count,
            coalesce(s.needs_review_count, 0)::int as needs_review_count
       from activities a
       join lessons l on l.id = a.lesson_id
       left join (
              select activity_id,
                     count(*) as item_count,
                     sum(points) as max_score
                from items
               group by activity_id
            ) i on i.activity_id = a.id
       left join (
              select activity_id,
                     count(*) as submission_count,
                     count(*) filter (where needs_review) as needs_review_count
                from submissions
               group by activity_id
            ) s on s.activity_id = a.id
      where a.class_id = $1
        and ($2::text is null or a.status = $2::text)
      order by a.created_at desc, a.id`,
    [classId, options?.status ?? null],
  );
  return rows.map((row) => ({
    ...toActivity(row),
    lessonTitle: row.lesson_title,
    itemCount: row.item_count,
    maxScore: row.max_score,
    submissionCount: row.submission_count,
    needsReviewCount: row.needs_review_count,
  }));
}

/**
 * Replaces title, instructions and the whole item list (positions follow the
 * array order), and recomputes the activity type from the items: one item
 * type throughout, otherwise "mixed".
 *
 * Drafts only. Returns null, and changes nothing, if the activity is missing
 * or already published: answers belong to items, so replacing the items of a
 * published activity would delete what students handed in.
 */
export async function updateActivity(
  id: string,
  input: { title: string; instructions: string; items: ItemInput[] },
): Promise<ActivityWithItems | null> {
  return transaction(async (q) => {
    // Updating first also locks the row, so two saves cannot interleave.
    const updated = await q<{ id: string }>(
      `update activities
          set title = $2,
              instructions = $3,
              type = coalesce($4::text, type)
        where id = $1
          and status = 'draft'
        returning id`,
      [id, input.title, input.instructions, typeFromItems(input.items)],
    );
    if (updated.length === 0) return null;
    await q("delete from items where activity_id = $1", [id]);
    await insertItems(q, id, input.items);
    return loadActivity(q, id);
  });
}

/** Sets status to published and stamps published_at. Null if missing. */
export async function publishActivity(id: string): Promise<Activity | null> {
  // Publishing twice keeps the first timestamp.
  const [row] = await query<ActivityRow>(
    `update activities
        set status = 'published',
            published_at = coalesce(published_at, now())
      where id = $1
      returning *`,
    [id],
  );
  return row ? toActivity(row) : null;
}

export async function deleteActivity(id: string): Promise<void> {
  // Items, submissions and answers go with it (on delete cascade).
  await query("delete from activities where id = $1", [id]);
}

// --- submissions and answers -------------------------------------------------

/** Answers are ordered by their item's position. */
export async function getSubmission(
  activityId: string,
  studentId: string,
): Promise<SubmissionWithAnswers | null> {
  const [submission] = await loadSubmissions(
    query,
    "s.activity_id = $1 and s.student_id = $2",
    [activityId, studentId],
  );
  return submission ?? null;
}

export async function getSubmissionById(
  id: string,
): Promise<SubmissionWithAnswers | null> {
  return loadSubmissionById(query, id);
}

/** Every submission for an activity, by student name. */
export async function listSubmissions(
  activityId: string,
): Promise<SubmissionWithAnswers[]> {
  return loadSubmissions(query, "s.activity_id = $1", [activityId], "u.name, s.id");
}

/** A student's submissions, newest first. */
export async function listSubmissionsForStudent(
  studentId: string,
): Promise<Submission[]> {
  const rows = await query<SubmissionRow>(
    "select * from submissions where student_id = $1 order by submitted_at desc, id",
    [studentId],
  );
  return rows.map(toSubmission);
}

/**
 * Stores a graded submission in one transaction. needs_review on the
 * submission is true if any answer needs review.
 * Throws DuplicateSubmissionError if (activityId, studentId) already exists.
 */
export async function createSubmission(input: {
  activityId: string;
  studentId: string;
  answers: NewAnswer[];
  totalScore: number;
  maxScore: number;
  /** The AI service that graded the free-text answers, if one did. */
  gradingProvider?: AiProviderName | null;
}): Promise<SubmissionWithAnswers> {
  const id = crypto.randomUUID();
  return transaction(async (q) => {
    try {
      await q(
        `insert into submissions
           (id, activity_id, student_id, total_score, max_score, needs_review,
            grading_provider)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          input.activityId,
          input.studentId,
          input.totalScore,
          input.maxScore,
          input.answers.some((answer) => answer.needsReview),
          input.gradingProvider ?? null,
        ],
      );
    } catch (error) {
      // The id is new, so the only unique constraint this insert can break
      // is (activity_id, student_id). Throwing rolls the transaction back.
      if (isUniqueViolation(error)) throw new DuplicateSubmissionError();
      throw error;
    }
    await insertRows(
      q,
      "answers",
      ANSWER_COLUMNS,
      input.answers.map((answer) => [
        crypto.randomUUID(),
        id,
        answer.itemId,
        answer.response,
        answer.score,
        answer.feedback,
        answer.gradedBy,
        answer.confidence,
        answer.needsReview,
      ]),
    );
    const submission = await loadSubmissionById(q, id);
    if (!submission) {
      throw new Error("The submission could not be read back after saving.");
    }
    return submission;
  });
}

export async function getAnswer(id: string): Promise<Answer | null> {
  const [row] = await query<AnswerRow>("select * from answers where id = $1", [id]);
  return row ? toAnswer(row) : null;
}

/**
 * Teacher override. In one transaction: sets the answer's score (and feedback
 * if given), graded_by = 'teacher', needs_review = false; recomputes the
 * submission's total_score and needs_review; clears the parent summary, which
 * is now out of date. Returns null if the answer is missing.
 */
export async function overrideAnswer(
  answerId: string,
  input: { score: number; feedback?: string },
): Promise<SubmissionWithAnswers | null> {
  return transaction(async (q) => {
    const [answer] = await q<{ submission_id: string }>(
      `update answers
          set score = $2,
              feedback = coalesce($3::text, feedback),
              graded_by = 'teacher',
              needs_review = false
        where id = $1
        returning submission_id`,
      [answerId, input.score, input.feedback ?? null],
    );
    if (!answer) return null;
    await q(
      `update submissions s
          set total_score = t.total_score,
              needs_review = t.needs_review,
              summary = null,
              summary_provider = null
         from (
                select coalesce(sum(score), 0) as total_score,
                       coalesce(bool_or(needs_review), false) as needs_review
                  from answers
                 where submission_id = $1
              ) t
        where s.id = $1`,
      [answer.submission_id],
    );
    return loadSubmissionById(q, answer.submission_id);
  });
}

export async function setSubmissionSummary(
  submissionId: string,
  summary: ParentSummary,
  provider: AiProviderName,
): Promise<void> {
  await query(
    "update submissions set summary = $2::jsonb, summary_provider = $3 where id = $1",
    [submissionId, toJsonb(summary), provider],
  );
}

// --- demo --------------------------------------------------------------------

/** Deletes the sample class with everything in it and puts it back as new. */
export async function resetDemoData(): Promise<void> {
  await resetAndSeed(await getDb());
}
