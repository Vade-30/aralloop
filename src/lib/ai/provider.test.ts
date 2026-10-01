// Tests for the provider layer. fetch is replaced by a mock, so no real AI
// service is called and no API key is needed. The keys below are made up.

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { z } from "zod";
import { AiError } from "./errors";
import { toGeminiSchema } from "./gemini";
import { toOpenAiSchema } from "./openai";
import {
  AI_TIMEOUT_MS,
  AI_TOTAL_BUDGET_MS,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  generateJson,
  getAiStatus,
} from "./provider";

const OPENAI_KEY = "sk-test-openai-key-123";
const GEMINI_KEY = "test-gemini-key-456";
const OPENAI_URL = "https://api.openai.com/v1/responses";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`;

const ENV_NAMES = [
  "AI_PROVIDER",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "OPENAI_MODEL",
  "GEMINI_MODEL",
  "OPENAI_REASONING_EFFORT",
] as const;

const quizSchema = z.object({
  title: z.string().min(1).max(80),
  items: z
    .array(z.object({ question: z.string(), hint: z.string().optional() }))
    .min(1),
});

const QUIZ = { title: "Plants", items: [{ question: "What do plants need to grow?" }] };

const fetchMock = vi.fn<typeof fetch>();
let infoSpy: MockInstance<typeof console.info>;

beforeEach(() => {
  // The vitest config sets AI_PROVIDER=mock; start every test from a clean slate.
  for (const name of ENV_NAMES) vi.stubEnv(name, "");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setEnv(values: Partial<Record<(typeof ENV_NAMES)[number], string>>): void {
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A Responses API answer; a string payload is sent as is (to fake bad JSON). */
function openAiOk(payload: unknown): Response {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return jsonResponse({
    id: "resp_test",
    status: "completed",
    output: [
      { type: "reasoning", summary: [] },
      { type: "message", role: "assistant", content: [{ type: "output_text", text }] },
    ],
    usage: {
      input_tokens: 120,
      output_tokens: 45,
      total_tokens: 165,
      output_tokens_details: { reasoning_tokens: 10 },
    },
  });
}

function openAiError(status: number, error: Record<string, unknown>): Response {
  return jsonResponse({ error }, status);
}

function geminiOk(payload: unknown): Response {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return jsonResponse({
    candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 30,
      thoughtsTokenCount: 5,
      totalTokenCount: 135,
    },
  });
}

function geminiError(status: number, error: Record<string, unknown>): Response {
  return jsonResponse({ error: { code: status, ...error } }, status);
}

interface SentRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function requestAt(index: number): SentRequest {
  const [url, init] = fetchMock.mock.calls[index];
  return {
    url: String(url),
    headers: init?.headers as Record<string, string>,
    body: JSON.parse(String(init?.body)) as Record<string, unknown>,
  };
}

function askForQuiz() {
  return generateJson({
    task: "quiz",
    system: "You write short quizzes.",
    user: "Write a quiz about plants.",
    schema: quizSchema,
    maxOutputTokens: 500,
    temperature: 0.2,
  });
}

/** Awaits a call that must fail with AiError and returns the error. */
async function failure(promise: Promise<unknown>): Promise<AiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AiError);
    return error as AiError;
  }
  throw new Error("Expected the call to fail, but it succeeded.");
}

function loggedLines(): string[] {
  return infoSpy.mock.calls.map((call) => String(call[0]));
}

describe("getAiStatus", () => {
  it("is sample mode when no key is set", () => {
    expect(getAiStatus()).toEqual({ provider: "mock", model: "sample-mode", fallback: null });
  });

  it("uses OpenAI alone when only its key is set", () => {
    setEnv({ OPENAI_API_KEY: OPENAI_KEY });
    expect(getAiStatus()).toEqual({
      provider: "openai",
      model: DEFAULT_OPENAI_MODEL,
      fallback: null,
    });
  });

  it("uses OpenAI with Gemini as fallback when both keys are set", () => {
    setEnv({ OPENAI_API_KEY: OPENAI_KEY, GEMINI_API_KEY: GEMINI_KEY });
    expect(getAiStatus()).toEqual({
      provider: "openai",
      model: DEFAULT_OPENAI_MODEL,
      fallback: "gemini",
    });
  });

  it("uses Gemini alone when only its key is set", () => {
    setEnv({ GEMINI_API_KEY: GEMINI_KEY });
    expect(getAiStatus()).toEqual({
      provider: "gemini",
      model: DEFAULT_GEMINI_MODEL,
      fallback: null,
    });
  });

  it("treats empty and blank keys as unset", () => {
    setEnv({ OPENAI_API_KEY: "   ", GEMINI_API_KEY: "" });
    expect(getAiStatus().provider).toBe("mock");

    setEnv({ OPENAI_API_KEY: "", GEMINI_API_KEY: GEMINI_KEY });
    expect(getAiStatus()).toMatchObject({ provider: "gemini", fallback: null });
  });

  it("reads the model ids from OPENAI_MODEL and GEMINI_MODEL", () => {
    setEnv({ OPENAI_API_KEY: OPENAI_KEY, OPENAI_MODEL: "custom-openai-model" });
    expect(getAiStatus().model).toBe("custom-openai-model");

    setEnv({ OPENAI_API_KEY: "", GEMINI_API_KEY: GEMINI_KEY, GEMINI_MODEL: "custom-gemini-model" });
    expect(getAiStatus().model).toBe("custom-gemini-model");
  });

  it("AI_PROVIDER=mock wins even when keys are set", () => {
    setEnv({ AI_PROVIDER: "mock", OPENAI_API_KEY: OPENAI_KEY, GEMINI_API_KEY: GEMINI_KEY });
    expect(getAiStatus()).toEqual({ provider: "mock", model: "sample-mode", fallback: null });
  });

  it("AI_PROVIDER=gemini forces Gemini with no fallback", () => {
    setEnv({ AI_PROVIDER: "gemini", OPENAI_API_KEY: OPENAI_KEY, GEMINI_API_KEY: GEMINI_KEY });
    expect(getAiStatus()).toEqual({
      provider: "gemini",
      model: DEFAULT_GEMINI_MODEL,
      fallback: null,
    });
  });

  it("AI_PROVIDER=openai forces OpenAI with no fallback", () => {
    setEnv({ AI_PROVIDER: "OpenAI", OPENAI_API_KEY: OPENAI_KEY, GEMINI_API_KEY: GEMINI_KEY });
    expect(getAiStatus()).toEqual({
      provider: "openai",
      model: DEFAULT_OPENAI_MODEL,
      fallback: null,
    });
  });

  it("an override naming a provider without a key resolves to sample mode", () => {
    setEnv({ AI_PROVIDER: "openai", GEMINI_API_KEY: GEMINI_KEY });
    expect(getAiStatus().provider).toBe("mock");

    setEnv({ AI_PROVIDER: "gemini", OPENAI_API_KEY: OPENAI_KEY, GEMINI_API_KEY: "" });
    expect(getAiStatus().provider).toBe("mock");
  });
});

describe("generateJson with OpenAI", () => {
  beforeEach(() => setEnv({ OPENAI_API_KEY: OPENAI_KEY }));

  it("sends a strict structured-output request and returns the validated data", async () => {
    fetchMock.mockResolvedValueOnce(openAiOk(QUIZ));

    const result = await askForQuiz();

    expect(result).toEqual({ data: QUIZ, provider: "openai", model: DEFAULT_OPENAI_MODEL });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { url, headers, body } = requestAt(0);
    expect(url).toBe(OPENAI_URL);
    expect(headers.Authorization).toBe(`Bearer ${OPENAI_KEY}`);
    expect(body).toMatchObject({
      model: DEFAULT_OPENAI_MODEL,
      instructions: "You write short quizzes.",
      input: "Write a quiz about plants.",
      reasoning: { effort: "low" },
      // The caller's 500 plus room for hidden reasoning.
      max_output_tokens: 4_500,
      text: { format: { type: "json_schema", name: "quiz", strict: true } },
    });
    // Reasoning models reject a temperature.
    expect(body).not.toHaveProperty("temperature");
  });

  it("adapts the schema to strict mode", async () => {
    fetchMock.mockResolvedValueOnce(openAiOk(QUIZ));
    await askForQuiz();

    const format = (requestAt(0).body.text as { format: { schema: Record<string, unknown> } }).format;
    expect(format.schema).toEqual({
      type: "object",
      properties: {
        title: { type: "string", description: "At most 80 characters." },
        items: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              // Optional in zod, so required and nullable here.
              hint: { type: ["string", "null"] },
            },
            required: ["question", "hint"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "items"],
      additionalProperties: false,
    });
  });

  it("drops the nulls that strict mode returns for optional fields", async () => {
    fetchMock.mockResolvedValueOnce(
      openAiOk({ title: "Plants", items: [{ question: "What is a root?", hint: null }] }),
    );
    const result = await askForQuiz();
    expect(result.data).toStrictEqual({ title: "Plants", items: [{ question: "What is a root?" }] });
  });

  it("sends the temperature when reasoning is turned off", async () => {
    setEnv({ OPENAI_REASONING_EFFORT: "none" });
    fetchMock.mockResolvedValueOnce(openAiOk(QUIZ));
    await askForQuiz();

    expect(requestAt(0).body).toMatchObject({
      reasoning: { effort: "none" },
      temperature: 0.2,
      max_output_tokens: 500,
    });
  });

  it("asks again without a setting the model rejects", async () => {
    fetchMock
      .mockResolvedValueOnce(
        openAiError(400, {
          message: "Unsupported parameter: 'reasoning.effort' is not supported with this model.",
          type: "invalid_request_error",
          param: "reasoning.effort",
          code: "unsupported_parameter",
        }),
      )
      .mockResolvedValueOnce(openAiOk(QUIZ));

    const result = await askForQuiz();

    expect(result.data).toEqual(QUIZ);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = requestAt(1).body;
    expect(second).not.toHaveProperty("reasoning");
    expect(second).toMatchObject({ temperature: 0.2, max_output_tokens: 500 });
  });

  it("wraps a schema whose root is not an object and unwraps the answer", async () => {
    fetchMock.mockResolvedValueOnce(openAiOk({ result: ["sun", "water"] }));

    const result = await generateJson({
      task: "word list",
      system: "s",
      user: "u",
      schema: z.array(z.string()),
    });

    expect(result.data).toEqual(["sun", "water"]);
    const format = (requestAt(0).body.text as { format: Record<string, unknown> }).format;
    expect(format.name).toBe("word_list");
    expect(format.schema).toEqual({
      type: "object",
      properties: { result: { type: "array", items: { type: "string" } } },
      required: ["result"],
      additionalProperties: false,
    });
  });

  it("logs one line with the token usage and never the key", async () => {
    fetchMock.mockResolvedValueOnce(openAiOk(QUIZ));
    await askForQuiz();

    const lines = loggedLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      new RegExp(
        `^\\[ai\\] task=quiz provider=openai model=${DEFAULT_OPENAI_MODEL} ms=\\d+ result=ok tokens_in=120 tokens_out=45 tokens_reasoning=10$`,
      ),
    );
    expect(lines[0]).not.toContain(OPENAI_KEY);
  });
});

describe("generateJson with Gemini", () => {
  beforeEach(() => setEnv({ GEMINI_API_KEY: GEMINI_KEY }));

  it("sends a structured-output request and returns the validated data", async () => {
    fetchMock.mockResolvedValueOnce(geminiOk(QUIZ));

    const result = await askForQuiz();

    expect(result).toEqual({ data: QUIZ, provider: "gemini", model: DEFAULT_GEMINI_MODEL });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { url, headers, body } = requestAt(0);
    expect(url).toBe(GEMINI_URL);
    expect(url).not.toContain(GEMINI_KEY);
    expect(headers["x-goog-api-key"]).toBe(GEMINI_KEY);
    expect(body).toEqual({
      systemInstruction: { parts: [{ text: "You write short quizzes." }] },
      contents: [{ role: "user", parts: [{ text: "Write a quiz about plants." }] }],
      generationConfig: {
        responseFormat: {
          text: {
            mimeType: "application/json",
            schema: {
              type: "object",
              properties: {
                // minLength and maxLength are not supported, so they become a hint.
                title: { type: "string", description: "At most 80 characters." },
                items: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    properties: { question: { type: "string" }, hint: { type: "string" } },
                    required: ["question"],
                  },
                },
              },
              required: ["title", "items"],
            },
          },
        },
        // The caller's 500 plus room for hidden thinking.
        maxOutputTokens: 2_500,
        temperature: 0.2,
      },
    });
  });

  it("ignores thought parts and logs thinking tokens as output", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [{ text: "Let me think.", thought: true }, { text: JSON.stringify(QUIZ) }],
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 30, thoughtsTokenCount: 5 },
      }),
    );

    const result = await askForQuiz();

    expect(result.data).toEqual(QUIZ);
    expect(loggedLines()[0]).toContain("tokens_in=100 tokens_out=35 tokens_reasoning=5");
    expect(loggedLines()[0]).not.toContain(GEMINI_KEY);
  });

  it("falls back to the older field names if responseFormat is not known", async () => {
    fetchMock
      .mockResolvedValueOnce(
        geminiError(400, {
          message:
            'Invalid JSON payload received. Unknown name "responseFormat" at \'generation_config\': Cannot find field.',
          status: "INVALID_ARGUMENT",
        }),
      )
      .mockResolvedValueOnce(geminiOk(QUIZ));

    const result = await askForQuiz();

    expect(result.data).toEqual(QUIZ);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const config = requestAt(1).body.generationConfig as Record<string, unknown>;
    expect(config).not.toHaveProperty("responseFormat");
    expect(config.responseMimeType).toBe("application/json");
    expect(config.responseJsonSchema).toMatchObject({ type: "object", required: ["title", "items"] });
  });

  it("treats an answer cut off at the token limit as invalid output", async () => {
    const cutOff = () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ text: '{"title": "Pla' }] }, finishReason: "MAX_TOKENS" }],
      });
    fetchMock.mockResolvedValueOnce(cutOff()).mockResolvedValueOnce(cutOff());

    const error = await failure(askForQuiz());

    expect(error.code).toBe("invalid_output");
    expect(error.message).toContain("cut off");
  });
});

describe("retry on invalid output", () => {
  it("retries the same provider once when the answer is not JSON", async () => {
    setEnv({ OPENAI_API_KEY: OPENAI_KEY, GEMINI_API_KEY: GEMINI_KEY });
    fetchMock
      .mockResolvedValueOnce(openAiOk("Sure, here is your quiz."))
      .mockResolvedValueOnce(openAiOk(QUIZ));

    const result = await askForQuiz();

    expect(result.provider).toBe("openai");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestAt(1).url).toBe(OPENAI_URL);
    expect(loggedLines().map((line) => /result=(\w+)/.exec(line)?.[1])).toEqual([
      "invalid_output",
      "ok",
    ]);
  });

  it("retries when the JSON does not match the schema", async () => {
    setEnv({ GEMINI_API_KEY: GEMINI_KEY });
    fetchMock
      .mockResolvedValueOnce(geminiOk({ title: "Plants", items: [] }))
      .mockResolvedValueOnce(geminiOk(QUIZ));

    const result = await askForQuiz();

    expect(result.data).toEqual(QUIZ);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("accepts JSON wrapped in a code fence", async () => {
    setEnv({ GEMINI_API_KEY: GEMINI_KEY });
    fetchMock.mockResolvedValueOnce(geminiOk("```json\n" + JSON.stringify(QUIZ) + "\n```"));

    expect((await askForQuiz()).data).toEqual(QUIZ);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up with invalid_output after two bad answers and no fallback", async () => {
    setEnv({ OPENAI_API_KEY: OPENAI_KEY });
    fetchMock
      .mockResolvedValueOnce(openAiOk("not json"))
      .mockResolvedValueOnce(openAiOk({ title: 42 }));

    const error = await failure(askForQuiz());

    expect(error.code).toBe("invalid_output");
    expect(error.userMessage).toBe("The AI returned an answer we could not use. Please try again.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("moves to the fallback after two bad answers", async () => {
    setEnv({ OPENAI_API_KEY: OPENAI_KEY, GEMINI_API_KEY: GEMINI_KEY });
    fetchMock
      .mockResolvedValueOnce(openAiOk("not json"))
      .mockResolvedValueOnce(openAiOk("still not json"))
      .mockResolvedValueOnce(geminiOk(QUIZ));

    const result = await askForQuiz();

    expect(result).toEqual({ data: QUIZ, provider: "gemini", model: DEFAULT_GEMINI_MODEL });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestAt(2).url).toBe(GEMINI_URL);
  });

  it("treats a refusal and a cut-off OpenAI answer as invalid output", async () => {
    setEnv({ OPENAI_API_KEY: OPENAI_KEY });
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          status: "completed",
          output: [{ type: "message", content: [{ type: "refusal", refusal: "I cannot help." }] }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
          output: [],
          usage: { input_tokens: 50, output_tokens: 4_500 },
        }),
      );

    const error = await failure(askForQuiz());

    expect(error.code).toBe("invalid_output");
    expect(error.message).toContain("max_output_tokens");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Tokens spent on a wasted call are still logged.
    expect(loggedLines()[1]).toContain("result=invalid_output tokens_in=50 tokens_out=4500");
  });
});

describe("fallback from OpenAI to Gemini", () => {
  beforeEach(() => setEnv({ OPENAI_API_KEY: OPENAI_KEY, GEMINI_API_KEY: GEMINI_KEY }));

  it("goes straight to Gemini on a 500", async () => {
    fetchMock
      .mockResolvedValueOnce(
        openAiError(500, { message: "The server had an error.", type: "server_error" }),
      )
      .mockResolvedValueOnce(geminiOk(QUIZ));

    const result = await askForQuiz();

    expect(result).toEqual({ data: QUIZ, provider: "gemini", model: DEFAULT_GEMINI_MODEL });
    // One OpenAI call (no retry) and one Gemini call.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestAt(0).url).toBe(OPENAI_URL);
    expect(requestAt(1).url).toBe(GEMINI_URL);
  });

  it("goes straight to Gemini on a 429", async () => {
    fetchMock
      .mockResolvedValueOnce(
        openAiError(429, {
          message: "Rate limit reached for requests.",
          type: "rate_limit_error",
          code: "rate_limit_exceeded",
        }),
      )
      .mockResolvedValueOnce(geminiOk(QUIZ));

    const result = await askForQuiz();

    expect(result.provider).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(loggedLines().map((line) => /result=(\w+)/.exec(line)?.[1])).toEqual([
      "rate_limit",
      "ok",
    ]);
  });

  it("goes straight to Gemini when the network call fails", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(geminiOk(QUIZ));

    const result = await askForQuiz();

    expect(result.provider).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws the error of the last provider when both fail", async () => {
    fetchMock
      .mockResolvedValueOnce(openAiError(500, { message: "The server had an error." }))
      .mockResolvedValueOnce(
        geminiError(429, { message: "Resource has been exhausted.", status: "RESOURCE_EXHAUSTED" }),
      );

    const error = await failure(askForQuiz());

    expect(error.code).toBe("rate_limit");
    expect(error.message).toContain("Gemini");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not fall back when AI_PROVIDER forces one provider", async () => {
    setEnv({ AI_PROVIDER: "openai" });
    fetchMock.mockResolvedValueOnce(openAiError(500, { message: "The server had an error." }));

    const error = await failure(askForQuiz());

    expect(error.code).toBe("unknown");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("error mapping", () => {
  it.each([
    [401, { message: "Incorrect API key provided.", code: "invalid_api_key" }, "auth"],
    [403, { message: "Country, region, or territory not supported." }, "auth"],
    [429, { message: "Rate limit reached.", type: "rate_limit_error" }, "rate_limit"],
    [429, { message: "No credits.", type: "insufficient_quota", code: "credit_balance_exhausted" }, "rate_limit"],
    [400, { message: "Invalid schema for response_format.", type: "invalid_request_error" }, "unknown"],
    [404, { message: "The model does not exist.", code: "model_not_found" }, "unknown"],
    [500, { message: "The server had an error." }, "unknown"],
    [503, { message: "Overloaded.", code: "server_is_overloaded" }, "unknown"],
  ] as const)("maps OpenAI HTTP %i %o to %s", async (status, body, code) => {
    setEnv({ OPENAI_API_KEY: OPENAI_KEY });
    fetchMock.mockResolvedValueOnce(openAiError(status, body));

    const error = await failure(askForQuiz());

    expect(error.code).toBe(code);
    expect(error.userMessage.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [400, { message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" }, "auth"],
    [403, { message: "Permission denied.", status: "PERMISSION_DENIED" }, "auth"],
    [429, { message: "You exceeded your current quota.", status: "RESOURCE_EXHAUSTED" }, "rate_limit"],
    [400, { message: "Request contains an invalid argument.", status: "INVALID_ARGUMENT" }, "unknown"],
    [404, { message: "models/nope is not found.", status: "NOT_FOUND" }, "unknown"],
    [503, { message: "The model is overloaded.", status: "UNAVAILABLE" }, "unknown"],
  ] as const)("maps Gemini HTTP %i %o to %s", async (status, body, code) => {
    setEnv({ GEMINI_API_KEY: GEMINI_KEY });
    fetchMock.mockResolvedValueOnce(geminiError(status, body));

    const error = await failure(askForQuiz());

    expect(error.code).toBe(code);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a rejected fetch to network", async () => {
    setEnv({ OPENAI_API_KEY: OPENAI_KEY });
    fetchMock.mockRejectedValueOnce(
      new TypeError("fetch failed", { cause: Object.assign(new Error("dns"), { code: "ENOTFOUND" }) }),
    );

    const error = await failure(askForQuiz());

    expect(error.code).toBe("network");
    expect(error.message).toContain("ENOTFOUND");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps an error page that is not JSON to unknown", async () => {
    setEnv({ OPENAI_API_KEY: OPENAI_KEY });
    fetchMock.mockResolvedValueOnce(new Response("<html>Bad gateway</html>", { status: 502 }));

    const error = await failure(askForQuiz());

    expect(error.code).toBe("unknown");
    expect(error.message).toContain("502");
  });

  it("never puts the API key in an error or a log line", async () => {
    setEnv({ OPENAI_API_KEY: OPENAI_KEY, GEMINI_API_KEY: GEMINI_KEY });
    fetchMock
      .mockResolvedValueOnce(
        openAiError(500, { message: `Something broke while using ${OPENAI_KEY}.` }),
      )
      .mockResolvedValueOnce(
        geminiError(500, { message: `Internal error for key ${GEMINI_KEY}.`, status: "INTERNAL" }),
      );

    const error = await failure(askForQuiz());

    expect(error.code).toBe("unknown");
    expect(error.message).toContain("Internal error");
    for (const text of [error.message, error.userMessage, ...loggedLines()]) {
      expect(text).not.toContain(OPENAI_KEY);
      expect(text).not.toContain(GEMINI_KEY);
    }
  });

  it("keeps the provider's own message out of auth errors", async () => {
    setEnv({ OPENAI_API_KEY: OPENAI_KEY });
    fetchMock.mockResolvedValueOnce(
      openAiError(401, {
        message: "Incorrect API key provided: sk-test-*******-123.",
        type: "invalid_request_error",
        code: "invalid_api_key",
      }),
    );

    const error = await failure(askForQuiz());

    expect(error.code).toBe("auth");
    expect(error.message).not.toContain("sk-test");
    expect(error.message).toContain("401");
  });
});

describe("timeout", () => {
  /** A fetch that never answers and rejects only when its signal is aborted. */
  function hangingFetch(_input: unknown, init?: RequestInit): Promise<Response> {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("This operation was aborted", "AbortError"));
      });
    });
  }

  it("maps a call that takes longer than 45 seconds to timeout", async () => {
    vi.useFakeTimers();
    setEnv({ OPENAI_API_KEY: OPENAI_KEY });
    fetchMock.mockImplementation(hangingFetch);

    const pending = failure(askForQuiz());
    await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS - 1);
    expect(infoSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const error = await pending;

    expect(AI_TIMEOUT_MS).toBe(45_000);
    expect(error.code).toBe("timeout");
    expect(error.userMessage).toBe("The AI service took too long to answer. Please try again.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to Gemini after OpenAI times out", async () => {
    vi.useFakeTimers();
    setEnv({ OPENAI_API_KEY: OPENAI_KEY, GEMINI_API_KEY: GEMINI_KEY });
    fetchMock.mockImplementationOnce(hangingFetch).mockResolvedValueOnce(geminiOk(QUIZ));

    const pending = askForQuiz();
    await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS);
    const result = await pending;

    expect(result.provider).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up within 55 seconds in total, so a 60-second route limit is never hit", async () => {
    vi.useFakeTimers();
    setEnv({ OPENAI_API_KEY: OPENAI_KEY, GEMINI_API_KEY: GEMINI_KEY });
    fetchMock.mockImplementation(hangingFetch);

    const pending = failure(askForQuiz());
    // OpenAI gets its full 45 seconds; Gemini only what is left of the budget.
    await vi.advanceTimersByTimeAsync(AI_TOTAL_BUDGET_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(loggedLines()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    const error = await pending;

    expect(AI_TOTAL_BUDGET_MS).toBe(55_000);
    expect(error.code).toBe("timeout");
    expect(error.message).toContain("10 seconds");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not start another try once the time is used up", async () => {
    vi.useFakeTimers();
    setEnv({ OPENAI_API_KEY: OPENAI_KEY, GEMINI_API_KEY: GEMINI_KEY });
    // Two slow OpenAI answers that are not JSON, then Gemini would be next.
    fetchMock.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, AI_TIMEOUT_MS - 1_000));
      return openAiOk("not json");
    });
    fetchMock.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 9_000));
      return openAiOk("still not json");
    });

    const pending = failure(askForQuiz());
    await vi.advanceTimersByTimeAsync(AI_TOTAL_BUDGET_MS);
    const error = await pending;

    // The two OpenAI tries used 53 of the 55 seconds. Two seconds are not
    // enough for Gemini, so it is not called and the last error is reported.
    expect(error.code).toBe("invalid_output");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestAt(1).url).toBe(OPENAI_URL);
  });
});

describe("sample mode", () => {
  it("throws a plain Error, not an AiError, and calls nothing", async () => {
    setEnv({ AI_PROVIDER: "mock", OPENAI_API_KEY: OPENAI_KEY });

    const error: unknown = await askForQuiz().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AiError);
    expect((error as Error).message).toContain("sample mode");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("schema adapters", () => {
  const source = z.toJSONSchema(
    z.object({
      kind: z.literal("quiz"),
      level: z.enum(["easy", "hard"]).optional(),
      note: z.string().nullable(),
      choices: z.array(z.string()).min(2).max(4).nullable(),
      score: z.number().min(0).max(1).default(0),
    }),
    { io: "input" },
  ) as Record<string, unknown>;

  it("OpenAI: every field required, optional ones nullable, defaults removed", () => {
    const { schema, wrapped } = toOpenAiSchema(source);

    expect(wrapped).toBe(false);
    expect(schema).toEqual({
      type: "object",
      properties: {
        kind: { type: "string", const: "quiz" },
        level: { type: ["string", "null"], enum: ["easy", "hard"] },
        note: { type: ["string", "null"] },
        choices: {
          anyOf: [
            { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
            { type: "null" },
          ],
        },
        score: { type: ["number", "null"], minimum: 0, maximum: 1 },
      },
      required: ["kind", "level", "note", "choices", "score"],
      additionalProperties: false,
    });
  });

  it("Gemini: keeps only supported keywords and turns const into enum", () => {
    expect(toGeminiSchema(source)).toEqual({
      type: "object",
      properties: {
        kind: { type: "string", enum: ["quiz"] },
        level: { type: "string", enum: ["easy", "hard"] },
        note: { type: ["string", "null"] },
        choices: {
          anyOf: [
            { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
            { type: "null" },
          ],
        },
        score: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["kind", "note", "choices"],
    });
  });
});
