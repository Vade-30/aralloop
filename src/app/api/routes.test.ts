// Runs every API route handler against the seeded in-memory database and the
// offline sample AI (see vitest.config.ts), with only the cookie store
// replaced. It checks what reading the code cannot prove: who gets in, what a
// bad request gets back, and that no answer key leaves the server before a
// student has submitted.
//
// The tests share one database and run in file order, following the loop:
// teacher drafts and publishes, student submits, teacher overrides, parent
// reads the summary.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("REDIRECT");
  },
}));

import type {
  ActivityResponse,
  ApiErrorBody,
  AskResponse,
  CreateLessonResponse,
  ExtractResponse,
  OkResponse,
  OverrideAnswerResponse,
  PublishResponse,
  SessionResponse,
  SubmissionResponse,
  SummaryResponse,
  UpdateActivityRequest,
} from "@/lib/contracts";
import { closeDb, query } from "@/lib/db/client";
import { getActivity, getSubmission, getSubmissionById } from "@/lib/db/repo";
import { SEED_CONTENT_IDS, SEED_IDS } from "@/lib/db/seed";
import { SESSION_COOKIE } from "@/lib/session";
import { PATCH as updateActivityRoute, DELETE as deleteActivityRoute } from "./activities/[activityId]/route";
import { POST as publishRoute } from "./activities/[activityId]/publish/route";
import { POST as submitRoute } from "./activities/[activityId]/submissions/route";
import { PATCH as overrideRoute } from "./answers/[answerId]/route";
import { POST as resetRoute } from "./demo/reset/route";
import { POST as generateRoute } from "./lessons/[lessonId]/activities/route";
import { POST as extractRoute } from "./lessons/extract/route";
import { POST as createLessonRoute } from "./lessons/route";
import { DELETE as signOutRoute, POST as signInRoute } from "./session/route";
import { POST as askRoute } from "./submissions/[submissionId]/ask/route";
import { POST as summaryRoute } from "./submissions/[submissionId]/summary/route";

const TEACHER = SEED_IDS.teacherId;
const [MIGUEL, ALTHEA] = SEED_IDS.studentIds;
const PARENT = SEED_IDS.parentId; // Miguel's parent
const OTHER_TEACHER = "user-teacher-other";
const OTHER_STUDENT = "user-student-other";

const WATER_LESSON = SEED_CONTENT_IDS.waterCycleLessonId;
const WATER = SEED_CONTENT_IDS.waterCycleActivityId;
const MIGUEL_CELL = "submission-cell-miguel";
const JOSHUA_CELL = "submission-cell-joshua";
const JOSHUA_WATER = "submission-water-joshua";
/** Joshua's low-confidence short answer: 1 of 3 points, waiting for review. */
const FLAGGED_ANSWER = "answer-water-joshua-4";

/** Text that exists only in the answer key, rubric or explanation of the water cycle items. */
const WATER_SECRETS = [
  "3 points: explains that rice needs",
  "Heat from the Sun turns liquid water",
  "Condensing",
  "Trees slow down runoff, so less water rushes",
];

/** Any route handler, whatever params its context carries. */
type Handler = (request: Request, context: never) => Promise<Response>;

interface CallOptions {
  /** The signed-in user id; omit for a visitor with no account chosen. */
  as?: string;
  method?: string;
  body?: unknown;
  formData?: FormData;
  params?: Record<string, string>;
}

async function call<Result>(
  handler: Handler,
  { as, method = "POST", body, formData, params = {} }: CallOptions = {},
): Promise<{ status: number; body: Result; error: ApiErrorBody["error"] | undefined; text: string }> {
  jar.clear();
  if (as) jar.set(SESSION_COOKIE, as);
  const request = new Request("http://aralloop.test/api", {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const response = await handler(request, { params: Promise.resolve(params) } as never);
  const text = await response.text();
  const parsed = JSON.parse(text) as Result & Partial<ApiErrorBody>;
  return { status: response.status, body: parsed, error: parsed.error, text };
}

const LONG_ENOUGH =
  "Plants make their own food through photosynthesis. They take in water through their roots and carbon dioxide through their leaves, and they use sunlight to turn these into sugar and oxygen.";

beforeAll(async () => {
  // A second class, to prove that ids from another class are treated as missing.
  await query(
    "insert into classes (id, name, grade_level, subject, join_code) values ($1, $2, $3, $4, $5)",
    ["class-other", "Grade 8 - Rosal", "Grade 8", "Science", "ROSAL8"],
  );
  await query(
    "insert into users (id, name, role, class_id) values ($1, $2, 'teacher', $3), ($4, $5, 'student', $3)",
    [OTHER_TEACHER, "Mr. Other Teacher", "class-other", OTHER_STUDENT, "Other Student"],
  );
});

afterAll(async () => {
  await closeDb();
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("session", () => {
  it("signs in as a sample account and signs out again", async () => {
    const signedIn = await call<SessionResponse>(signInRoute, { body: { userId: TEACHER } });
    expect(signedIn.status).toBe(200);
    expect(signedIn.body.user).toMatchObject({ id: TEACHER, role: "teacher" });
    expect(jar.get(SESSION_COOKIE)).toBe(TEACHER);

    const signedOut = await call<OkResponse>(signOutRoute, { as: TEACHER, method: "DELETE" });
    expect(signedOut.body).toEqual({ ok: true });
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  it("rejects an unknown account and a body without a user id", async () => {
    const unknown = await call(signInRoute, { body: { userId: "nobody" } });
    expect(unknown.status).toBe(404);
    expect(jar.has(SESSION_COOKIE)).toBe(false);

    expect((await call(signInRoute, { body: {} })).status).toBe(400);
    expect((await call(signInRoute)).status).toBe(400);
  });
});

describe("who may call what", () => {
  it("answers 401 when no account is chosen, or the cookie names no user", async () => {
    const body = { title: "Photosynthesis", content: LONG_ENOUGH };
    const visitor = await call(createLessonRoute, { body });
    expect(visitor.status).toBe(401);
    expect(visitor.error?.code).toBe("unauthenticated");
    expect((await call(createLessonRoute, { as: "deleted-user", body })).status).toBe(401);
  });

  it("answers 403 to the wrong role on every teacher-only route", async () => {
    // One after another: the calls share the cookie store.
    const calls = [
      () => call(createLessonRoute, { as: MIGUEL, body: { title: "x", content: LONG_ENOUGH } }),
      () => call(extractRoute, { as: MIGUEL, formData: new FormData() }),
      () => call(generateRoute, { as: PARENT, params: { lessonId: WATER_LESSON } }),
      () => call(updateActivityRoute, { as: MIGUEL, method: "PATCH", params: { activityId: WATER }, body: {} }),
      () => call(deleteActivityRoute, { as: MIGUEL, method: "DELETE", params: { activityId: WATER } }),
      () => call(publishRoute, { as: PARENT, params: { activityId: WATER } }),
      () => call(overrideRoute, { as: MIGUEL, method: "PATCH", params: { answerId: FLAGGED_ANSWER }, body: { score: 3 } }),
      // Only students hand in answers.
      () => call(submitRoute, { as: TEACHER, params: { activityId: WATER }, body: { answers: [] } }),
    ];
    for (const run of calls) {
      const result = await run();
      expect(result.status).toBe(403);
      expect(result.error?.code).toBe("forbidden");
    }
  });

  it("treats anything in another class as missing", async () => {
    const calls = [
      () => call(generateRoute, { as: OTHER_TEACHER, params: { lessonId: WATER_LESSON } }),
      () => call(updateActivityRoute, { as: OTHER_TEACHER, method: "PATCH", params: { activityId: WATER }, body: {} }),
      () => call(deleteActivityRoute, { as: OTHER_TEACHER, method: "DELETE", params: { activityId: WATER } }),
      () => call(publishRoute, { as: OTHER_TEACHER, params: { activityId: WATER } }),
      () => call(overrideRoute, { as: OTHER_TEACHER, method: "PATCH", params: { answerId: FLAGGED_ANSWER }, body: { score: 3 } }),
      () => call(summaryRoute, { as: OTHER_TEACHER, params: { submissionId: JOSHUA_WATER } }),
      () => call(askRoute, { as: OTHER_TEACHER, params: { submissionId: JOSHUA_WATER }, body: { question: "Why?" } }),
      () => call(submitRoute, { as: OTHER_STUDENT, params: { activityId: WATER }, body: { answers: [{ itemId: "item-water-1", response: "The Sun" }] } }),
      () => call(askRoute, { as: OTHER_STUDENT, params: { submissionId: JOSHUA_WATER }, body: { question: "Why?" } }),
    ];
    for (const run of calls) {
      const result = await run();
      expect(result.status).toBe(404);
      // Nothing about the real row leaks into the answer.
      for (const secret of WATER_SECRETS) expect(result.text).not.toContain(secret);
    }
    // Joshua's flagged answer is untouched.
    const joshua = await getSubmissionById(JOSHUA_WATER);
    expect(joshua?.answers[3]).toMatchObject({ score: 1, gradedBy: "ai", needsReview: true });
  });
});

describe("teacher: lesson, draft, publish", () => {
  let lessonId = "";
  let draftId = "";

  it("saves a lesson into the teacher's own class and validates it", async () => {
    const tooShort = await call(createLessonRoute, {
      as: TEACHER,
      body: { title: "Photosynthesis", content: "Too short." },
    });
    expect(tooShort.status).toBe(400);
    expect(tooShort.error?.code).toBe("validation");

    const created = await call<CreateLessonResponse>(createLessonRoute, {
      as: TEACHER,
      // A class id in the body is ignored: the class comes from the session.
      body: { title: "  Photosynthesis  ", content: LONG_ENOUGH, classId: "class-other" },
    });
    expect(created.status).toBe(200);
    expect(created.body.lesson).toMatchObject({
      title: "Photosynthesis",
      classId: SEED_IDS.classId,
      content: LONG_ENOUGH,
    });
    lessonId = created.body.lesson.id;
  });

  it("reads the text of an uploaded file and refuses unsupported ones", async () => {
    const upload = (name: string, content: string) => {
      const formData = new FormData();
      formData.append("file", new File([content], name));
      return call<ExtractResponse>(extractRoute, { as: TEACHER, formData });
    };

    const read = await upload("the-water_cycle.txt", LONG_ENOUGH);
    expect(read.status).toBe(200);
    expect(read.body).toEqual({ title: "the water cycle", text: LONG_ENOUGH, truncated: false });

    const picture = await upload("photo.png", LONG_ENOUGH);
    expect(picture.status).toBe(400);
    expect(picture.error?.message).toMatch(/not supported/);

    expect((await upload("empty.txt", "")).status).toBe(400);
    expect((await call(extractRoute, { as: TEACHER, formData: new FormData() })).status).toBe(400);
  });

  it("generates a draft with no request body, in sample mode", async () => {
    const generated = await call<ActivityResponse>(generateRoute, {
      as: TEACHER,
      params: { lessonId: WATER_LESSON },
    });
    expect(generated.status).toBe(200);
    const { activity } = generated.body;
    expect(activity).toMatchObject({
      lessonId: WATER_LESSON,
      classId: SEED_IDS.classId,
      status: "draft",
      aiProvider: "mock",
      publishedAt: null,
    });
    expect(activity.items.length).toBeGreaterThanOrEqual(3);
    expect(activity.items.length).toBeLessThanOrEqual(8);
    expect(activity.items.map((item) => item.position)).toEqual(
      activity.items.map((_, index) => index + 1),
    );
    draftId = activity.id;

    const invalid = await call(generateRoute, {
      as: TEACHER,
      params: { lessonId: WATER_LESSON },
      body: { itemCount: 99 },
    });
    expect(invalid.status).toBe(400);
    expect((await call(generateRoute, { as: TEACHER, params: { lessonId: "missing" } })).status).toBe(404);
    expect(lessonId).not.toBe("");
  });

  it("hides a draft from students", async () => {
    const draft = await getActivity(draftId);
    const attempt = await call(submitRoute, {
      as: MIGUEL,
      params: { activityId: draftId },
      body: { answers: [{ itemId: draft?.items[0].id, response: "anything" }] },
    });
    expect(attempt.status).toBe(404);
  });

  const edited: UpdateActivityRequest = {
    title: "Water cycle check",
    instructions: "Answer every item.",
    items: [
      {
        type: "multiple_choice",
        question: "Where does the energy for the water cycle come from?",
        choices: ["The Moon", "The Sun", "The wind"],
        answerKey: "The Sun",
        acceptedAnswers: ["ignored for this type"],
        rubric: "ignored for this type",
        explanation: "",
        points: 1,
      },
      {
        type: "true_false",
        question: "Rain that soaks into the soil becomes groundwater.",
        choices: null,
        answerKey: "true",
        acceptedAnswers: [],
        rubric: null,
        explanation: null,
        points: 1,
      },
      {
        type: "short_answer",
        question: "Why do farmers watch the rain?",
        choices: null,
        answerKey: "Rice needs flooded fields, so farmers plant when the rain comes.",
        acceptedAnswers: [],
        rubric: null,
        explanation: null,
        points: 3,
      },
    ],
  };

  it("saves the teacher's edits and keeps each item consistent with its type", async () => {
    const wrongKey = await call(updateActivityRoute, {
      as: TEACHER,
      method: "PATCH",
      params: { activityId: draftId },
      body: { ...edited, items: [{ ...edited.items[0], answerKey: "The sea" }] },
    });
    expect(wrongKey.status).toBe(400);
    expect(wrongKey.error?.message).toMatch(/^Item 1: /);

    const saved = await call<ActivityResponse>(updateActivityRoute, {
      as: TEACHER,
      method: "PATCH",
      params: { activityId: draftId },
      body: edited,
    });
    expect(saved.status).toBe(200);
    const [choice, trueFalse, short] = saved.body.activity.items;
    expect(saved.body.activity).toMatchObject({ title: "Water cycle check", type: "mixed", status: "draft" });
    expect(choice).toMatchObject({ acceptedAnswers: [], rubric: null, explanation: null });
    expect(trueFalse).toMatchObject({ choices: ["True", "False"], answerKey: "True" });
    // With no rubric, the model answer is what the AI grades against.
    expect(short.rubric).toBe(short.answerKey);
  });

  it("publishes once, then locks the activity", async () => {
    const first = await call<PublishResponse>(publishRoute, { as: TEACHER, params: { activityId: draftId } });
    expect(first.status).toBe(200);
    expect(first.body.activity.status).toBe("published");
    expect(first.body.activity.publishedAt).not.toBeNull();
    expect(first.body.activity).not.toHaveProperty("items");

    const second = await call<PublishResponse>(publishRoute, { as: TEACHER, params: { activityId: draftId } });
    expect(second.body.activity.publishedAt).toBe(first.body.activity.publishedAt);
    expect(second.body.activity).not.toHaveProperty("items");

    const edit = await call(updateActivityRoute, {
      as: TEACHER,
      method: "PATCH",
      params: { activityId: draftId },
      body: edited,
    });
    expect(edit.status).toBe(409);
    const remove = await call(deleteActivityRoute, {
      as: TEACHER,
      method: "DELETE",
      params: { activityId: draftId },
    });
    expect(remove.status).toBe(409);
    expect(await getActivity(draftId)).not.toBeNull();
  });

  it("deletes a draft", async () => {
    const generated = await call<ActivityResponse>(generateRoute, {
      as: TEACHER,
      params: { lessonId: WATER_LESSON },
      body: { itemCount: 3, preferredType: "true_false" },
    });
    const id = generated.body.activity.id;
    const removed = await call<OkResponse>(deleteActivityRoute, {
      as: TEACHER,
      method: "DELETE",
      params: { activityId: id },
    });
    expect(removed.body).toEqual({ ok: true });
    expect(await getActivity(id)).toBeNull();
  });
});

describe("student: submit", () => {
  const answers = [
    { itemId: "item-water-1", response: "The Sun" },
    { itemId: "item-water-2", response: "False" },
    { itemId: "item-water-3", response: " condensation " },
    { itemId: "item-water-4", response: "The farmers wait for the rain so the rice is planted late." },
    { itemId: "item-water-5", response: "" },
  ];

  it("rejects answers that do not belong to the activity, without saving", async () => {
    const foreign = await call(submitRoute, {
      as: MIGUEL,
      params: { activityId: WATER },
      body: { answers: [{ itemId: "item-cell-1", response: "Cell membrane" }] },
    });
    expect(foreign.status).toBe(400);

    const twice = await call(submitRoute, {
      as: MIGUEL,
      params: { activityId: WATER },
      body: { answers: [answers[0], answers[0]] },
    });
    expect(twice.status).toBe(400);
    expect((await call(submitRoute, { as: MIGUEL, params: { activityId: WATER }, body: { answers: [] } })).status).toBe(400);
    expect(await getSubmission(WATER, MIGUEL)).toBeNull();
  });

  it("grades, stores and returns the submission without the items", async () => {
    const result = await call<SubmissionResponse>(submitRoute, {
      as: MIGUEL,
      params: { activityId: WATER },
      body: { answers },
    });
    expect(result.status).toBe(200);
    expect(Object.keys(result.body).sort()).toEqual(["notice", "submission"]);

    const { submission } = result.body;
    expect(submission).not.toHaveProperty("items");
    for (const answer of submission.answers) {
      expect(Object.keys(answer).sort()).toEqual(
        ["confidence", "feedback", "gradedBy", "id", "itemId", "needsReview", "response", "score", "submissionId"].sort(),
      );
    }
    // The rubric, the explanations and the accepted answers stay on the server.
    for (const secret of WATER_SECRETS) expect(result.text).not.toContain(secret);

    const [sun, groundwater, condensation, lateRain, trees] = submission.answers;
    expect(sun).toMatchObject({ score: 1, gradedBy: "code" });
    expect(groundwater).toMatchObject({ score: 0, gradedBy: "code" });
    expect(condensation).toMatchObject({ score: 2, gradedBy: "code", response: "condensation" });
    // Sample-mode grades are never confident, so the teacher is asked to look.
    expect(lateRain).toMatchObject({ gradedBy: "ai", needsReview: true });
    expect(trees).toMatchObject({ score: 0, gradedBy: "code", feedback: "No answer was given." });

    expect(submission.maxScore).toBe(10);
    expect(submission.totalScore).toBe(
      submission.answers.reduce((sum, answer) => sum + answer.score, 0),
    );
    expect(submission.needsReview).toBe(true);
    expect(submission.gradingProvider).toBe("mock");
    expect(await getSubmission(WATER, MIGUEL)).toEqual(submission);
  });

  it("allows one attempt only", async () => {
    const again = await call(submitRoute, {
      as: MIGUEL,
      params: { activityId: WATER },
      body: { answers },
    });
    expect(again.status).toBe(409);
    expect(again.error?.code).toBe("conflict");
  });
});

describe("teacher: override a score", () => {
  it("refuses a score above the item's points", async () => {
    const tooHigh = await call(overrideRoute, {
      as: TEACHER,
      method: "PATCH",
      params: { answerId: FLAGGED_ANSWER },
      body: { score: 3.5 },
    });
    expect(tooHigh.status).toBe(400);
    expect(tooHigh.error?.message).toMatch(/cannot be higher than 3/);
    expect((await call(overrideRoute, { as: TEACHER, method: "PATCH", params: { answerId: FLAGGED_ANSWER }, body: { score: -1 } })).status).toBe(400);
    expect((await call(overrideRoute, { as: TEACHER, method: "PATCH", params: { answerId: "missing" }, body: { score: 1 } })).status).toBe(404);
  });

  it("sets the score, recomputes the total and clears the review flag", async () => {
    const saved = await call<OverrideAnswerResponse>(overrideRoute, {
      as: TEACHER,
      method: "PATCH",
      params: { answerId: FLAGGED_ANSWER },
      body: { score: 2.5, feedback: "  You named one effect and why it happens.  " },
    });
    expect(saved.status).toBe(200);
    const { submission } = saved.body;
    expect(submission.answers[3]).toMatchObject({
      id: FLAGGED_ANSWER,
      score: 2.5,
      gradedBy: "teacher",
      needsReview: false,
      feedback: "You named one effect and why it happens.",
    });
    // 1 + 1 + 0 + 2.5 + 3
    expect(submission.totalScore).toBe(7.5);
    expect(submission.needsReview).toBe(false);
  });
});

describe("parent summary", () => {
  it("is closed to students and to a parent of another child", async () => {
    expect((await call(summaryRoute, { as: MIGUEL, params: { submissionId: MIGUEL_CELL } })).status).toBe(404);
    expect((await call(summaryRoute, { as: PARENT, params: { submissionId: JOSHUA_CELL } })).status).toBe(404);
    expect((await call(summaryRoute, { as: PARENT, params: { submissionId: "missing" } })).status).toBe(404);
  });

  it("returns the stored summary without writing a new one", async () => {
    const stored = (await getSubmissionById(MIGUEL_CELL))?.summary;
    const result = await call<SummaryResponse>(summaryRoute, {
      as: PARENT,
      params: { submissionId: MIGUEL_CELL },
      // A parent cannot ask for a rewrite; the flag is ignored.
      body: { regenerate: true },
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ summary: stored, provider: "mock" });
  });

  it("writes and stores a summary the first time, in both languages", async () => {
    const mine = await getSubmission(WATER, MIGUEL);
    if (!mine) throw new Error("Miguel's submission is missing");
    expect(mine.summary).toBeNull();

    const written = await call<SummaryResponse>(summaryRoute, {
      as: PARENT,
      params: { submissionId: mine.id },
    });
    expect(written.status).toBe(200);
    expect(written.body.provider).toBe("mock");
    expect(written.body.summary.en.overview).toContain("Miguel");
    expect(written.body.summary.fil.overview).not.toBe("");
    // Some answers still wait for the teacher, and the summary says so.
    expect(written.body.summary.en.overview).toMatch(/teacher/i);

    const after = await getSubmissionById(mine.id);
    expect(after?.summary).toEqual(written.body.summary);
    expect(after?.summaryProvider).toBe("mock");

    const bad = await call(summaryRoute, {
      as: TEACHER,
      params: { submissionId: mine.id },
      body: { regenerate: "yes" },
    });
    expect(bad.status).toBe(400);
  });
});

describe("after-submission tutor", () => {
  it("answers the student who submitted, their parent and their teacher", async () => {
    for (const as of [MIGUEL, PARENT, TEACHER]) {
      const result = await call<AskResponse>(askRoute, {
        as,
        params: { submissionId: MIGUEL_CELL },
        body: { question: "Why did I lose points on question 2?" },
      });
      expect(result.status).toBe(200);
      expect(result.body.provider).toBe("mock");
      expect(result.body.reply.trim()).not.toBe("");
    }
  });

  it("is closed to other students and validates the question", async () => {
    const other = await call(askRoute, {
      as: ALTHEA,
      params: { submissionId: MIGUEL_CELL },
      body: { question: "What did Miguel answer?" },
    });
    expect(other.status).toBe(404);

    const empty = await call(askRoute, {
      as: MIGUEL,
      params: { submissionId: MIGUEL_CELL },
      body: { question: "   " },
    });
    expect(empty.status).toBe(400);

    const history = Array.from({ length: 11 }, () => ({ role: "user", content: "again" }));
    const tooLong = await call(askRoute, {
      as: MIGUEL,
      params: { submissionId: MIGUEL_CELL },
      body: { question: "Why?", history },
    });
    expect(tooLong.status).toBe(400);
  });
});

describe("demo reset", () => {
  it("can be turned off", async () => {
    vi.stubEnv("ALLOW_DEMO_RESET", "false");
    const result = await call(resetRoute);
    vi.unstubAllEnvs();
    expect(result.status).toBe(403);
    expect(await getSubmission(WATER, MIGUEL)).not.toBeNull();
  });

  it("restores the sample data and signs the visitor out", async () => {
    const result = await call<OkResponse>(resetRoute, { as: TEACHER });
    expect(result.body).toEqual({ ok: true });
    expect(jar.has(SESSION_COOKIE)).toBe(false);

    expect(await getSubmission(WATER, MIGUEL)).toBeNull();
    const joshua = await getSubmissionById(JOSHUA_WATER);
    expect(joshua?.answers[3]).toMatchObject({ score: 1, gradedBy: "ai", needsReview: true });
    const [others] = await query<{ count: number }>(
      "select count(*)::int as count from users where id = $1",
      [OTHER_TEACHER],
    );
    expect(others.count).toBe(0);
  });
});
