// Chooses the AI provider from the environment and makes one structured-output
// call, falling back to the second provider if the first one fails.
//
//   OPENAI_API_KEY  -> OpenAI (first choice)
//   GEMINI_API_KEY  -> Google Gemini (first choice if no OpenAI key, else fallback)
//   neither         -> "mock": offline sample mode, handled by the task
//                      functions, which never call generateJson in that case
//   AI_PROVIDER     -> optional override: "openai" | "gemini" | "mock". A forced
//                      provider has no fallback; if its key is missing the
//                      result is "mock".
//   OPENAI_MODEL, GEMINI_MODEL -> optional model ids (defaults are in openai.ts
//                      and gemini.ts)
//
// This file owns everything the two providers share: the timeout, the retry
// and fallback order, JSON parsing, validation and the log line. openai.ts and
// gemini.ts only know how to build a request and read a response.

import { z } from "zod";
import type { AiProviderName, AiResult, AiStatus } from "../types";
import { AiError } from "./errors";
import { callGemini, DEFAULT_GEMINI_MODEL } from "./gemini";
import { callOpenAi, DEFAULT_OPENAI_MODEL } from "./openai";

export { DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL };

/** One provider gets this long to answer before the call counts as timed out. */
export const AI_TIMEOUT_MS = 45_000;

/** The first try plus one retry, and only when the output was unusable. */
const TRIES_PER_PROVIDER = 2;

// --- Shared with openai.ts and gemini.ts --------------------------------------

export type JsonSchema = { [key: string]: unknown };

export interface ProviderCall {
  task: string;
  system: string;
  user: string;
  /** Straight from zod; each provider adapts it to what its API accepts. */
  jsonSchema: JsonSchema;
  model: string;
  apiKey: string;
  /** Budget for the visible answer. Providers add room for hidden reasoning. */
  maxOutputTokens?: number;
  temperature?: number;
}

export interface TokenUsage {
  input: number | null;
  /** Everything billed as output, hidden reasoning included. */
  output: number | null;
  /** The hidden reasoning part of `output`. */
  reasoning: number | null;
}

export interface ProviderReply {
  /** The model's answer, expected to be JSON. Null when there is none to use. */
  text: string | null;
  /** Why there is no usable text (cut off, refused, blocked). */
  problem: string | null;
  usage: TokenUsage | null;
}

export interface HttpReply {
  status: number;
  /** The parsed body, or null if it was not JSON. */
  json: unknown;
  text: string;
}

/** POSTs JSON. Throws AiError "timeout" or "network"; never throws on a status. */
export type HttpSend = (request: {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}) => Promise<HttpReply>;

/** Throws AiError for HTTP-level failures; content problems go in the reply. */
export type ProviderAdapter = (
  call: ProviderCall,
  send: HttpSend,
) => Promise<ProviderReply>;

// --- Provider selection ------------------------------------------------------

type RealProvider = Exclude<AiProviderName, "mock">;

const PROVIDERS: Record<
  RealProvider,
  { keyVar: string; modelVar: string; defaultModel: string; call: ProviderAdapter }
> = {
  openai: {
    keyVar: "OPENAI_API_KEY",
    modelVar: "OPENAI_MODEL",
    defaultModel: DEFAULT_OPENAI_MODEL,
    call: callOpenAi,
  },
  gemini: {
    keyVar: "GEMINI_API_KEY",
    modelVar: "GEMINI_MODEL",
    defaultModel: DEFAULT_GEMINI_MODEL,
    call: callGemini,
  },
};

const MOCK_STATUS: AiStatus = { provider: "mock", model: "sample-mode", fallback: null };

/** Empty and whitespace-only values count as unset. */
function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function isRealProvider(name: string | null): name is RealProvider {
  return name === "openai" || name === "gemini";
}

function modelFor(provider: RealProvider): string {
  return env(PROVIDERS[provider].modelVar) ?? PROVIDERS[provider].defaultModel;
}

// Reads the environment on every call so that scripts and tests can switch
// providers without restarting.
export function getAiStatus(): AiStatus {
  const hasKey = (provider: RealProvider) => env(PROVIDERS[provider].keyVar) !== null;
  const override = env("AI_PROVIDER")?.toLowerCase() ?? null;

  if (override === "mock") return MOCK_STATUS;
  if (isRealProvider(override)) {
    return hasKey(override)
      ? { provider: override, model: modelFor(override), fallback: null }
      : MOCK_STATUS;
  }

  if (hasKey("openai")) {
    return {
      provider: "openai",
      model: modelFor("openai"),
      fallback: hasKey("gemini") ? "gemini" : null,
    };
  }
  if (hasKey("gemini")) {
    return { provider: "gemini", model: modelFor("gemini"), fallback: null };
  }
  return MOCK_STATUS;
}

// --- The call ----------------------------------------------------------------

export interface GenerateJsonOptions<T> {
  /** Short name for logs and for the provider's schema name, e.g. "activity". */
  task: string;
  system: string;
  user: string;
  /** The output is parsed and validated with this schema before returning. */
  schema: z.ZodType<T>;
  maxOutputTokens?: number;
  temperature?: number;
}

/**
 * Asks the model for JSON matching the schema. Retries once on invalid
 * output, then tries the fallback provider. Throws AiError when everything
 * failed. Must not be called when getAiStatus().provider is "mock".
 */
export async function generateJson<T>(
  options: GenerateJsonOptions<T>,
): Promise<AiResult<T>> {
  const status = getAiStatus();
  if (!isRealProvider(status.provider)) {
    throw new Error(
      "generateJson was called in sample mode. Check getAiStatus().provider first and return sample data when it is \"mock\".",
    );
  }

  // "input" because the model writes what schema.safeParse will read: fields
  // with a default stay optional, and transforms are described by their input.
  const jsonSchema = withLengthHints(
    z.toJSONSchema(options.schema, { io: "input", unrepresentable: "any" }),
  ) as JsonSchema;

  const order: RealProvider[] = [status.provider];
  if (isRealProvider(status.fallback)) order.push(status.fallback);

  let lastError = new AiError("unknown", "no provider was tried");
  for (const provider of order) {
    for (let attempt = 1; attempt <= TRIES_PER_PROVIDER; attempt++) {
      try {
        const data = await callOnce(provider, options, jsonSchema);
        return { data, provider, model: modelFor(provider) };
      } catch (error) {
        lastError = toAiError(error);
        // A second try can fix a badly shaped answer. It cannot fix a rejected
        // key, an empty balance or a dead connection, so those move on.
        if (lastError.code !== "invalid_output") break;
      }
    }
  }
  throw lastError;
}

async function callOnce<T>(
  provider: RealProvider,
  options: GenerateJsonOptions<T>,
  jsonSchema: JsonSchema,
): Promise<T> {
  const model = modelFor(provider);
  const apiKey = env(PROVIDERS[provider].keyVar) ?? "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const started = Date.now();
  let usage: TokenUsage | null = null;

  try {
    const reply = await PROVIDERS[provider].call(
      {
        task: options.task,
        system: options.system,
        user: options.user,
        jsonSchema,
        model,
        apiKey,
        maxOutputTokens: options.maxOutputTokens,
        temperature: options.temperature,
      },
      createSend(controller.signal, apiKey),
    );
    usage = reply.usage;
    if (reply.text === null) {
      throw new AiError("invalid_output", reply.problem ?? "the answer was empty");
    }
    const data = parseAndValidate(reply.text, options.schema, jsonSchema);
    logCall(options.task, provider, model, started, "ok", usage);
    return data;
  } catch (error) {
    const aiError = toAiError(error);
    logCall(options.task, provider, model, started, aiError.code, usage);
    throw aiError;
  } finally {
    clearTimeout(timer);
  }
}

function createSend(signal: AbortSignal, apiKey: string): HttpSend {
  return async ({ url, headers, body }) => {
    let status: number;
    let text: string;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal,
      });
      status = response.status;
      text = await response.text();
    } catch (error) {
      // Only our own timer aborts this signal.
      if (signal.aborted) {
        throw new AiError("timeout", `no answer after ${AI_TIMEOUT_MS / 1000} seconds`);
      }
      throw new AiError("network", describeFailure(error));
    }
    // Some services echo part of the request in error bodies. Remove the key
    // here so nothing built from the body can ever carry it.
    if (apiKey) text = text.split(apiKey).join("[key removed]");
    return { status, json: tryParseJson(text), text };
  };
}

function parseAndValidate<T>(text: string, schema: z.ZodType<T>, jsonSchema: JsonSchema): T {
  const raw = tryParseJson(stripCodeFence(text));
  if (raw === undefined) {
    throw new AiError("invalid_output", "the answer was not valid JSON");
  }
  dropNullOptionals(raw, jsonSchema, jsonSchema, 0);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new AiError("invalid_output", `the answer did not match the expected shape (${issues})`);
  }
  return parsed.data;
}

// --- Helpers -----------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Undefined means "not JSON" (JSON itself has no undefined). */
function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Structured output is plain JSON, but a model without it may wrap it in ```. */
function stripCodeFence(text: string): string {
  const match = /^\s*```[a-zA-Z]*\s*\n([\s\S]*?)\n?\s*```\s*$/.exec(text);
  return match ? match[1] : text.trim();
}

function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  return new AiError("unknown", error instanceof Error ? error.message : "unexpected failure");
}

function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return "the request failed";
  // Node puts the useful part (ENOTFOUND, ECONNRESET...) on the cause.
  const cause: unknown = error.cause;
  const code = isRecord(cause) && typeof cause.code === "string" ? ` (${cause.code})` : "";
  return `${error.message}${code}`;
}

/**
 * Both providers ignore or reject minLength and maxLength, so the limits are
 * also written into the description, where the model can read them.
 */
function withLengthHints(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withLengthHints);
  if (!isRecord(node)) return node;

  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) copy[key] = withLengthHints(value);

  const min = typeof node.minLength === "number" ? node.minLength : null;
  const max = typeof node.maxLength === "number" ? node.maxLength : null;
  let hint: string | null = null;
  if (min !== null && min > 1 && max !== null) hint = `Between ${min} and ${max} characters.`;
  else if (max !== null) hint = `At most ${max} characters.`;
  else if (min !== null && min > 1) hint = `At least ${min} characters.`;
  else if (min === 1) hint = "Must not be empty.";

  if (hint !== null) {
    const description = typeof node.description === "string" ? `${node.description} ` : "";
    copy.description = `${description}${hint}`;
  }
  return copy;
}

/**
 * OpenAI's strict mode has no optional fields: every field is required and an
 * absent one comes back as null. zod's .optional() rejects null, so nulls in
 * fields the original schema did not require are removed before validation.
 */
function dropNullOptionals(value: unknown, schema: unknown, root: JsonSchema, depth: number): void {
  if (!isRecord(schema) || depth > 50) return;

  if (typeof schema.$ref === "string") {
    const defs = root.$defs;
    const name = schema.$ref.replace(/^#\/\$defs\//, "");
    const target = schema.$ref === "#" ? root : isRecord(defs) ? defs[name] : undefined;
    dropNullOptionals(value, target, root, depth + 1);
    return;
  }
  for (const keyword of ["anyOf", "oneOf", "allOf"]) {
    const branches = schema[keyword];
    if (!Array.isArray(branches)) continue;
    for (const branch of branches) dropNullOptionals(value, branch, root, depth + 1);
  }

  if (Array.isArray(value)) {
    for (const element of value) dropNullOptionals(element, schema.items, root, depth + 1);
    return;
  }
  if (!isRecord(value) || !isRecord(schema.properties)) return;

  const required: unknown[] = Array.isArray(schema.required) ? schema.required : [];
  for (const [key, child] of Object.entries(schema.properties)) {
    if (value[key] === null && !required.includes(key)) delete value[key];
    else dropNullOptionals(value[key], child, root, depth + 1);
  }
}

// One line per provider call, so the team can add up real token use and cost.
// It never includes the prompt, the answer or the key.
function logCall(
  task: string,
  provider: RealProvider,
  model: string,
  started: number,
  result: string,
  usage: TokenUsage | null,
): void {
  const parts = [
    `task=${task}`,
    `provider=${provider}`,
    `model=${model}`,
    `ms=${Date.now() - started}`,
    `result=${result}`,
  ];
  if (usage) {
    if (usage.input !== null) parts.push(`tokens_in=${usage.input}`);
    if (usage.output !== null) parts.push(`tokens_out=${usage.output}`);
    if (usage.reasoning !== null) parts.push(`tokens_reasoning=${usage.reasoning}`);
  }
  console.info(`[ai] ${parts.join(" ")}`);
}
