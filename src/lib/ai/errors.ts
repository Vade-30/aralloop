export type AiErrorCode =
  | "auth" // key rejected
  | "rate_limit" // quota or rate limit reached
  | "timeout"
  | "network"
  | "invalid_output" // the model's answer did not match the expected shape
  | "unknown";

const USER_MESSAGES: Record<AiErrorCode, string> = {
  auth: "The AI service rejected the API key. Check the key in .env.local.",
  rate_limit:
    "The AI service is busy or the credit limit was reached. Wait a moment and try again.",
  timeout: "The AI service took too long to answer. Please try again.",
  network: "Could not reach the AI service. Check the internet connection and try again.",
  invalid_output: "The AI returned an answer we could not use. Please try again.",
  unknown: "The AI service returned an unexpected error. Please try again.",
};

/** Thrown by the AI layer when every configured provider has failed. */
export class AiError extends Error {
  readonly code: AiErrorCode;
  /** Safe to show to the user. */
  readonly userMessage: string;

  constructor(code: AiErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "AiError";
    this.code = code;
    this.userMessage = USER_MESSAGES[code];
  }
}
