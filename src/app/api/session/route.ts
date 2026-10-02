// POST /api/session   — open one of the sample accounts. They have no
//                       password, so this works for the sample class only.
// DELETE /api/session — sign out.

import {
  sessionRequest,
  type OkResponse,
  type SessionResponse,
} from "@/lib/contracts";
import { getUser } from "@/lib/db/repo";
import { SEED_IDS } from "@/lib/db/seed";
import { notFound, parseBody, route } from "@/lib/http";
import { endSession, startSession } from "@/lib/session";

export const POST = route(async (request): Promise<SessionResponse> => {
  const { userId } = await parseBody(request, sessionRequest);
  const user = await getUser(userId);
  // An account made by signing up is reported as missing, the same as an id
  // that does not exist, so this route cannot be used to find or open one.
  if (!user || user.classId !== SEED_IDS.classId) throw notFound("That account");

  await startSession(user.id);
  return { user };
});

export const DELETE = route(async (): Promise<OkResponse> => {
  await endSession();
  return { ok: true };
});
