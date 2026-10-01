// OpenAI adapter: one Responses API call with strict structured output, sent
// with plain fetch (no SDK). provider.ts owns the timeout, retries and logging.
//
// Request and response shapes follow the official docs as read on 2026-10-02:
//   POST https://api.openai.com/v1/responses
//   Structured output goes in text.format ({ type: "json_schema", name,
//   schema, strict: true }), not in response_format (that was Chat Completions).
//
// Optional: OPENAI_REASONING_EFFORT (default "low"). Set it to "none" for the
// fastest and cheapest calls; only then does the API accept a temperature.

import { AiError, isTransientStatus, type AiErrorCode } from "./errors";
import type {
  HttpReply,
  HttpSend,
  JsonSchema,
  ProviderCall,
  ProviderReply,
  TokenUsage,
} from "./provider";

// Checked 2026-10-02 on developers.openai.com/api/docs/models: gpt-6-luna is the
// current low-cost general model ($0.10 in, $0.50 out per million tokens) and
// supports structured outputs. Change it here or set OPENAI_MODEL.
export const DEFAULT_OPENAI_MODEL = "gpt-6-luna";

const ENDPOINT = "https://api.openai.com/v1/responses";

// gpt-6-luna reasons before it answers ("medium" if nothing is sent). "low"
// keeps calls fast and cheap. Reasoning tokens are hidden, billed as output and
// count against max_output_tokens.
const DEFAULT_REASONING_EFFORT = "low";

// Added to the caller's budget so hidden reasoning cannot use up the room meant
// for the answer. Unused room costs nothing.
const REASONING_HEADROOM_TOKENS = 4_000;

/** Optional settings that some models reject; each can be dropped once. */
interface Extras {
  reasoning: boolean;
  temperature: boolean;
}

export async function callOpenAi(call: ProviderCall, send: HttpSend): Promise<ProviderReply> {
  const { schema, wrapped } = toOpenAiSchema(call.jsonSchema);
  const extras: Extras = { reasoning: true, temperature: true };

  let reply: HttpReply;
  for (;;) {
    reply = await send({
      url: ENDPOINT,
      headers: { Authorization: `Bearer ${call.apiKey}` },
      body: buildBody(call, schema, extras),
    });
    // An older model set through OPENAI_MODEL may not accept one of the
    // extras. Drop the one the error names and ask again.
    const rejected = reply.status === 400 ? rejectedExtra(reply.json) : null;
    if (rejected === null || !extras[rejected]) break;
    extras[rejected] = false;
  }

  if (reply.status < 200 || reply.status >= 300) throw httpError(reply);
  return readReply(reply.json, wrapped);
}

function reasoningEffort(): string {
  return process.env.OPENAI_REASONING_EFFORT?.trim().toLowerCase() || DEFAULT_REASONING_EFFORT;
}

function buildBody(call: ProviderCall, schema: JsonSchema, extras: Extras): JsonSchema {
  const effort = reasoningEffort();
  // Not tied to extras.reasoning: when the API rejected the setting and it was
  // dropped, the model still reasons at its own default and needs the room.
  const reasons = effort !== "none";

  const body: JsonSchema = {
    model: call.model,
    instructions: call.system,
    input: call.user,
    text: {
      format: { type: "json_schema", name: schemaName(call.task), schema, strict: true },
    },
    // Lessons and answers have no reason to be kept on OpenAI's side.
    store: false,
  };
  if (extras.reasoning) body.reasoning = { effort };
  if (call.maxOutputTokens !== undefined) {
    body.max_output_tokens = call.maxOutputTokens + (reasons ? REASONING_HEADROOM_TOKENS : 0);
  }
  // The docs say to remove temperature unless reasoning effort is "none".
  if (extras.temperature && call.temperature !== undefined && !reasons) {
    body.temperature = call.temperature;
  }
  return body;
}

/** The API allows letters, digits, "_" and "-", up to 64 characters. */
function schemaName(task: string): string {
  return task.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "result";
}

function rejectedExtra(json: unknown): keyof Extras | null {
  const error = isRecord(json) && isRecord(json.error) ? json.error : null;
  if (!error) return null;
  // error.param names the setting ("reasoning.effort", "temperature"). The
  // message is only a backup, and only when it is about an unsupported setting,
  // so a schema field that happens to be called "temperature" does not match.
  const param = asString(error.param).toLowerCase();
  const message = asString(error.message).toLowerCase();
  const where = param || (message.includes("unsupported") ? message : "");
  if (where.includes("reasoning")) return "reasoning";
  if (where.includes("temperature")) return "temperature";
  return null;
}

// --- Schema ------------------------------------------------------------------

// Strict mode accepts a subset of JSON Schema. These keywords are either not in
// the supported list or are listed as unsupported; sending them is an error.
// zod still enforces all of them when the answer is validated.
const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "$id",
  "default",
  "examples",
  "minLength",
  "maxLength",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "propertyNames",
  "patternProperties",
  "contentEncoding",
  "contentMediaType",
  "not",
  "if",
  "then",
  "else",
  "dependentRequired",
  "dependentSchemas",
]);

/**
 * Adapts a zod JSON Schema to strict mode: every object lists all its fields
 * as required and sets additionalProperties to false; fields that were
 * optional become nullable instead. The root must be an object, so any other
 * root is wrapped in { result: ... } and unwrapped when the answer is read.
 *
 * Not expressible in strict mode, so avoid in task schemas: z.record,
 * z.tuple and z.intersection.
 */
export function toOpenAiSchema(source: JsonSchema): { schema: JsonSchema; wrapped: boolean } {
  const schema = adapt(source);
  if (schema.type === "object" && isRecord(schema.properties)) {
    return { schema, wrapped: false };
  }
  // Definitions are looked up from the root, so they move up with it.
  const { $defs, ...inner } = schema;
  const wrapper: JsonSchema = {
    type: "object",
    properties: { result: inner },
    required: ["result"],
    additionalProperties: false,
  };
  if ($defs !== undefined) wrapper.$defs = $defs;
  return { schema: wrapper, wrapped: true };
}

function adapt(source: JsonSchema): JsonSchema {
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(source)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    switch (key) {
      case "properties":
      case "$defs":
        out[key] = isRecord(value) ? mapValues(value, adaptChild) : value;
        break;
      case "items":
      case "additionalProperties":
        out[key] = adaptChild(value);
        break;
      case "anyOf":
      case "prefixItems":
        out[key] = Array.isArray(value) ? value.map(adaptChild) : value;
        break;
      case "oneOf":
        // Not supported; anyOf is, and zod validates the answer either way.
        out.anyOf = Array.isArray(value) ? value.map(adaptChild) : value;
        break;
      default:
        out[key] = value;
    }
  }

  // zod sends both for emails and dates; its patterns use regex features the
  // API may not accept, and the format already says what is wanted.
  if ("format" in out) delete out.pattern;

  const properties = out.properties;
  if (isRecord(properties)) {
    const wasRequired: unknown[] = Array.isArray(source.required) ? source.required : [];
    const names = Object.keys(properties);
    for (const name of names) {
      if (!wasRequired.includes(name)) properties[name] = nullable(properties[name]);
    }
    out.required = names;
    out.additionalProperties = false;
  } else if (out.type === "object" && !isRecord(out.additionalProperties)) {
    out.properties = {};
    out.required = [];
    out.additionalProperties = false;
  }
  return out;
}

function adaptChild(value: unknown): unknown {
  return isRecord(value) ? adapt(value) : value;
}

/** The documented way to express "optional" in strict mode: allow null. */
function nullable(schema: unknown): unknown {
  if (!isRecord(schema)) return schema;
  const type = schema.type;
  if (typeof type === "string" && !("const" in schema)) {
    return type === "null" ? schema : { ...schema, type: [type, "null"] };
  }
  if (Array.isArray(type)) {
    return type.includes("null") ? schema : { ...schema, type: [...type, "null"] };
  }
  if (Array.isArray(schema.anyOf)) {
    const hasNull = schema.anyOf.some((branch) => isRecord(branch) && branch.type === "null");
    return hasNull ? schema : { ...schema, anyOf: [...schema.anyOf, { type: "null" }] };
  }
  return { anyOf: [schema, { type: "null" }] };
}

// --- Response ----------------------------------------------------------------

function readReply(json: unknown, wrapped: boolean): ProviderReply {
  if (!isRecord(json)) {
    return { text: null, problem: "the response body was not JSON", usage: null };
  }
  const usage = readUsage(json.usage);

  if (json.status === "failed") {
    const message = isRecord(json.error) ? asString(json.error.message) : "";
    throw new AiError("unknown", `the response failed${message ? `: ${shorten(message)}` : ""}`);
  }

  let text = "";
  let refused = false;
  for (const item of asArray(json.output)) {
    if (!isRecord(item) || item.type !== "message") continue;
    for (const part of asArray(item.content)) {
      if (!isRecord(part)) continue;
      if (part.type === "output_text" && typeof part.text === "string") text += part.text;
      if (part.type === "refusal") refused = true;
    }
  }

  if (json.status === "incomplete") {
    const reason = isRecord(json.incomplete_details)
      ? asString(json.incomplete_details.reason)
      : "";
    return { text: null, problem: `the answer was cut off (${reason || "incomplete"})`, usage };
  }
  if (refused) return { text: null, problem: "the model declined to answer", usage };
  if (text === "") return { text: null, problem: "the answer was empty", usage };
  return { text: wrapped ? unwrap(text) : text, problem: null, usage };
}

/** Undoes the { result: ... } wrapper added for schemas whose root is not an object. */
function unwrap(text: string): string {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) && "result" in parsed ? JSON.stringify(parsed.result) : text;
  } catch {
    return text;
  }
}

function readUsage(usage: unknown): TokenUsage | null {
  if (!isRecord(usage)) return null;
  const details = usage.output_tokens_details;
  return {
    input: asNumber(usage.input_tokens),
    output: asNumber(usage.output_tokens),
    reasoning: isRecord(details) ? asNumber(details.reasoning_tokens) : null,
  };
}

// --- Errors ------------------------------------------------------------------

// Billing and spend-limit errors arrive as 429 too, with codes such as
// credit_balance_exhausted or project_spend_limit_exceeded.
const QUOTA_PATTERN = /quota|rate_limit|credit|spend_limit|usage_limit|slow_down/;

// The ones among them that waiting does not fix: the account has no credit left
// or has reached a limit it set itself. Asking again would only fail again.
const BILLING_PATTERN = /quota|credit|spend_limit|usage_limit|billing/;

function httpError(reply: HttpReply): AiError {
  const error = isRecord(reply.json) && isRecord(reply.json.error) ? reply.json.error : null;
  const kind = `${asString(error?.type)} ${asString(error?.code)}`.trim();

  let code: AiErrorCode = "unknown";
  if (reply.status === 401 || reply.status === 403) code = "auth";
  else if (reply.status === 429 || QUOTA_PATTERN.test(kind)) code = "rate_limit";

  // OpenAI repeats part of the key in its "incorrect key" message, so auth
  // errors carry the status and error code only.
  if (code === "auth") {
    return new AiError(code, `OpenAI HTTP ${reply.status}${kind ? ` (${kind})` : ""}`);
  }
  const message = asString(error?.message) || reply.text;
  return new AiError(
    code,
    `OpenAI HTTP ${reply.status}: ${shorten(message)}`,
    isTransientStatus(reply.status) && !BILLING_PATTERN.test(kind),
  );
}

// --- Helpers -----------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapValues(
  record: Record<string, unknown>,
  fn: (value: unknown) => unknown,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, fn(value)]));
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function shorten(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 300 ? `${oneLine.slice(0, 300)}...` : oneLine;
}
