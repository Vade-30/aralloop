// Google Gemini adapter: one generateContent call with structured JSON output,
// sent with plain fetch (no SDK). provider.ts owns the timeout, retries and
// logging.
//
// Request and response shapes follow the official docs as read on 2026-10-02:
//   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
//   The key goes in the x-goog-api-key header, never in the URL.
//   Structured output goes in generationConfig.responseFormat.text
//   ({ mimeType: "application/json", schema }). The older responseMimeType +
//   responseJsonSchema pair is marked deprecated but is kept here as a second
//   try, in case a model or API version does not know responseFormat yet.

import { AiError, isTransientStatus, type AiErrorCode } from "./errors";
import type {
  HttpReply,
  HttpSend,
  JsonSchema,
  ProviderCall,
  ProviderReply,
  TokenUsage,
} from "./provider";

// Checked 2026-10-02 on ai.google.dev/gemini-api/docs/models and /pricing:
// gemini-3.5-flash-lite is the current stable low-cost model with a free tier
// ($0.30 in, $2.50 out per million tokens on the paid tier) and supports
// structured outputs. The cheaper 2.5 models are closed to new users and
// gemini-3.1-flash-lite shuts down in May 2027. Change it here or set
// GEMINI_MODEL.
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// maxOutputTokens covers hidden thinking tokens as well as the answer. The
// default model thinks very little, but a larger one set through GEMINI_MODEL
// may think more, so the caller's budget gets some room on top.
const THINKING_HEADROOM_TOKENS = 2_000;

export async function callGemini(call: ProviderCall, send: HttpSend): Promise<ProviderReply> {
  const model = call.model.replace(/^models\//, "");
  const request = (legacyFields: boolean) =>
    send({
      url: `${BASE_URL}/${encodeURIComponent(model)}:generateContent`,
      headers: { "x-goog-api-key": call.apiKey },
      body: buildBody(call, legacyFields),
    });

  let reply = await request(false);
  if (reply.status === 400 && rejectsResponseFormat(reply)) reply = await request(true);

  if (reply.status < 200 || reply.status >= 300) throw httpError(reply);
  return readReply(reply.json);
}

function buildBody(call: ProviderCall, legacyFields: boolean): JsonSchema {
  const schema = toGeminiSchema(call.jsonSchema);
  const generationConfig: JsonSchema = legacyFields
    ? { responseMimeType: "application/json", responseJsonSchema: schema }
    : { responseFormat: { text: { mimeType: "application/json", schema } } };

  if (call.maxOutputTokens !== undefined) {
    generationConfig.maxOutputTokens = call.maxOutputTokens + THINKING_HEADROOM_TOKENS;
  }
  // Google's Gemini 3 guide says to keep the temperature at its default (1.0):
  // a lower value can make these models loop or answer worse. Only an older
  // model set through GEMINI_MODEL gets the caller's value.
  if (call.temperature !== undefined && acceptsTemperature(call.model)) {
    generationConfig.temperature = call.temperature;
  }

  const parts: JsonSchema[] = [{ text: call.user }];
  for (const image of call.images ?? []) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
  }

  return {
    systemInstruction: { parts: [{ text: call.system }] },
    contents: [{ role: "user", parts }],
    generationConfig,
  };
}

/**
 * True only for the Gemini 1.x and 2.x families ("gemini-2.5-flash"). Gemini 3
 * models, aliases such as "gemini-flash-latest" and names not known here keep
 * the model's default temperature.
 */
function acceptsTemperature(model: string): boolean {
  return /^gemini-[12][.-]/.test(model.replace(/^models\//, ""));
}

/** True for the "unknown field" error an API without responseFormat would give. */
function rejectsResponseFormat(reply: HttpReply): boolean {
  return /responseFormat|response_format|mimeType|mime_type/.test(errorMessage(reply));
}

// --- Schema ------------------------------------------------------------------

// The keywords the API documents as supported. Everything else is removed;
// zod still enforces the full schema when the answer is validated.
const SUPPORTED_KEYWORDS = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

const SUPPORTED_FORMATS = new Set(["date-time", "date", "time"]);

/** Reduces a zod JSON Schema to the subset Gemini's structured output accepts. */
export function toGeminiSchema(source: JsonSchema): JsonSchema {
  // Next to $ref only other $-keywords are allowed.
  const hasRef = typeof source.$ref === "string";

  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "const") {
      // A fixed value is the same as an enum with one entry.
      if (!hasRef) out.enum = [value];
      continue;
    }
    if (!SUPPORTED_KEYWORDS.has(key) || (hasRef && !key.startsWith("$"))) continue;
    switch (key) {
      case "properties":
      case "$defs":
        out[key] = isRecord(value)
          ? Object.fromEntries(Object.entries(value).map(([name, child]) => [name, adaptChild(child)]))
          : value;
        break;
      case "items":
      case "additionalProperties":
        out[key] = adaptChild(value);
        break;
      case "anyOf":
      case "oneOf":
      case "prefixItems":
        out[key] = Array.isArray(value) ? value.map(adaptChild) : value;
        break;
      case "format":
        if (typeof value === "string" && SUPPORTED_FORMATS.has(value)) out[key] = value;
        break;
      default:
        out[key] = value;
    }
  }
  return out;
}

function adaptChild(value: unknown): unknown {
  return isRecord(value) ? toGeminiSchema(value) : value;
}

// --- Response ----------------------------------------------------------------

function readReply(json: unknown): ProviderReply {
  if (!isRecord(json)) {
    return { text: null, problem: "the response body was not JSON", usage: null };
  }
  const usage = readUsage(json.usageMetadata);

  const blockReason = isRecord(json.promptFeedback) ? asString(json.promptFeedback.blockReason) : "";
  if (blockReason) {
    return { text: null, problem: `the request was blocked (${blockReason})`, usage };
  }

  const candidate = Array.isArray(json.candidates) ? json.candidates[0] : undefined;
  const finishReason = isRecord(candidate) ? asString(candidate.finishReason) : "";
  const content = isRecord(candidate) ? candidate.content : undefined;
  const parts = isRecord(content) && Array.isArray(content.parts) ? content.parts : [];

  let text = "";
  for (const part of parts) {
    // Thought parts are the model's notes, not the answer.
    if (isRecord(part) && typeof part.text === "string" && part.thought !== true) text += part.text;
  }

  if (finishReason === "MAX_TOKENS") {
    return { text: null, problem: "the answer was cut off (MAX_TOKENS)", usage };
  }
  if (text === "") {
    const why = finishReason ? ` (${finishReason})` : "";
    return { text: null, problem: `the answer was empty${why}`, usage };
  }
  return { text, problem: null, usage };
}

function readUsage(usage: unknown): TokenUsage | null {
  if (!isRecord(usage)) return null;
  const answer = asNumber(usage.candidatesTokenCount);
  const thoughts = asNumber(usage.thoughtsTokenCount);
  return {
    input: asNumber(usage.promptTokenCount),
    // Gemini reports thinking tokens separately; both are billed as output.
    output: answer === null && thoughts === null ? null : (answer ?? 0) + (thoughts ?? 0),
    reasoning: thoughts,
  };
}

// --- Errors ------------------------------------------------------------------

function errorBody(reply: HttpReply): Record<string, unknown> | null {
  return isRecord(reply.json) && isRecord(reply.json.error) ? reply.json.error : null;
}

function errorMessage(reply: HttpReply): string {
  return asString(errorBody(reply)?.message) || reply.text;
}

function httpError(reply: HttpReply): AiError {
  const status = asString(errorBody(reply)?.status);
  const message = errorMessage(reply);

  let code: AiErrorCode = "unknown";
  if (
    reply.status === 401 ||
    reply.status === 403 ||
    status === "UNAUTHENTICATED" ||
    status === "PERMISSION_DENIED" ||
    // A wrong key comes back as 400 INVALID_ARGUMENT, "API key not valid".
    (reply.status === 400 && /api[ _]key/i.test(message))
  ) {
    code = "auth";
  } else if (reply.status === 429 || status === "RESOURCE_EXHAUSTED" || /quota/i.test(message)) {
    code = "rate_limit";
  }

  if (code === "auth") {
    return new AiError(code, `Gemini HTTP ${reply.status}${status ? ` (${status})` : ""}`);
  }
  return new AiError(
    code,
    `Gemini HTTP ${reply.status}: ${shorten(message)}`,
    isTransientStatus(reply.status),
  );
}

// --- Helpers -----------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
