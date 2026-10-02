// Creates the demo accounts for showing sign-up and log-in: one teacher with a
// new class, three students in it and one parent for each student.
//
//   npm run demo:accounts                                  (the local app)
//   npm run demo:accounts -- https://aralloop.vercel.app   (a hosted site)
//
// It signs every account up through the site's own sign-up route, the same as
// a person would, so the app must be running. It is safe to run again: an
// account that already exists is left as it is.
//
// These accounts are for demos only. Their password is written below, so
// anyone who can read this file can log in to them. Do not put real student
// work in this class.

const DEMO_PASSWORD = "aralloop2026";

const TEACHER = {
  name: "Mr. Ramon Garcia",
  email: "teacher@aralloop.example",
  className: "Grade 7 - Mabini",
  gradeLevel: "Grade 7",
  subject: "Science",
};

/** Each student with the parent who follows them. */
const FAMILIES = [
  {
    student: { name: "Bea Navarro", email: "bea@aralloop.example" },
    parent: { name: "Mrs. Teresa Navarro", email: "teresa@aralloop.example" },
  },
  {
    student: { name: "Carlo Mendoza", email: "carlo@aralloop.example" },
    parent: { name: "Mr. Jose Mendoza", email: "jose@aralloop.example" },
  },
  {
    student: { name: "Dana Ramos", email: "dana@aralloop.example" },
    parent: { name: "Mrs. Grace Ramos", email: "grace@aralloop.example" },
  },
];

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");

interface Reply {
  status: number;
  message: string;
  /** The session cookie the site set, as "name=value", or null. */
  cookie: string | null;
}

async function post(path: string, body: unknown): Promise<Reply> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  const cookie = response.headers.getSetCookie()[0]?.split(";")[0] ?? null;
  return { status: response.status, message: payload?.error?.message ?? "", cookie };
}

/** Signs an account up. True if it was created, false if it was there already. */
async function signUp(account: Record<string, string>): Promise<boolean> {
  const reply = await post("/api/auth/signup", { ...account, password: DEMO_PASSWORD });
  if (reply.status === 200) return true;
  if (reply.status === 409) return false;
  throw new Error(`Could not create ${account.email}: ${reply.status} ${reply.message}`);
}

/** The join code of the teacher's class, read from the teacher's dashboard. */
async function readJoinCode(): Promise<string> {
  const login = await post("/api/auth/login", { email: TEACHER.email, password: DEMO_PASSWORD });
  if (login.status !== 200 || !login.cookie) {
    throw new Error(
      `Could not log in as ${TEACHER.email}: ${login.status} ${login.message}. ` +
        "If the account was made with another password, this script cannot use it.",
    );
  }
  const page = await fetch(`${baseUrl}/teacher`, { headers: { Cookie: login.cookie } });
  // React puts a comment between the words and the code.
  const match = /Join code\s*(?:<!-- -->)?\s*([A-Z0-9]{6})/i.exec(await page.text());
  if (!match) throw new Error("Could not find the join code on the teacher's dashboard.");
  return match[1];
}

function report(created: boolean, role: string, account: { name: string; email: string }) {
  console.log(`  ${created ? "created" : "exists "}  ${role.padEnd(8)} ${account.email}  (${account.name})`);
}

async function main() {
  console.log(`Demo accounts on ${baseUrl}\n`);

  report(await signUp({ role: "teacher", ...TEACHER }), "teacher", TEACHER);
  const joinCode = await readJoinCode();

  // Students first: a parent is linked to an account that must already exist.
  for (const { student } of FAMILIES) {
    report(await signUp({ role: "student", ...student, joinCode }), "student", student);
  }
  for (const { student, parent } of FAMILIES) {
    const created = await signUp({
      role: "parent",
      ...parent,
      joinCode,
      childEmail: student.email,
    });
    report(created, "parent", parent);
  }

  console.log(`\nClass: ${TEACHER.className}, join code ${joinCode}`);
  console.log("The password of every account is DEMO_PASSWORD at the top of this script.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const refused = /fetch failed/i.test(message);
  console.error(refused ? `Could not reach ${baseUrl}. Is the app running?` : message);
  process.exitCode = 1;
});
