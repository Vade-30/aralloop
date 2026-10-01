"use client";

// New lesson form: paste or upload a lesson, then let the AI write a draft
// activity from it. Saving the lesson and generating the activity are two
// requests, so a failed generation never creates the lesson twice: the saved
// lesson id is kept and "Try again" repeats only the generation.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/client-api";
import {
  LIMITS,
  type CreateLessonRequest,
  type CreateLessonResponse,
  type ExtractResponse,
} from "@/lib/contracts";
import { Alert, Button, Card, Field, Input, Spinner, Textarea, cn } from "@/components/ui";
import {
  DEFAULT_GENERATE_OPTIONS,
  GENERATING_MESSAGE,
  GenerateOptionFields,
  requestActivity,
} from "./GenerateOptions";

const ACCEPTED_FILES = ".txt,.md,.pdf,.docx";
const UPLOAD_MAX_MB = Math.round(LIMITS.uploadMaxBytes / (1024 * 1024));
const count = new Intl.NumberFormat("en-PH");

export function NewLessonForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [options, setOptions] = useState(DEFAULT_GENERATE_OPTIONS);
  // A title the teacher typed is kept when a file is uploaded afterwards.
  const [titleTyped, setTitleTyped] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set once the lesson is stored; from then on only generation is retried. */
  const [savedLessonId, setSavedLessonId] = useState<string | null>(null);

  const length = content.trim().length;
  const tooShort = length < LIMITS.lessonContentMin;
  const tooLong = length > LIMITS.lessonContentMax;
  const lessonLocked = working || uploading || savedLessonId !== null;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadNote(null);
    if (file.size > LIMITS.uploadMaxBytes) {
      setUploadError(
        `This file is larger than ${UPLOAD_MAX_MB} MB. Choose a smaller file or paste the text.`,
      );
      input.value = "";
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api<ExtractResponse>("/api/lessons/extract", {
        method: "POST",
        formData,
      });
      setContent(result.text);
      if (!titleTyped || title.trim() === "") {
        setTitle(result.title.slice(0, LIMITS.lessonTitleMax));
        setTitleTyped(false);
      }
      setUploadNote(
        result.truncated
          ? `Text read from ${file.name}. The file was longer than ${count.format(LIMITS.lessonContentMax)} characters, so only the first part was kept.`
          : `Text read from ${file.name}. Check it below before generating.`,
      );
    } catch (caught) {
      setUploadError(errorMessage(caught));
    } finally {
      setUploading(false);
      // Lets the teacher pick the same file again after fixing a problem.
      input.value = "";
    }
  }

  function validate(): string | null {
    if (title.trim() === "") return "Give the lesson a title.";
    if (tooShort) {
      return `The lesson text is too short. Add at least ${LIMITS.lessonContentMin} characters so there is enough to write questions from.`;
    }
    if (tooLong) {
      return `The lesson text is too long. Shorten it to ${count.format(LIMITS.lessonContentMax)} characters or fewer.`;
    }
    return null;
  }

  async function generate(event?: FormEvent) {
    event?.preventDefault();
    if (working || uploading) return;

    let lessonId = savedLessonId;
    if (lessonId === null) {
      const problem = validate();
      if (problem) {
        setError(problem);
        return;
      }
    }

    setWorking(true);
    setError(null);
    try {
      if (lessonId === null) {
        const body: CreateLessonRequest = { title: title.trim(), content: content.trim() };
        const { lesson } = await api<CreateLessonResponse>("/api/lessons", {
          method: "POST",
          body,
        });
        lessonId = lesson.id;
        setSavedLessonId(lesson.id);
      }
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
      <Card className="space-y-4">
        <Field label="Lesson title" htmlFor="lesson-title">
          <Input
            id="lesson-title"
            value={title}
            maxLength={LIMITS.lessonTitleMax}
            disabled={lessonLocked}
            placeholder="For example: The water cycle"
            onChange={(event) => {
              setTitle(event.target.value);
              setTitleTyped(true);
            }}
          />
        </Field>

        <Field
          label="Lesson text"
          htmlFor="lesson-content"
          hint={`Paste the lesson here. At least ${LIMITS.lessonContentMin} characters.`}
        >
          <Textarea
            id="lesson-content"
            rows={12}
            value={content}
            disabled={lessonLocked}
            aria-describedby="lesson-content-count"
            onChange={(event) => setContent(event.target.value)}
          />
          <p
            id="lesson-content-count"
            className={cn(
              "mt-1 text-right text-xs",
              tooLong ? "font-medium text-red-700" : "text-slate-500",
            )}
          >
            {count.format(length)} / {count.format(LIMITS.lessonContentMax)} characters
          </p>
        </Field>

        <div>
          <label htmlFor="lesson-file" className="mb-1 block text-sm font-medium text-slate-800">
            Upload a file instead
          </label>
          <input
            id="lesson-file"
            type="file"
            accept={ACCEPTED_FILES}
            disabled={lessonLocked}
            onChange={handleFile}
            className="block w-full text-sm text-slate-700 file:mr-3 file:min-h-10 file:rounded-lg file:border file:border-solid file:border-slate-300 file:bg-white file:px-3 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-50 disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-slate-500">
            Text, Markdown, PDF or Word file, up to {UPLOAD_MAX_MB} MB. Its text replaces what is
            in the box above.
          </p>
          {uploading && (
            <p role="status" className="mt-2 flex items-center gap-2 text-sm text-slate-700">
              <Spinner className="h-4 w-4" />
              Reading the file.
            </p>
          )}
          {uploadNote && !uploading && (
            <Alert tone="info" className="mt-2">
              {uploadNote}
            </Alert>
          )}
          {uploadError && (
            <Alert tone="danger" className="mt-2">
              {uploadError}
            </Alert>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <GenerateOptionFields
          idPrefix="new-lesson"
          value={options}
          onChange={setOptions}
          disabled={working}
        />

        {savedLessonId !== null && !working && (
          <Alert tone="info" title="Your lesson is saved">
            Only the activity still needs to be written. You can change the number of items or
            the format and try again, or{" "}
            <Link
              href={`/teacher/lessons/${savedLessonId}`}
              className="font-medium underline underline-offset-2"
            >
              open the lesson page
            </Link>
            .
          </Alert>
        )}

        {error && (
          <Alert
            tone="danger"
            title={savedLessonId !== null ? "The activity could not be generated" : undefined}
          >
            {error}
          </Alert>
        )}

        {working && (
          <p role="status" className="flex items-start gap-2 text-sm text-slate-700">
            <Spinner className="mt-0.5 h-4 w-4 shrink-0" />
            {GENERATING_MESSAGE}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full sm:w-auto" loading={working} disabled={uploading}>
          {savedLessonId !== null ? "Try again" : "Generate activity"}
        </Button>
      </Card>
    </form>
  );
}
