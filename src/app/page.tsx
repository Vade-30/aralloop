// The first screen of the app. Visitors can try one of the sample accounts,
// which have no password, or sign up and log in to use their own class.

import { ArrowRight, Info, UserPlus } from "lucide-react";
import { AccountPicker, type AccountGroup } from "@/components/home/AccountPicker";
import { HeroArt } from "@/components/home/HeroArt";
import { HomeMotion } from "@/components/home/HomeMotion";
import { LoopStrip } from "@/components/home/LoopStrip";
import { ResetDemoButton } from "@/components/home/ResetDemoButton";
import { Avatar, ButtonLink, EmptyState, Page, PageHeader } from "@/components/ui";
import { getClass, listUsers } from "@/lib/db/repo";
import { SEED_IDS } from "@/lib/db/seed";
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
  // Only the sample class: accounts that people signed up for are never listed.
  const users = await listUsers(SEED_IDS.classId);

  const classIds = [...new Set(users.map((user) => user.classId))];
  const classList = await Promise.all(classIds.map((id) => getClass(id)));
  const classes = new Map(
    classList.filter((entry) => entry !== null).map((entry) => [entry.id, entry]),
  );
  const usersById = new Map(users.map((user) => [user.id, user]));

  const groups: AccountGroup[] = GROUP_ORDER.map((role) => ({
    role,
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
      <PageHeader
        eyebrow="AralLoop · AI classroom loop"
        title="Try a sample account"
        description={
          <>
            AralLoop turns a teacher&apos;s lesson into an activity, checks the answers, and
            tells parents what their child should practise.
            {/* The picture has the right of the band to itself until an
                account is chosen; then the card below takes that place. */}
            {!currentUser && <HeroArt />}
          </>
        }
        actions={
          currentUser && (
            // A white card on the band: the one yellow action when an account
            // is already chosen.
            <div
              role="status"
              className="flex w-full animate-pop flex-wrap items-center gap-3 rounded-3xl border-2 border-line bg-white p-3 text-ink sm:w-64"
            >
              <Avatar name={currentUser.name} tone="brand" />
              <p className="min-w-0 flex-1 break-words text-sm font-bold leading-snug">
                You are using {currentUser.name}&apos;s account.
              </p>
              <ButtonLink href={HOME_PATH[currentUser.role]} className="w-full">
                Continue
                <ArrowRight className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
              </ButtonLink>
            </div>
          )
        }
        overlap
      />

      {/* Positioned, so the strip sits over the bottom edge of the band. It is
          a group so the loop's steps and the account columns can light each
          other up (see LoopStrip and AccountPicker). */}
      <div className="group/loop relative">
        <HomeMotion />
        <LoopStrip />

        <div className="mt-6">
          {groups.length === 0 ? (
            <EmptyState
              title="No sample accounts yet"
              description="Reset the sample data below to create the sample class."
            />
          ) : (
            <AccountPicker groups={groups} currentUserId={currentUser?.id ?? null} />
          )}
        </div>
      </div>

      {!currentUser && (
        <section
          aria-labelledby="own-class"
          className="mt-8 flex flex-col gap-4 rounded-3xl border-2 border-accent-200 bg-accent-50 p-4 sm:p-5 md:flex-row md:items-center md:justify-between md:gap-6"
        >
          <div className="flex min-w-0 items-start gap-3.5">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-accent-400 text-ink"
            >
              <UserPlus className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="own-class" className="text-lg font-extrabold leading-tight text-ink">
                Use AralLoop with your own class
              </h2>
              <p className="mt-1 max-w-xl text-sm font-semibold text-amber-900">
                Teachers sign up and get a join code. Students and parents sign up with that
                code.
              </p>
            </div>
          </div>
          <div className="flex flex-none flex-wrap gap-3">
            <ButtonLink href="/signup">Sign up</ButtonLink>
            <ButtonLink href="/login" variant="secondary">
              Log in
            </ButtonLink>
          </div>
        </section>
      )}

      <section
        aria-labelledby="about-accounts"
        className="mt-8 flex flex-col gap-4 rounded-3xl border-2 border-dashed border-brand-200 p-4 sm:p-5 md:flex-row md:items-start md:justify-between md:gap-6"
      >
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl border-2 border-line bg-white text-brand-700"
          >
            <Info className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="about-accounts" className="text-lg font-extrabold leading-tight text-ink">
              About these accounts
            </h2>
            <p className="mt-1 max-w-xl text-sm font-semibold text-muted">
              These are sample accounts with made-up names and no passwords, so anyone can
              open them. Accounts that people sign up for are private and are not listed
              here.
            </p>
          </div>
        </div>
        <ResetDemoButton />
      </section>
    </Page>
  );
}
