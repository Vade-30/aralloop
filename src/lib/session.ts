// Sign-in state. The cookie holds a random session token; the sessions table
// holds its hash and the user it belongs to. Signing out deletes the row, so
// a copied cookie stops working.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hashSessionToken, newSessionToken } from "./auth";
import { createSession, deleteSession, getSessionUser } from "./db/repo";
import type { Role, User } from "./types";

export const SESSION_COOKIE = "aralloop_session";

const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSessionUser(hashSessionToken(token));
}

/** Signs this browser in as the user. Call it only after checking who they are. */
export async function startSession(userId: string): Promise<void> {
  // Switching accounts: the session this browser had before is closed, so it
  // does not stay usable until it expires.
  const jar = await cookies();
  const old = jar.get(SESSION_COOKIE)?.value;
  if (old) await deleteSession(hashSessionToken(old));

  const token = newSessionToken();
  await createSession(
    userId,
    hashSessionToken(token),
    new Date(Date.now() + SEVEN_DAYS_IN_SECONDS * 1000),
  );
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Sent over https only on the hosted site; local development is http.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SEVEN_DAYS_IN_SECONDS,
  });
}

/** Signs this browser out. Harmless when nobody is signed in. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(hashSessionToken(token));
  jar.delete(SESSION_COOKIE);
}

/**
 * For pages: a visitor who is not signed in goes to the log-in page, and one
 * with another role goes to the first screen.
 */
export async function requireRole(role: Role): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect("/");
  return user;
}

/** Where each role lands after signing in. */
export const HOME_PATH: Record<Role, string> = {
  teacher: "/teacher",
  student: "/student",
  parent: "/parent",
};
