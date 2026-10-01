// Server-side helpers for route handlers. Usage:
//
//   export const POST = route(async (request) => {
//     const user = await requireUser("teacher");
//     const body = await parseBody(request, createLessonRequest);
//     ...
//     return { lesson };            // sent as JSON with status 200
//   });
//
// Anything thrown becomes an ApiErrorBody response: ApiError keeps its status
// and message, AiError maps to 503, everything else to a generic 500.

import { NextResponse } from "next/server";
import type { z } from "zod";
import { AiError } from "./ai/errors";
import type { ApiErrorBody } from "./contracts";
import { getCurrentUser } from "./session";
import type { Role, User } from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string) =>
  new ApiError(400, "validation", message);
export const notFound = (what: string) =>
  new ApiError(404, "not_found", `${what} was not found.`);
export const forbidden = (message = "You are not allowed to do this.") =>
  new ApiError(403, "forbidden", message);
export const conflict = (message: string) => new ApiError(409, "conflict", message);

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}

/** Wraps a handler: JSON-encodes its result and turns thrown errors into responses. */
export function route<Context>(
  handler: (request: Request, context: Context) => Promise<object>,
) {
  return async (request: Request, context: Context): Promise<Response> => {
    try {
      return NextResponse.json(await handler(request, context));
    } catch (error) {
      if (error instanceof ApiError) {
        return errorResponse(error.status, error.code, error.message);
      }
      if (error instanceof AiError) {
        console.error("[ai]", error.message);
        return errorResponse(503, `ai_${error.code}`, error.userMessage);
      }
      console.error("[api]", error);
      return errorResponse(
        500,
        "internal",
        "Something went wrong on our side. Please try again.",
      );
    }
  };
}

/** The signed-in user, or a 401/403 ApiError. Pass roles to restrict. */
export async function requireUser(...roles: Role[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError(401, "unauthenticated", "Choose an account first.");
  }
  if (roles.length > 0 && !roles.includes(user.role)) throw forbidden();
  return user;
}

/** Reads and validates a JSON body; the first problem becomes a 400. */
export async function parseBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<z.output<Schema>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("The request body is not valid JSON.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join(".");
    throw badRequest(field ? `${field}: ${issue.message}` : issue.message);
  }
  return result.data;
}
