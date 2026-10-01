"use client";

// Fallback for an unexpected failure while a teacher screen loads its data,
// for example when the database cannot be reached.

import { useEffect } from "react";
import { Alert, Button, ButtonLink, Page } from "@/components/ui";

export default function TeacherError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Page>
      <Alert tone="danger" title="This page could not be loaded">
        Nothing was lost. Try again, or go back to your class.
      </Alert>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <ButtonLink href="/teacher" variant="secondary">
          Back to class
        </ButtonLink>
      </div>
    </Page>
  );
}
