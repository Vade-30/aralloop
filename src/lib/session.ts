// Prototype sign-in: the role picker stores the chosen sample user's id in a
// cookie. There are no passwords; see the documentation for what a real
// deployment would use instead.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "./db/repo";
import type { Role, User } from "./types";

export const SESSION_COOKIE = "aralloop_user";

export async function getCurrentUser(): Promise<User | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return getUser(id);
}

/** For pages: sends the visitor to the role picker unless they have this role. */
export async function requireRole(role: Role): Promise<User> {
  const user = await getCurrentUser();
  if (!user || user.role !== role) redirect("/");
  return user;
}

/** Where each role lands after choosing an account. */
export const HOME_PATH: Record<Role, string> = {
  teacher: "/teacher",
  student: "/student",
  parent: "/parent",
};
