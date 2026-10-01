"use client";

// New lesson form: paste or upload a lesson, then let the AI write a draft
// activity from it. Saving the lesson and generating the activity are two
// requests, so a failed generation never creates the lesson twice: the saved
// lesson id is kept and "Try again" repeats only the generation.

import { ArrowRight, CircleCheck, CloudUpload, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { LESSON_PROMPT_MAX } from "@/lib/ai/prompts";
import { api, errorMessage } from "@/lib/client-api";
import {
  LIMITS,
  type CreateLessonRequest,
  type CreateLessonResponse,
  type ExtractResponse,
} from "@/lib/contracts";
import { Alert, Badge, Button, Card, Field, Input, Spinner, Textarea, cn } from "@/components/ui";
import {
  DEFAULT_GENERATE_OPTIONS,
  GENERATING_MESSAGE,
  GenerateOptionFields,
  requestActivity,
} from "./GenerateOptions";
import { LessonGenerating } from "./LessonGenerating";

const ACCEPTED_FILES = ".txt,.md,.pdf,.docx";
const UPLOAD_MAX_MB = Math.round(LIMITS.uploadMaxBytes / (1024 * 1024));
const count = new Intl.NumberFormat("en-PH");

/** Card heading with the number of the step in front. */
function StepHeading({ step, children }: { step: number; children: ReactNode }) {
  return (
    <h2 className="flex flex-wrap items-center gap-2.5 text-xl font-extrabold text-ink">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-brand-600 text-base text-white"
      >
        {step}
      </span>
      {children}
    </h2>
  );
}

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
  /** A file is being dragged over the upload area. Changes its looks only. */
  const [dragging, setDragging] = useState(false);

  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set once the lesson is stored; from then on only generation is retried. */
  const [savedLessonId, setSavedLessonId] = useState<string | null>(null);

  const length = content.trim().length;
  const tooShort = length < LIMITS.lessonContentMin;
  const tooLong = length > LIMITS.lessonContentMax;
  /** Longer than what the AI is given when it writes the activity. */
  const partlyRead = !tooLong && length > LESSON_PROMPT_MAX;
  const lessonLocked = working || uploading || savedLessonId !== null;
  /** How much of the allowed length is used, for the bar under the text box. */
  const usedPercent =
    length === 0 ? 0 : Math.min(100, Math.max(2, (length / LIMITS.lessonContentMax) * 100));

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
    <form onSubmit={generate} noValidate className="min-w-0 space-y-6">
      <Card className="animate-rise space-y-5">
        <StepHeading step={1}>
          Your lesson
          {savedLessonId !== null && (
            <Badge tone="success" className="animate-pop font-sans">
              <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Saved
            </Badge>
          )}
        </StepHeading>

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
          <div className="mt-2 flex items-center gap-3">
            {/* Decoration: the counter beside it says the same in words. */}
            <span
              aria-hidden="true"
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-brand-100"
            >
              <span
                className={cn(
                  "block h-full rounded-full transition-[width,background-color] duration-300",
                  tooLong
                    ? "bg-red-500"
                    : partlyRead
                      ? "bg-amber-500"
                      : tooShort
                        ? "bg-brand-300"
                        : "bg-emerald-500",
                )}
                style={{ width: `${usedPercent}%` }}
              />
            </span>
            <p
              id="lesson-content-count"
              className={cn(
                "flex flex-none items-center gap-1 text-xs font-bold",
                tooLong ? "text-red-700" : "text-muted",
              )}
            >
              {tooLong && <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />}
              {!tooLong && !tooShort && (
                <CircleCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              )}
              {count.format(length)} / {count.format(LIMITS.lessonContentMax)} characters
            </p>
          </div>
          {partlyRead && (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-accent-50 px-3 py-2 text-xs font-bold text-amber-900">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
              <span>
                This lesson is long. The AI writes the activity from about the first{" "}
                {count.format(LESSON_PROMPT_MAX)} characters, so the last part may not be covered.
                Split a long lesson in two if you want questions on all of it.
              </span>
            </p>
          )}
        </Field>

        <div>
          <label htmlFor="lesson-file" className="mb-1.5 block text-sm font-extrabold text-ink">
            Upload a file instead
          </label>
          {/* The file input is real and covers the whole area, invisibly, so a
              click, a key press and a dropped file all reach it. */}
          <div
            className={cn(
              "relative flex items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-4 transition-colors sm:gap-4",
              "has-[input:focus-visible]:[outline-offset:2px] has-[input:focus-visible]:[outline:3px_solid_#3b68f5]",
              dragging ? "border-brand-600 bg-brand-50" : "border-brand-200 bg-canvas",
              lessonLocked ? "opacity-60" : "hover:border-brand-400 hover:bg-brand-50",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-12 w-12 flex-none items-center justify-center rounded-2xl border-2 border-line bg-white text-brand-700 shadow-edge-sm transition-transform",
                dragging && "-translate-y-0.5",
              )}
            >
              {uploading ? <Spinner className="h-6 w-6" /> : <CloudUpload className="h-6 w-6" />}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold text-ink">
                {dragging ? "Drop the file to read it" : "Choose a file or drop it here"}
              </p>
              <p id="lesson-file-hint" className="mt-0.5 text-xs font-semibold text-muted">
                Text, Markdown, PDF or Word file, up to {UPLOAD_MAX_MB} MB. Its text replaces what
                is in the box above.
              </p>
            </div>
            <input
              id="lesson-file"
              type="file"
              accept={ACCEPTED_FILES}
              disabled={lessonLocked}
              aria-describedby="lesson-file-hint"
              onChange={handleFile}
              onDragEnter={() => setDragging(true)}
              onDragLeave={() => setDragging(false)}
              onDrop={() => setDragging(false)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 file:cursor-pointer disabled:cursor-not-allowed"
            />
          </div>
          {uploading && (
            <p role="status" className="mt-2 flex items-center gap-2 text-sm font-bold text-ink">
              <Spinner className="h-4 w-4 text-brand-600" />
              Reading the file.
            </p>
          )}
          {uploadNote && !uploading && (
            <Alert tone="info" className="mt-2 animate-pop break-words">
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

      <Card className="animate-rise space-y-5" style={{ animationDelay: "90ms" }}>
        <StepHeading step={2}>The activity</StepHeading>

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
              className="font-extrabold underline underline-offset-2"
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

        {working && <LessonGenerating message={GENERATING_MESSAGE} />}

        <Button
          type="submit"
          size="lg"
          className="w-full sm:w-auto"
          loading={working}
          disabled={uploading}
        >
          {savedLessonId !== null ? "Try again" : "Generate activity"}
          {!working && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
        </Button>
      </Card>
    </form>
  );
}
