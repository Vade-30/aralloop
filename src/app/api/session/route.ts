// POST /api/session   — choose a sample account (the prototype's sign-in).
// DELETE /api/session — sign out.

import { cookies } from "next/headers";
import {
  sessionRequest,
  type OkResponse,
  type SessionResponse,
} from "@/lib/contracts";
import { getUser } from "@/lib/db/repo";
import { notFound, parseBody, route } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/session";

const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;

export const POST = route(async (request): Promise<SessionResponse> => {
  const { userId } = await parseBody(request, sessionRequest);
  const user = await getUser(userId);
  if (!user) throw notFound("That account");

  (await cookies()).set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SEVEN_DAYS_IN_SECONDS,
  });
  return { user };
});

export const DELETE = route(async (): Promise<OkResponse> => {
  (await cookies()).delete(SESSION_COOKIE);
  return { ok: true };
});
