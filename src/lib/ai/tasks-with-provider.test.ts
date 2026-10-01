// The four AI tasks together with the real provider layer. tasks.test.ts
// replaces the provider and provider.test.ts uses a made-up schema, so this
// file is the only place where a task's own schema and prompt go through the
// real OpenAI and Gemini request builders. Only fetch is replaced: no AI
// service is called and the keys below are made up.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiResult } from "../types";
import { generateActivity } from "./generate-activity";
import { gradeFreeText } from "./grade";
import { writeParentSummary } from "./parent-summary";
import { UNTRUSTED_RULE } from "./prompts";
import { answerTutorQuestion } from "./tutor";
import type { ResultItem } from "./types";

type Json = Record<string, unknown>;

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  for (const name of ["AI_PROVIDER", "OPENAI_MODEL", "GEMINI_MODEL", "OPENAI_REASONING_EFFORT"]) {
    vi.stubEnv(name, "");
  }
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function useProvider(provider: "openai" | "gemini", payload: unknown): void {
  vi.stubEnv("OPENAI_API_KEY", provider === "openai" ? "sk-test-made-up" : "");
  vi.stubEnv("GEMINI_API_KEY", provider === "gemini" ? "test-made-up" : "");
  const text = JSON.stringify(payload);
  const body =
    provider === "openai"
      ? {
          status: "completed",
          output: [{ type: "message", content: [{ type: "output_text", text }] }],
        }
      : { candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] };
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
}

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The body of the only request that was sent. */
function sentBody(): Json {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  return JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Json;
}

/** Calls visit for every schema node: the root, each property, array items and branches. */
function walk(schema: unknown, visit: (node: Json, path: string) => void, path = "schema"): void {
  if (!isRecord(schema)) return;
  visit(schema, path);
  for (const key of ["properties", "$defs"]) {
    const group = schema[key];
    if (!isRecord(group)) continue;
    for (const [name, child] of Object.entries(group)) walk(child, visit, `${path}.${name}`);
  }
  walk(schema.items, visit, `${path}[]`);
  for (const key of ["anyOf", "oneOf"]) {
    const branches = schema[key];
    if (Array.isArray(branches)) {
      branches.forEach((branch, index) => walk(branch, visit, `${path}.${key}${index}`));
    }
  }
}

/** What OpenAI's strict structured output requires of a schema. */
function expectOpenAiStrict(body: Json): void {
  expect(body.model).toBeTruthy();
  expect(String(body.instructions)).toContain(UNTRUSTED_RULE);
  expect(String(body.input)).not.toBe("");
  const format = (body.text as Json).format as Json;
  expect(format).toMatchObject({ type: "json_schema", strict: true });
  expect(String(format.name)).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);

  const schema = format.schema as Json;
  expect(schema.type).toBe("object");
  let objects = 0;
  walk(schema, (node, path) => {
    for (const keyword of ["$schema", "default", "minLength", "maxLength", "pattern", "format"]) {
      expect(node, `${path} must not use ${keyword}`).not.toHaveProperty(keyword);
    }
    if (isRecord(node.properties)) {
      objects += 1;
      expect(node.additionalProperties, `${path}.additionalProperties`).toBe(false);
      expect(node.required, `${path}.required`).toEqual(Object.keys(node.properties));
    }
  });
  expect(objects).toBeGreaterThan(0);
}

const GEMINI_KEYWORDS = new Set([
  "type",
  "description",
  "enum",
  "items",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "properties",
  "additionalProperties",
  "required",
]);

/** Gemini accepts a subset of JSON Schema; anything else is a 400. */
function expectGeminiSchema(body: Json): void {
  const system = (body.systemInstruction as { parts: { text: string }[] }).parts[0].text;
  expect(system).toContain(UNTRUSTED_RULE);
  const config = body.generationConfig as Json;
  const format = (config.responseFormat as Json).text as Json;
  expect(format.mimeType).toBe("application/json");
  walk(format.schema, (node, path) => {
    for (const keyword of Object.keys(node)) {
      expect(GEMINI_KEYWORDS.has(keyword), `${path} uses ${keyword}`).toBe(true);
    }
  });
}

const LESSON = `Plants make their own food through a process called photosynthesis. It happens mostly in the leaves.

Leaves contain a green substance called chlorophyll, which captures energy from sunlight. The plant takes in water through its roots and carbon dioxide through tiny openings called stomata.`;

const RESULTS: ResultItem[] = [
  {
    position: 1,
    type: "identification",
    question: "What green substance captures sunlight?",
    correctAnswer: "Chlorophyll",
    response: "clorofil",
    score: 1,
    points: 1,
    feedback: "Correct.",
  },
  {
    position: 2,
    type: "short_answer",
    question: "Why do plants need sunlight?",
    correctAnswer: "Sunlight gives the energy to make food.",
    response: "",
    score: 0,
    points: 2,
    feedback: "No answer was given.",
  },
];

const TEXT = {
  overview: "Ana answered an activity about how plants make food and scored 1 out of 3.",
  didWell: ["She knows what chlorophyll does."],
  toPractice: ["Why plants need sunlight."],
  homeTip: "Ask Ana what would happen to a plant kept in a dark room.",
};

interface TaskCase {
  name: string;
  /** What the model is made to answer. */
  payload: unknown;
  run: () => Promise<AiResult<unknown>>;
  check: (data: unknown) => void;
}

const CASES: TaskCase[] = [
  {
    name: "generateActivity",
    payload: {
      title: "How plants make food",
      instructions: "Answer every item.",
      type: "mixed",
      reason: "The lesson has both terms and a process to explain.",
      items: [
        {
          type: "multiple_choice",
          question: "Which substance captures energy from sunlight?",
          choices: ["Chlorophyll", "Stomata", "Roots", "Water"],
          answerKey: "Chlorophyll",
          acceptedAnswers: [],
          rubric: null,
          explanation: "Chlorophyll captures energy from sunlight.",
          points: 1,
        },
        {
          type: "true_false",
          question: "Photosynthesis happens mostly in the roots.",
          choices: ["True", "False"],
          answerKey: "False",
          acceptedAnswers: [],
          rubric: null,
          explanation: null,
          points: 1,
        },
        {
          type: "short_answer",
          question: "How does a plant get what it needs to make food?",
          choices: null,
          answerKey: "It takes in water through its roots and carbon dioxide through stomata.",
          acceptedAnswers: [],
          rubric: "2 points: names water through the roots and carbon dioxide through stomata.",
          explanation: null,
          points: 2,
        },
      ],
    },
    run: () =>
      generateActivity({
        lessonTitle: "How plants make food",
        lessonContent: LESSON,
        gradeLevel: "Grade 6",
        subject: "Science",
        itemCount: 3,
        preferredType: "auto",
      }),
    check: (data) => {
      expect(data).toMatchObject({ title: "How plants make food", type: "mixed" });
      expect((data as { items: unknown[] }).items).toHaveLength(3);
    },
  },
  {
    name: "gradeFreeText",
    payload: {
      grades: [{ number: 1, score: 1.5, feedback: "You named one of the two things.", confidence: 0.8 }],
    },
    run: () =>
      gradeFreeText({
        lessonTitle: "How plants make food",
        gradeLevel: "Grade 6",
        answers: [
          {
            itemId: "item-3",
            type: "short_answer",
            question: "How does a plant get what it needs to make food?",
            answerKey: "It takes in water through its roots and carbon dioxide through stomata.",
            acceptedAnswers: [],
            rubric: "2 points: names water through the roots and carbon dioxide through stomata.",
            points: 2,
            response: "It drinks water with the roots.",
          },
        ],
      }),
    check: (data) => {
      expect(data).toEqual([
        { itemId: "item-3", score: 1.5, feedback: "You named one of the two things.", confidence: 0.8 },
      ]);
    },
  },
  {
    name: "writeParentSummary",
    payload: { en: TEXT, fil: { ...TEXT, overview: "Sumagot si Ana ng activity at nakakuha ng 1 sa 3." } },
    run: () =>
      writeParentSummary({
        studentName: "Ana Reyes",
        gradeLevel: "Grade 6",
        subject: "Science",
        lessonTitle: "How plants make food",
        activityTitle: "Photosynthesis check",
        totalScore: 1,
        maxScore: 3,
        pendingReview: false,
        items: RESULTS,
      }),
    check: (data) => {
      expect(data).toMatchObject({ en: TEXT, fil: { homeTip: TEXT.homeTip } });
    },
  },
  {
    name: "answerTutorQuestion",
    payload: { reply: "Sunlight gives the plant the energy it needs to make food." },
    run: () =>
      answerTutorQuestion({
        audience: "student",
        studentName: "Ana Reyes",
        gradeLevel: "Grade 6",
        lessonTitle: "How plants make food",
        lessonContent: LESSON,
        activityTitle: "Photosynthesis check",
        items: RESULTS,
        question: "Why do plants need sunlight?",
        history: [],
      }),
    check: (data) => {
      expect(data).toEqual({ reply: "Sunlight gives the plant the energy it needs to make food." });
    },
  },
];

describe.each(CASES)("$name through the real provider layer", ({ payload, run, check }) => {
  it("sends OpenAI a schema that strict structured output accepts, and reads the answer", async () => {
    useProvider("openai", payload);
    const result = await run();

    expect(result.provider).toBe("openai");
    check(result.data);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.openai.com/v1/responses");
    expectOpenAiStrict(sentBody());
  });

  it("sends Gemini a schema made only of keywords it supports, and reads the answer", async () => {
    useProvider("gemini", payload);
    const result = await run();

    expect(result.provider).toBe("gemini");
    check(result.data);
    expect(String(fetchMock.mock.calls[0][0])).toContain(":generateContent");
    expectGeminiSchema(sentBody());
  });
});
