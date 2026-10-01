// Browser-side fetch wrapper for the API routes in src/app/api.
//
//   const { lesson } = await api<CreateLessonResponse>("/api/lessons", {
//     method: "POST",
//     body: { title, content },
//   });
//
// Rejects with ClientApiError, whose message is safe to show to the user.

import type { ApiErrorBody } from "./contracts";

export class ClientApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

export async function api<Result>(
  path: string,
  options: { method?: string; body?: unknown; formData?: FormData } = {},
): Promise<Result> {
  const { method = "GET", body, formData } = options;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch {
    throw new ClientApiError(
      0,
      "network",
      "Could not reach the server. Check your connection and try again.",
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (payload as ApiErrorBody | null)?.error;
    throw new ClientApiError(
      response.status,
      error?.code ?? "unknown",
      error?.message ?? "Something went wrong. Please try again.",
    );
  }
  return payload as Result;
}

/** The message to show for anything caught around an api() call. */
export function errorMessage(error: unknown): string {
  return error instanceof ClientApiError
    ? error.message
    : "Something went wrong. Please try again.";
}
