"use client";

// Lesson page: asks the AI for one more draft activity from a saved lesson.

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/client-api";
import { Alert, Button } from "@/components/ui";
import {
  DEFAULT_GENERATE_OPTIONS,
  GENERATING_MESSAGE,
  GenerateOptionFields,
  requestActivity,
} from "./GenerateOptions";
import { LessonGenerating } from "./LessonGenerating";

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
      {working && <LessonGenerating message={GENERATING_MESSAGE} />}
      <Button type="submit" className="w-full" loading={working}>
        {error ? "Try again" : hasActivities ? "Generate another activity" : "Generate activity"}
        {!working && <ArrowRight className="h-5 w-5 flex-none" aria-hidden="true" />}
      </Button>
    </form>
  );
}
