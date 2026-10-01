"use client";

// The form a student answers an activity in. It receives PublicItem objects
// only: the answer key, accepted answers, rubric and explanation never reach
// this component, so they are never in the browser before submission.

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Alert, Button, Input, Textarea } from "@/components/ui";
import { api, ClientApiError, errorMessage } from "@/lib/client-api";
import { LIMITS, type SubmissionResponse, type SubmitRequest } from "@/lib/contracts";
import { ITEM_TYPE_LABELS, type PublicItem } from "@/lib/types";
import { pointsLabel, questionsLabel } from "./labels";

type Status = "editing" | "confirming" | "submitting" | "submitted";

const TRUE_FALSE = ["True", "False"];

/** The options to show as radio buttons, or null for a typed answer. */
function choicesOf(item: PublicItem): string[] | null {
  if (item.type === "true_false") return item.choices?.length ? item.choices : TRUE_FALSE;
  if (item.type === "multiple_choice") return item.choices?.length ? item.choices : null;
  return null;
}

function ItemField({
  item,
  total,
  value,
  disabled,
  onChange,
}: {
  item: PublicItem;
  total: number;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const controlId = `answer-${item.id}`;
  const choices = choicesOf(item);
  const meta = (
    <p className="text-sm font-medium text-slate-500">
      Question {item.position} of {total} · {ITEM_TYPE_LABELS[item.type]} ·{" "}
      {pointsLabel(item.points)}
    </p>
  );
  const questionClass =
    "mt-1 block whitespace-pre-wrap break-words text-base font-medium text-slate-900";

  if (choices) {
    return (
      // min-w-0: a fieldset is otherwise as wide as its longest word, which
      // makes long questions scroll sideways on a phone.
      <fieldset className="min-w-0" disabled={disabled}>
        <legend className="w-full p-0">
          {meta}
          <span className={questionClass}>{item.question}</span>
        </legend>
        <div className="mt-3 space-y-2">
          {choices.map((choice, index) => (
            <label
              key={index}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
            >
              <input
                type="radio"
                name={controlId}
                value={choice}
                checked={value === choice}
                onChange={() => onChange(choice)}
                className="h-5 w-5 shrink-0 accent-brand-600"
              />
              <span className="min-w-0 break-words">{choice}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  const isLong = item.type === "short_answer";
  return (
    <div>
      {meta}
      <label htmlFor={controlId} className={questionClass}>
        {item.question}
      </label>
      <div className="mt-3">
        {isLong ? (
          <>
            <Textarea
              id={controlId}
              rows={4}
              value={value}
              maxLength={LIMITS.responseMax}
              disabled={disabled}
              placeholder="Write your answer in your own words"
              aria-describedby={`${controlId}-count`}
              onChange={(event) => onChange(event.target.value)}
            />
            <p id={`${controlId}-count`} className="mt-1 text-xs text-slate-500">
              {value.length} of {LIMITS.responseMax} characters
            </p>
          </>
        ) : (
          <Input
            id={controlId}
            type="text"
            value={value}
            maxLength={LIMITS.choiceMax}
            disabled={disabled}
            autoComplete="off"
            placeholder="Type your answer"
            onChange={(event) => onChange(event.target.value)}
            // Enter in a text box would hand in the whole activity, and there
            // is only one attempt, so submitting is left to the button.
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
        )}
      </div>
    </div>
  );
}

export function AnswerForm({
  activityId,
  items,
}: {
  activityId: string;
  items: PublicItem[];
}) {
  const router = useRouter();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("editing");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const blankCount = items.filter((item) => !(responses[item.id] ?? "").trim()).length;
  const busy = status === "submitting" || status === "submitted";

  // Once the answers are stored, the server renders this page as the results.
  function showResults() {
    // The score is at the top of the results.
    window.scrollTo(0, 0);
    startRefresh(() => router.refresh());
  }

  async function submit() {
    if (busy) return;
    setStatus("submitting");
    setError(null);
    try {
      const body: SubmitRequest = {
        answers: items.map((item) => ({
          itemId: item.id,
          response: responses[item.id] ?? "",
        })),
      };
      const result = await api<SubmissionResponse>(
        `/api/activities/${activityId}/submissions`,
        { method: "POST", body },
      );
      setStatus("submitted");
      if (result.notice) {
        // Let the student read the notice first; they continue with a button.
        setNotice(result.notice);
      } else {
        showResults();
      }
    } catch (caught) {
      // 409: this activity was already submitted, so the results exist.
      if (caught instanceof ClientApiError && caught.status === 409) {
        setStatus("submitted");
        showResults();
        return;
      }
      setError(errorMessage(caught));
      setStatus("editing");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (blankCount > 0 && status !== "confirming") {
      setStatus("confirming");
      return;
    }
    void submit();
  }

  if (status === "submitted") {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Your answers were submitted">
          {notice ? "Read the note below, then open your results." : "Opening your results."}
        </Alert>
        {notice && <Alert tone="warning">{notice}</Alert>}
        <Button size="lg" className="w-full" loading={isRefreshing} onClick={showResults}>
          See my results
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <ol className="space-y-4">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <ItemField
              item={item}
              total={items.length}
              value={responses[item.id] ?? ""}
              disabled={busy}
              onChange={(value) => {
                setResponses((current) => ({ ...current, [item.id]: value }));
                // An edit after the warning means the count may have changed.
                if (status === "confirming") setStatus("editing");
              }}
            />
          </li>
        ))}
      </ol>

      <p className="text-sm text-slate-600" aria-live="polite">
        You answered {items.length - blankCount} of {questionsLabel(items.length)}. You can
        submit only once.
      </p>

      {error && <Alert tone="danger">{error}</Alert>}

      {status === "confirming" ? (
        <div className="space-y-3">
          <Alert tone="warning" title={`${questionsLabel(blankCount)} left blank`}>
            Blank answers get no points, and you cannot change your answers after you
            submit.
          </Alert>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" size="lg" className="w-full sm:w-auto">
              Submit anyway
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => setStatus("editing")}
            >
              Go back and answer
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={status === "submitting"}
        >
          {status === "submitting" ? "Checking your answers" : "Submit answers"}
        </Button>
      )}
    </form>
  );
}
