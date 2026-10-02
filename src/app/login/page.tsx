// Log in with an email and a password.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { Page, PageHeader } from "@/components/ui";
import { getCurrentUser, HOME_PATH } from "@/lib/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(HOME_PATH[user.role]);

  return (
    <Page size="narrow">
      <PageHeader
        eyebrow="AralLoop"
        title="Log in"
        description="Welcome back. Use the email and password you signed up with."
      />
      <LoginForm homePaths={HOME_PATH} />
    </Page>
  );
}
