// Create an account as a teacher, a student or a parent.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/SignupForm";
import { Page, PageHeader } from "@/components/ui";
import { getCurrentUser, HOME_PATH } from "@/lib/session";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(HOME_PATH[user.role]);

  return (
    <Page size="narrow">
      <PageHeader
        eyebrow="AralLoop"
        title="Create your account"
        description="Teachers start a class. Students and parents join it with the class's join code."
      />
      <SignupForm homePaths={HOME_PATH} />
    </Page>
  );
}
