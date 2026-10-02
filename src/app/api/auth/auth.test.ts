// Sign-up, log-in and sessions, run against the seeded in-memory database with
// only the cookie store replaced. The tests share one database and one cookie
// jar and run in file order: a teacher signs up, a student and a parent join
// the class, then everyone logs in and out.

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("REDIRECT");
  },
}));

import { hashPassword, hashSessionToken, newJoinCode, verifyPassword } from "@/lib/auth";
import type { ApiErrorBody, SessionResponse } from "@/lib/contracts";
import { PASSWORD_RULES } from "@/lib/contracts";
import { closeDb, query } from "@/lib/db/client";
import { getClass, listUsers } from "@/lib/db/repo";
import { SEED_IDS } from "@/lib/db/seed";
import { SESSION_COOKIE, getCurrentUser } from "@/lib/session";
import { POST as resetRoute } from "../demo/reset/route";
import { DELETE as signOutRoute } from "../session/route";
import { POST as loginRoute } from "./login/route";
import { POST as signupRoute } from "./signup/route";

type Handler = (request: Request, context: never) => Promise<Response>;

/** Calls a route with the cookies the earlier calls left in the jar. */
async function call(handler: Handler, body?: unknown, method = "POST") {
  const request = new Request("http://aralloop.test/api", {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handler(request, {} as never);
  const parsed = (await response.json()) as Partial<SessionResponse> & Partial<ApiErrorBody>;
  return { status: response.status, user: parsed.user, error: parsed.error };
}

const teacher = {
  role: "teacher",
  name: "Ms. Ana Lim",
  email: "ana@example.com",
  password: "magandang8",
  className: "Grade 8 - Rosal",
  gradeLevel: "Grade 8",
  subject: "Science",
};

/** Set by the teacher's sign-up and used by everyone who joins the class. */
let joinCode = "";

afterAll(async () => {
  await closeDb();
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("passwords", () => {
  it("are stored as a salted hash that only the right password matches", async () => {
    const stored = await hashPassword("magandang8");
    expect(stored).not.toContain("magandang8");
    expect(stored).not.toBe(await hashPassword("magandang8"));
    expect(await verifyPassword("magandang8", stored)).toBe(true);
    expect(await verifyPassword("magandang9", stored)).toBe(false);
    expect(await verifyPassword("magandang8", null)).toBe(false);
    expect(await verifyPassword("magandang8", "not-a-hash")).toBe(false);
  });

  it("need eight characters and a number", () => {
    const ok = (password: string) => PASSWORD_RULES.every((rule) => rule.test(password));
    expect(ok("magandang8")).toBe(true);
    expect(ok("short1")).toBe(false);
    expect(ok("nonumbershere")).toBe(false);
  });

  it("join codes are six characters with no letters that look alike", () => {
    for (let run = 0; run < 50; run++) expect(newJoinCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });
});

describe("sign up", () => {
  it("refuses a weak password, a bad email and missing fields", async () => {
    const weak = [
      { ...teacher, password: "short1" },
      { ...teacher, password: "nonumbershere" },
      { ...teacher, email: "not-an-email" },
      { ...teacher, className: "" },
      { ...teacher, role: "principal" },
      { role: "student", name: "No Code", email: "nocode@example.com", password: "magandang8" },
    ];
    for (const body of weak) {
      const result = await call(signupRoute, body);
      expect(result.status).toBe(400);
      expect(jar.has(SESSION_COOKIE)).toBe(false);
    }
    expect(await listUsers()).toHaveLength(5);
  });

  it("creates a teacher with a new class and signs them in", async () => {
    const result = await call(signupRoute, { ...teacher, email: "  Ana@Example.com " });
    expect(result.status).toBe(200);
    expect(result.user).toMatchObject({ name: "Ms. Ana Lim", role: "teacher", childId: null });
    // Nothing about the password comes back.
    expect(JSON.stringify(result)).not.toMatch(/password|scrypt/i);

    const schoolClass = await getClass(result.user!.classId);
    expect(schoolClass).toMatchObject({ name: "Grade 8 - Rosal", subject: "Science" });
    joinCode = schoolClass!.joinCode;
    expect(joinCode).toMatch(/^[A-Z2-9]{6}$/);

    expect((await getCurrentUser())?.id).toBe(result.user!.id);

    // The database holds a hash of the password and a hash of the token.
    const [row] = await query<{ email: string; password_hash: string }>(
      "select email, password_hash from users where id = $1",
      [result.user!.id],
    );
    expect(row.email).toBe("ana@example.com");
    expect(row.password_hash).toMatch(/^scrypt\$/);
    const [session] = await query<{ token_hash: string }>("select token_hash from sessions");
    expect(session.token_hash).toBe(hashSessionToken(jar.get(SESSION_COOKIE)!));
    expect(session.token_hash).not.toBe(jar.get(SESSION_COOKIE));
  });

  it("refuses an email that already has an account", async () => {
    jar.clear();
    const again = await call(signupRoute, { ...teacher, email: "ANA@example.com" });
    expect(again.status).toBe(409);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    const [classes] = await query<{ count: number }>("select count(*)::int as count from classes");
    expect(classes.count).toBe(2);
  });

  it("lets a student join with the class code, typed in any case", async () => {
    jar.clear();
    const student = {
      role: "student",
      name: "Ben Cruz",
      email: "ben@example.com",
      password: "kaibigan1",
    };
    expect((await call(signupRoute, { ...student, joinCode: "NOPE99" })).status).toBe(400);
    // The sample class is for trying the app and cannot be joined.
    expect((await call(signupRoute, { ...student, joinCode: "SAMPA7" })).status).toBe(400);

    const result = await call(signupRoute, { ...student, joinCode: joinCode.toLowerCase() });
    expect(result.status).toBe(200);
    expect(result.user).toMatchObject({ role: "student", childId: null });
    expect((await getClass(result.user!.classId))?.joinCode).toBe(joinCode);
  });

  it("links a parent to their child by the child's email", async () => {
    jar.clear();
    const parent = {
      role: "parent",
      name: "Mrs. Cruz",
      email: "mrs.cruz@example.com",
      password: "pamilya2026",
      joinCode,
    };
    // Not a student of this class: the teacher, and nobody at all.
    for (const childEmail of ["ana@example.com", "nobody@example.com"]) {
      expect((await call(signupRoute, { ...parent, childEmail })).status).toBe(400);
    }

    const result = await call(signupRoute, { ...parent, childEmail: "ben@example.com" });
    expect(result.status).toBe(200);
    const [child] = await query<{ id: string }>("select id from users where email = $1", [
      "ben@example.com",
    ]);
    expect(result.user).toMatchObject({ role: "parent", childId: child.id });
  });

  it("keeps new accounts out of the sample class", async () => {
    const sample = await listUsers(SEED_IDS.classId);
    expect(sample).toHaveLength(5);
    expect(await listUsers()).toHaveLength(8);
  });
});

describe("log in", () => {
  it("answers the same for a wrong password and an unknown email", async () => {
    jar.clear();
    const wrong = await call(loginRoute, { email: "ana@example.com", password: "magandang9" });
    const unknown = await call(loginRoute, { email: "nobody@example.com", password: "magandang8" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.error).toEqual(unknown.error);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  it("does not open a sample account, which has no password", async () => {
    await query("update users set email = $1 where id = $2", [
      "reyes@example.com",
      SEED_IDS.teacherId,
    ]);
    const result = await call(loginRoute, { email: "reyes@example.com", password: "anything1" });
    expect(result.status).toBe(401);
  });

  it("signs in with the right password, then out again", async () => {
    const result = await call(loginRoute, { email: " ANA@example.com", password: "magandang8" });
    expect(result.status).toBe(200);
    expect(result.user).toMatchObject({ name: "Ms. Ana Lim", role: "teacher" });
    expect((await getCurrentUser())?.id).toBe(result.user!.id);

    const token = jar.get(SESSION_COOKIE)!;
    expect((await call(signOutRoute, undefined, "DELETE")).status).toBe(200);
    expect(jar.has(SESSION_COOKIE)).toBe(false);

    // The old cookie is dead after signing out, even if someone kept a copy.
    jar.set(SESSION_COOKIE, token);
    expect(await getCurrentUser()).toBeNull();
  });

  it("ignores a session that has expired", async () => {
    jar.clear();
    await call(loginRoute, { email: "ana@example.com", password: "magandang8" });
    expect(await getCurrentUser()).not.toBeNull();
    await query("update sessions set expires_at = now() - interval '1 minute'");
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("demo reset", () => {
  it("puts the sample class back and keeps the accounts people signed up for", async () => {
    jar.clear();
    await call(loginRoute, { email: "ana@example.com", password: "magandang8" });
    await query("delete from users where id = $1", [SEED_IDS.studentIds[0]]);

    expect((await call(resetRoute)).status).toBe(200);

    expect(await listUsers(SEED_IDS.classId)).toHaveLength(5);
    expect(await listUsers()).toHaveLength(8);
    // Ana is not a sample account, so the reset does not sign her out.
    expect((await getCurrentUser())?.name).toBe("Ms. Ana Lim");
  });
});
