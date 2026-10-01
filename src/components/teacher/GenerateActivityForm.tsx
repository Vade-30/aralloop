"use client";

// Lesson page: asks the AI for one more draft activity from a saved lesson.

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/client-api";
import { Alert, Button, Spinner } from "@/components/ui";
import {
  DEFAULT_GENERATE_OPTIONS,
  GENERATING_MESSAGE,
  GenerateOptionFields,
  requestActivity,
} from "./GenerateOptions";

export function GenerateActivityForm({
  lessonId,
  hasActivities,
}: {
  lessonId: string;
  hasActivities: boolean;
}) {
  const router = useRouter();
  const [options, setOptions] = useState(DEFAULT_GENERATE_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      const activityId = await requestActivity(lessonId, options);
      // Stay in the loading state until the editor replaces this screen.
      router.push(`/teacher/activities/${activityId}`);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setWorking(false);
    }
  }

  return (
    <form onSubmit={generate} noValidate className="space-y-4">
      <GenerateOptionFields
        idPrefix="lesson-generate"
        value={options}
        onChange={setOptions}
        disabled={working}
      />
      {error && (
        <Alert tone="danger" title="The activity could not be generated">
          {error} Your lesson is still saved, so you can try again.
        </Alert>
      )}
      {working && (
        <p role="status" className="flex items-start gap-2 text-sm text-slate-700">
          <Spinner className="mt-0.5 h-4 w-4 shrink-0" />
          {GENERATING_MESSAGE}
        </p>
      )}
      <Button type="submit" className="w-full sm:w-auto" loading={working}>
        {error ? "Try again" : hasActivities ? "Generate another activity" : "Generate activity"}
      </Button>
    </form>
  );
}
