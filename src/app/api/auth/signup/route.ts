// POST /api/auth/signup — create an account and sign in.
//
// A teacher starts a new class. A student joins a class with its join code. A
// parent joins with the join code and the email of their child's account.
// The email is not verified.

import { hashPassword } from "@/lib/auth";
import { signupRequest, type SessionResponse } from "@/lib/contracts";
import {
  EmailTakenError,
  createMember,
  createTeacherWithClass,
  getClassByJoinCode,
  getUserWithPassword,
} from "@/lib/db/repo";
import { SEED_IDS } from "@/lib/db/seed";
import { badRequest, conflict, parseBody, route } from "@/lib/http";
import { startSession } from "@/lib/session";
import type { SchoolClass, User } from "@/lib/types";

const EMAIL_TAKEN = "An account with this email already exists. Log in instead.";

/** The class a student or parent is joining. The sample class cannot be joined. */
async function classToJoin(joinCode: string): Promise<SchoolClass> {
  const schoolClass = await getClassByJoinCode(joinCode);
  if (!schoolClass || schoolClass.id === SEED_IDS.classId) {
    throw badRequest("No class has this join code. Ask the teacher for the code.");
  }
  return schoolClass;
}

export const POST = route(async (request): Promise<SessionResponse> => {
  const body = await parseBody(request, signupRequest);
  if (await getUserWithPassword(body.email)) throw conflict(EMAIL_TAKEN);

  const account = { name: body.name, email: body.email };
  let user: User;
  try {
    if (body.role === "teacher") {
      user = await createTeacherWithClass({
        ...account,
        passwordHash: await hashPassword(body.password),
        className: body.className,
        gradeLevel: body.gradeLevel,
        subject: body.subject,
      });
    } else {
      const schoolClass = await classToJoin(body.joinCode);
      let childId: string | null = null;
      if (body.role === "parent") {
        const child = (await getUserWithPassword(body.childEmail))?.user;
        if (!child || child.role !== "student" || child.classId !== schoolClass.id) {
          throw badRequest(
            "No student in this class has that email. Your child needs to sign up first.",
          );
        }
        childId = child.id;
      }
      user = await createMember({
        ...account,
        passwordHash: await hashPassword(body.password),
        role: body.role,
        classId: schoolClass.id,
        childId,
      });
    }
  } catch (error) {
    // Two sign-ups with the same email at the same moment: the second loses.
    if (error instanceof EmailTakenError) throw conflict(EMAIL_TAKEN);
    throw error;
  }

  await startSession(user.id);
  return { user };
});
