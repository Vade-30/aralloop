// POST /api/auth/login — sign in with an email and a password.

import { verifyPassword } from "@/lib/auth";
import { loginRequest, type SessionResponse } from "@/lib/contracts";
import { getUserWithPassword } from "@/lib/db/repo";
import { ApiError, parseBody, route } from "@/lib/http";
import { startSession } from "@/lib/session";

export const POST = route(async (request): Promise<SessionResponse> => {
  const { email, password } = await parseBody(request, loginRequest);
  const found = await getUserWithPassword(email);
  // One message for an unknown email and for a wrong password, so the answer
  // does not tell a stranger which emails have an account.
  if (!found || !(await verifyPassword(password, found.passwordHash))) {
    throw new ApiError(401, "invalid_credentials", "Wrong email or password.");
  }

  await startSession(found.user.id);
  return { user: found.user };
});
