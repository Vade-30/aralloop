// Shown when a lesson or activity does not exist or belongs to another class.

import { ButtonLink, EmptyState, Page } from "@/components/ui";

export default function TeacherNotFound() {
  return (
    <Page>
      <EmptyState
        title="We could not find that page"
        description="The lesson or activity may have been deleted, or the link is wrong."
        action={<ButtonLink href="/teacher">Back to class</ButtonLink>}
      />
    </Page>
  );
}
