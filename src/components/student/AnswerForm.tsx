"use client";

// The form a student answers an activity in. It receives PublicItem objects
// only: the answer key, accepted answers, rubric and explanation never reach
// this component, so they are never in the browser before submission.
//
// It shows one question at a time, then a review step with the submit button.
// Every question stays in the page and only the current one is visible, so
// all answers live in one state object and go out in one request at the end.

import { ArrowLeft, ArrowRight, Check, CircleAlert, ClipboardCheck, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Alert, Badge, Button, ProgressBar, cn } from "@/components/ui";
import { api, ClientApiError, errorMessage } from "@/lib/client-api";
import { LIMITS, type SubmissionResponse, type SubmitRequest } from "@/lib/contracts";
import { ITEM_TYPE_LABELS, type PublicItem } from "@/lib/types";
import { ANSWER_FORM, ANSWER_MAIN_SLOT, ANSWER_SIDE_SLOT } from "./answer-layout";
import { pointsLabel, questionsLabel } from "./labels";

type Status = "editing" | "confirming" | "submitting" | "submitted";

const TRUE_FALSE = ["True", "False"];
const CHOICE_LETTERS = "ABCDEF";

const QUESTION_CLASS =
  "mt-3 block whitespace-pre-wrap break-words font-display text-xl font-bold leading-snug text-ink sm:text-2xl";
// Larger than the shared Input: the answer is the only thing on the card. It
// shows focus the same way, with a blue border and a soft ring.
const ANSWER_CLASS =
  "block w-full rounded-2xl border-2 border-line bg-white px-4 py-3 font-bold text-ink shadow-edge-sm placeholder:font-semibold placeholder:text-slate-500 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-200 disabled:bg-slate-100";
const BUTTON_ICON = "h-4 w-4 flex-none";

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
  onEnter,
}: {
  item: PublicItem;
  total: number;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  /** Enter in a one-line answer: move on to the next question. */
  onEnter: () => void;
}) {
  const controlId = `answer-${item.id}`;
  const choices = choicesOf(item);
  const meta = (
    <span className="flex flex-wrap items-center gap-2">
      <span className="sr-only">
        Question {item.position} of {total}.
      </span>
      <Badge tone="brand">{ITEM_TYPE_LABELS[item.type]}</Badge>
      <Badge tone="warning">{pointsLabel(item.points)}</Badge>
    </span>
  );

  if (choices) {
    return (
      // min-w-0: a fieldset is otherwise as wide as its longest word, which
      // makes long questions scroll sideways on a phone.
      <fieldset className="min-w-0" disabled={disabled}>
        <legend className="w-full p-0">
          {meta}
          <span className={QUESTION_CLASS}>{item.question}</span>
        </legend>
        {/* An even number of options pairs up on wide screens; three or five stack. */}
        <div className={cn("mt-5 grid gap-3", choices.length % 2 === 0 && "sm:grid-cols-2")}>
          {choices.map((choice, index) => (
            // The radio input is real but visually hidden; the whole card is
            // its label, so a tap anywhere and the arrow keys both work.
            <label
              key={index}
              className="relative flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-line bg-white px-3.5 py-3 text-base font-extrabold text-ink shadow-edge-sm transition-[translate,box-shadow,background-color,border-color] duration-100 hover:border-brand-300 hover:bg-brand-50 active:translate-y-[3px] active:shadow-none has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:checked]:shadow-[0_3px_0_#2549e6] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500"
            >
              <input
                type="radio"
                name={controlId}
                value={choice}
                checked={value === choice}
                onChange={() => onChange(choice)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-100 text-sm font-black text-brand-800 transition-colors peer-checked:bg-brand-600 peer-checked:text-white"
              >
                {CHOICE_LETTERS[index] ?? index + 1}
              </span>
              <span className="min-w-0 flex-1 break-words">{choice}</span>
              <Check
                className="hidden h-5 w-5 flex-none text-brand-600 peer-checked:block"
                strokeWidth={3.5}
                aria-hidden="true"
              />
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  const isLong = item.type === "short_answer";
  return (
    <div>
      <p>{meta}</p>
      <label htmlFor={controlId} className={QUESTION_CLASS}>
        {item.question}
      </label>
      <div className="mt-5">
        {isLong ? (
          <>
            <textarea
              id={controlId}
              rows={7}
              value={value}
              maxLength={LIMITS.responseMax}
              disabled={disabled}
              placeholder="Write your answer in your own words"
              aria-describedby={`${controlId}-count`}
              className={cn(ANSWER_CLASS, "text-base leading-relaxed")}
              onChange={(event) => onChange(event.target.value)}
            />
            <p
              id={`${controlId}-count`}
              className="mt-2 text-right text-xs font-bold text-muted"
            >
              {value.length} of {LIMITS.responseMax} characters
            </p>
          </>
        ) : (
          <input
            id={controlId}
            type="text"
            value={value}
            maxLength={LIMITS.choiceMax}
            disabled={disabled}
            autoComplete="off"
            placeholder="Type your answer"
            className={cn(ANSWER_CLASS, "min-h-14 text-lg")}
            onChange={(event) => onChange(event.target.value)}
            // Enter in a text box would hand in the whole activity, and there
            // is only one attempt, so it only moves to the next question.
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onEnter();
              }
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
  // 0 to items.length - 1 is a question; items.length is the review step.
  const [step, setStep] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasMoved = useRef(false);

  const total = items.length;
  const reviewing = step >= total;
  const responseOf = (item: PublicItem) => (responses[item.id] ?? "").trim();
  const blankCount = items.filter((item) => !responseOf(item)).length;
  const busy = status === "submitting" || status === "submitted";

  // After a move, focus goes to the card's heading so keyboard and screen
  // reader users land on the new question. If the card does not fit on screen
  // where it is, it is brought to the top, so each question starts in view.
  useEffect(() => {
    if (!hasMoved.current) return;
    headingRef.current?.focus({ preventScroll: true });
    const card = cardRef.current;
    if (!card) return;
    const box = card.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) {
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      card.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
    }
  }, [step]);

  function goTo(next: number) {
    if (busy) return;
    hasMoved.current = true;
    setStep(Math.min(Math.max(next, 0), total));
    // Moving away takes back the blank-answer warning; it is asked again.
    if (status === "confirming") setStatus("editing");
  }

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
    // Enter on an option submits the form in most browsers. Answers can only
    // be handed in from the review step, so anywhere else it moves on.
    if (!reviewing) {
      goTo(step + 1);
      return;
    }
    if (blankCount > 0 && status !== "confirming") {
      setStatus("confirming");
      return;
    }
    void submit();
  }

  if (status === "submitted") {
    return (
      <div
        className={cn(
          ANSWER_MAIN_SLOT,
          "animate-pop rounded-3xl border-2 border-line bg-white p-6 text-center shadow-edge sm:p-8",
        )}
      >
        <span
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700"
        >
          <Check className="h-8 w-8" strokeWidth={3.5} />
        </span>
        <div role="status" className="mt-4">
          <h2 className="text-2xl font-extrabold text-ink">Your answers were submitted</h2>
          <p className="mt-1 text-[15px] font-semibold text-muted">
            {notice ? "Read the note below, then open your results." : "Opening your results."}
          </p>
        </div>
        {notice && (
          <Alert tone="warning" className="mt-4 text-left">
            {notice}
          </Alert>
        )}
        <Button
          size="lg"
          className="mt-6 w-full sm:w-auto sm:min-w-64"
          loading={isRefreshing}
          onClick={showResults}
        >
          See my results
        </Button>
      </div>
    );
  }

  const currentItem = reviewing ? null : items[step];
  const firstBlank = items.findIndex((item) => !responseOf(item));

  return (
    <form onSubmit={handleSubmit} noValidate className={ANSWER_FORM}>
      <div
        ref={cardRef}
        className={cn(
          ANSWER_MAIN_SLOT,
          "scroll-mt-4 overflow-hidden rounded-3xl border-2 border-line bg-white shadow-edge",
        )}
      >
        <div className="bg-brand-900 px-4 py-4 text-white sm:px-6">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-extrabold uppercase tracking-widest text-accent-400"
          >
            {currentItem ? `Question ${currentItem.position} of ${total}` : "Review your answers"}
          </h2>
          {/* One segment per question. The heading and the sentence under the
              card say the same in words, so this row is decoration. */}
          <div aria-hidden="true" className="mt-3 flex gap-1.5">
            {items.map((item, index) => (
              <span
                key={item.id}
                className={cn(
                  "h-2.5 min-w-0 flex-1 rounded-full transition-colors duration-200",
                  responseOf(item) ? "bg-accent-400" : "bg-white/25",
                  index === step && "ring-2 ring-white ring-offset-2 ring-offset-brand-900",
                )}
              />
            ))}
          </div>
        </div>

        <div className="px-4 py-5 sm:px-6 sm:py-6">
          {items.map((item, index) => (
            // Showing a hidden panel restarts its entrance animation.
            <div key={item.id} hidden={index !== step} className="animate-rise">
              <ItemField
                item={item}
                total={total}
                value={responses[item.id] ?? ""}
                disabled={busy}
                onChange={(value) => {
                  setResponses((current) => ({ ...current, [item.id]: value }));
                  // An edit after the warning means the count may have changed.
                  if (status === "confirming") setStatus("editing");
                }}
                onEnter={() => goTo(index + 1)}
              />
            </div>
          ))}

          <div hidden={!reviewing} className="animate-rise">
            {status === "submitting" ? (
              // No steps or percentages: the page cannot see what the server is doing.
              <div role="status" className="flex flex-col items-center gap-4 py-10 text-center">
                <span aria-hidden="true" className="flex gap-2">
                  {[0, 160, 320].map((delay) => (
                    <span
                      key={delay}
                      className="h-3.5 w-3.5 animate-dot rounded-full bg-brand-600"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </span>
                <p className="text-[15px] font-bold text-muted">
                  This can take a few seconds. Keep this page open.
                </p>
              </div>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-muted">
                  You can go back to any question before you submit.
                </p>
                <ol className="mt-4 space-y-2.5">
                  {items.map((item, index) => {
                    const response = responseOf(item);
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-2xl border-2 border-line bg-white px-3 py-2.5"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-9 w-9 flex-none items-center justify-center rounded-xl text-sm font-black",
                            response ? "bg-accent-400 text-ink" : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {item.position}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 break-words text-sm font-bold text-muted sm:line-clamp-1">
                            <span className="sr-only">Question {item.position}: </span>
                            {item.question}
                          </p>
                          {response ? (
                            <p className="line-clamp-2 break-words text-[15px] font-extrabold text-ink">
                              {response}
                            </p>
                          ) : (
                            <p className="flex items-center gap-1.5 text-[15px] font-extrabold text-amber-700">
                              <CircleAlert className={BUTTON_ICON} aria-hidden="true" />
                              No answer
                            </p>
                          )}
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-none"
                          aria-label={`${response ? "Change" : "Answer"} question ${item.position}`}
                          onClick={() => goTo(index)}
                        >
                          {response ? "Change" : "Answer"}
                        </Button>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}

            {status === "confirming" && (
              <Alert
                tone="warning"
                title={`${questionsLabel(blankCount)} left blank`}
                className="mt-4 animate-pop"
              >
                Blank answers get no points, and you cannot change your answers after you
                submit.
              </Alert>
            )}
          </div>
        </div>

        <div className="border-t-2 border-line bg-canvas px-4 py-4 sm:px-6">
          {error && (
            <Alert tone="danger" className="mb-3">
              {error}
            </Alert>
          )}

          {/* The sentence sits above the buttons on a phone and on the review
              step, where the buttons are wide; otherwise beside them. */}
          <div
            className={cn(
              "flex flex-col gap-3",
              !reviewing && "sm:flex-row sm:items-center sm:justify-between sm:gap-4",
            )}
          >
            <p
              className="flex items-start gap-1.5 text-sm font-semibold text-muted sm:min-w-0 sm:flex-1"
              aria-live="polite"
            >
              <Info className={cn(BUTTON_ICON, "mt-0.5")} aria-hidden="true" />
              <span>
                You answered {total - blankCount} of {questionsLabel(total)}. You can submit only
                once.
              </span>
            </p>

            <div hidden={reviewing} className="flex items-center justify-between gap-3 sm:flex-none">
              <Button
                variant="secondary"
                className="flex-none"
                disabled={step === 0 || busy}
                onClick={() => goTo(step - 1)}
              >
                <ArrowLeft className={BUTTON_ICON} aria-hidden="true" />
                Back
              </Button>
              <Button className="flex-1 sm:flex-none" disabled={busy} onClick={() => goTo(step + 1)}>
                {step === total - 1 ? "Review answers" : "Next"}
                <ArrowRight className={BUTTON_ICON} aria-hidden="true" />
              </Button>
            </div>

            {/* On a phone the main button comes first, at full width. */}
            <div
              hidden={!reviewing}
              className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              {status === "confirming" ? (
                <>
                  {/* The keys make these new buttons, and focus starts on the
                      safe one, so a double press cannot submit blank answers. */}
                  <Button
                    key="answer-blanks"
                    variant="secondary"
                    size="lg"
                    className="w-full sm:w-auto"
                    autoFocus
                    onClick={() => goTo(Math.max(firstBlank, 0))}
                  >
                    Go back and answer
                  </Button>
                  <Button key="submit-anyway" type="submit" size="lg" className="w-full sm:w-auto">
                    Submit anyway
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    key="back"
                    variant="secondary"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={busy || total === 0}
                    onClick={() => goTo(total - 1)}
                  >
                    <ArrowLeft className={BUTTON_ICON} aria-hidden="true" />
                    Back
                  </Button>
                  <Button
                    key="submit"
                    type="submit"
                    size="lg"
                    className="w-full sm:w-auto"
                    loading={status === "submitting"}
                  >
                    {status === "submitting" ? "Checking your answers" : "Submit answers"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <aside
        aria-label="All questions"
        className={cn(
          ANSWER_SIDE_SLOT,
          "rounded-3xl border-2 border-line bg-white p-4 shadow-edge sm:p-5 lg:sticky lg:top-6",
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-extrabold text-ink">Questions</h3>
          {/* The same count as the progress bar below, which names it. */}
          <p
            aria-hidden="true"
            className="font-display text-lg font-extrabold leading-none text-brand-600"
          >
            {total - blankCount}
            <span className="text-sm text-muted"> of {total}</span>
          </p>
        </div>
        <p className="mt-0.5 text-sm font-semibold text-muted">Jump to any question.</p>
        <ProgressBar
          value={total - blankCount}
          max={total}
          label="Questions answered"
          className="mt-3"
        />
        <ol className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10 lg:grid-cols-5">
          {items.map((item, index) => {
            const answered = Boolean(responseOf(item));
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Question ${item.position}, ${answered ? "answered" : "not answered"}`}
                  aria-current={index === step ? "step" : undefined}
                  onClick={() => goTo(index)}
                  className={cn(
                    "relative flex h-11 w-full items-center justify-center rounded-xl border-2 text-sm font-black transition-[translate,background-color] duration-100 active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-60",
                    index === step
                      ? "border-brand-600 bg-brand-600 text-white"
                      : answered
                        ? "border-accent-500 bg-accent-400 text-ink hover:bg-accent-300"
                        : "border-line bg-white text-ink hover:bg-brand-50",
                  )}
                >
                  {item.position}
                  {/* The check says "answered" without relying on the colour. */}
                  {answered && (
                    <Check
                      className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-emerald-600 p-0.5 text-white"
                      strokeWidth={4}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        <ul
          aria-hidden="true"
          className="mt-3 flex flex-wrap gap-x-2.5 gap-y-1 text-xs font-bold text-muted"
        >
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-brand-600" />
            Current
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-accent-400" />
            Answered
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border-2 border-brand-200 bg-white" />
            Not answered
          </li>
        </ul>
        <Button
          variant="secondary"
          className="mt-4 w-full"
          disabled={busy || reviewing}
          onClick={() => goTo(total)}
        >
          <ClipboardCheck className={BUTTON_ICON} aria-hidden="true" />
          Review answers
        </Button>
      </aside>
    </form>
  );
}
