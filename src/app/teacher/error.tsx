"use client";

// Fallback for an unexpected failure while a teacher screen loads its data,
// for example when the database cannot be reached.

import { House, RotateCw, Unplug } from "lucide-react";
import { useEffect } from "react";
import { StateArt } from "@/components/home/StateArt";
import { StateScreen } from "@/components/StateScreen";
import { Button, ButtonLink } from "@/components/ui";

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
    <StateScreen
      title="This page could not be loaded"
      art={
        <StateArt tone="danger">
          <Unplug />
        </StateArt>
      }
      alert
      message={
        <>
          {/* The heading above is repeated here unseen, so the announcement is whole. */}
          <span className="sr-only">This page could not be loaded. </span>
          Nothing was lost. Try again, or go back to your class.
        </>
      }
      actions={
        <>
          <Button size="lg" onClick={() => retry()}>
            <RotateCw className="h-5 w-5" aria-hidden="true" />
            Try again
          </Button>
          <ButtonLink href="/teacher" variant="secondary" size="lg">
            <House className="h-5 w-5" aria-hidden="true" />
            Back to class
          </ButtonLink>
        </>
      }
    />
  );
}
