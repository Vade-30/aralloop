// The role picker, the first screen of the app. Visitors choose one of the
// sample accounts instead of signing in, because this is a prototype.

import { AccountPicker, type AccountGroup } from "@/components/home/AccountPicker";
import { ResetDemoButton } from "@/components/home/ResetDemoButton";
import { Alert, ButtonLink, Card, EmptyState, Page, SectionTitle } from "@/components/ui";
import { getClass, listUsers } from "@/lib/db/repo";
import { getCurrentUser, HOME_PATH } from "@/lib/session";
import type { Role, SchoolClass, User } from "@/lib/types";

const GROUP_LABELS: Record<Role, string> = {
  teacher: "Teacher",
  student: "Students",
  parent: "Parent",
};
const GROUP_ORDER: Role[] = ["teacher", "student", "parent"];

function describe(
  user: User,
  classes: Map<string, SchoolClass>,
  users: Map<string, User>,
): string {
  const className = classes.get(user.classId)?.name;
  if (user.role === "teacher") return className ? `Teacher of ${className}` : "Teacher";
  if (user.role === "student") return className ? `Student in ${className}` : "Student";
  const child = user.childId ? users.get(user.childId) : undefined;
  return child ? `Parent of ${child.name}` : "Parent";
}

export default async function RolePickerPage() {
  // Reading the session cookie also makes this page render on every request,
  // so the account list is never a stale build-time copy.
  const currentUser = await getCurrentUser();
  const users = await listUsers();

  const classIds = [...new Set(users.map((user) => user.classId))];
  const classList = await Promise.all(classIds.map((id) => getClass(id)));
  const classes = new Map(
    classList.filter((entry) => entry !== null).map((entry) => [entry.id, entry]),
  );
  const usersById = new Map(users.map((user) => [user.id, user]));

  const groups: AccountGroup[] = GROUP_ORDER.map((role) => ({
    label: GROUP_LABELS[role],
    accounts: users
      .filter((user) => user.role === role)
      .map((user) => ({
        id: user.id,
        name: user.name,
        description: describe(user, classes, usersById),
        homePath: HOME_PATH[role],
      })),
  })).filter((group) => group.accounts.length > 0);

  return (
    <Page>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Choose an account
        </h1>
        <p className="mt-2 text-base text-slate-700">
          AralLoop turns a teacher&apos;s lesson into an activity, checks the answers, and
          tells parents what their child should practise.
        </p>
      </header>

      {currentUser && (
        <Alert tone="info" className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>You are using {currentUser.name}&apos;s account.</p>
            <ButtonLink href={HOME_PATH[currentUser.role]} size="sm">
              Continue
            </ButtonLink>
          </div>
        </Alert>
      )}

      {groups.length === 0 ? (
        <EmptyState
          title="No sample accounts yet"
          description="Reset the sample data below to create the sample class."
        />
      ) : (
        <AccountPicker groups={groups} currentUserId={currentUser?.id ?? null} />
      )}

      <Card className="mt-8">
        <SectionTitle>About these accounts</SectionTitle>
        <p className="mt-1 text-sm text-slate-600">
          These are sample accounts with made-up names. There are no passwords because
          this is a prototype.
        </p>
        <div className="mt-4">
          <ResetDemoButton />
        </div>
      </Card>
    </Page>
  );
}
