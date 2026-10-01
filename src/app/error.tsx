"use client";

// Fallback for any page that fails to render, for example when the database
// cannot be reached. Error boundaries must be client components.

import { useEffect } from "react";
import { Alert, Button, ButtonLink, Page } from "@/components/ui";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  /** Loads the page's data again and re-renders it. */
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Page>
      <Alert tone="danger" title="This page could not load">
        Something went wrong on our side. Try again. If it keeps happening, go back to
        the start and choose an account again.
      </Alert>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Go to the start
        </ButtonLink>
      </div>
    </Page>
  );
}
