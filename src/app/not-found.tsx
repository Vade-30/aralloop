// Shown for unknown addresses and whenever a page calls notFound(), for
// example when an activity belongs to another class.

import { ButtonLink, EmptyState, Page } from "@/components/ui";

export default function NotFound() {
  return (
    <Page>
      <EmptyState
        title="Page not found"
        description="This page does not exist, or it belongs to another account. Go back to the start and choose an account."
        action={<ButtonLink href="/">Go to the start</ButtonLink>}
      />
    </Page>
  );
}
