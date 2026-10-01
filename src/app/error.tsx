"use client";

// Fallback for any page that fails to render, for example when the database
// cannot be reached. Error boundaries must be client components.

import { House, RotateCw, Unplug } from "lucide-react";
import { useEffect } from "react";
import { StateArt } from "@/components/home/StateArt";
import { StateScreen } from "@/components/StateScreen";
import { Button, ButtonLink } from "@/components/ui";

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
    <StateScreen
      title="This page could not load"
      art={
        <StateArt tone="danger">
          <Unplug />
        </StateArt>
      }
      alert
      message="Something went wrong on our side. Try again. If it keeps happening, go back to the start and choose an account again."
      actions={
        <>
          <Button size="lg" onClick={() => retry()}>
            <RotateCw className="h-5 w-5" aria-hidden="true" />
            Try again
          </Button>
          <ButtonLink href="/" variant="secondary" size="lg">
            <House className="h-5 w-5" aria-hidden="true" />
            Go to the start
          </ButtonLink>
        </>
      }
    />
  );
}
