"use client";

// The after-submission tutor, used on the student's results screen and the
// parent's summary screen. It only exists on screens for a submitted
// activity, and the API refuses to answer before submission, so it cannot be
// used to get answers during an activity.

import {
  ArrowUp,
  Info,
  Lightbulb,
  MessagesSquare,
  RotateCw,
  SendHorizontal,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AiLabel, Alert, Button, Field, Spinner, cn } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import {
  LIMITS,
  type AskRequest,
  type AskResponse,
  type TutorMessage,
} from "@/lib/contracts";
import type { AiProviderName } from "@/lib/types";

/** The longest message the API accepts in the history. */
const HISTORY_CONTENT_MAX = 4_000;
const SUGGESTION_MAX = 3;
/** Delays that make the three typing dots bounce one after another. */
const DOT_DELAYS = [0, 150, 300];

// The sparkle stands for real AI, so sample mode gets a plain chat icon, the
// same way AiLabel drops the sparkle in sample mode.
function HelperIcon({ isSample, className }: { isSample: boolean; className: string }) {
  return isSample ? <MessagesSquare className={className} /> : <Sparkles className={className} />;
}

/** The helper's small avatar beside its messages. */
function HelperAvatar({ isSample }: { isSample: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="mb-[3px] flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-accent-400 text-ink"
    >
      <HelperIcon isSample={isSample} className="h-4 w-4" />
    </span>
  );
}

function Bubble({
  role,
  isSample,
  animate = false,
  failed = false,
  children,
}: {
  role: TutorMessage["role"];
  isSample: boolean;
  /** Pops out of its corner. Off for a sent question, which is already on screen. */
  animate?: boolean;
  /** A question that was not answered: it is shown paler, above the error. */
  failed?: boolean;
  children: string;
}) {
  const isUser = role === "user";
  return (
    <li className={cn("flex items-end gap-2", isUser && "justify-end")}>
      {!isUser && <HelperAvatar isSample={isSample} />}
      <div
        className={cn(
          // Long replies stay readable when the chat is as wide as a laptop.
          "min-w-0 max-w-[min(85%,36rem)] whitespace-pre-wrap break-words rounded-[1.25rem] px-3.5 py-2.5 text-[15px] font-semibold leading-relaxed transition-opacity",
          // It grows from the corner where its tail is.
          animate && "animate-pop",
          isUser
            ? "origin-bottom-right rounded-br-md bg-brand-600 text-white"
            : "origin-bottom-left rounded-bl-md border-2 border-line bg-white text-ink",
          failed && "opacity-60",
        )}
      >
        <span className="sr-only">{isUser ? "You: " : "AI helper: "}</span>
        {children}
      </div>
    </li>
  );
}

export function TutorChat({
  submissionId,
  provider,
  intro,
  suggestions,
}: {
  submissionId: string;
  /** The AI service in use; "mock" is the offline sample mode. */
  provider: AiProviderName;
  /** The helper's opening line. It is not sent to the API. */
  intro: string;
  /** Up to three questions offered as buttons before the first message. */
  suggestions: string[];
}) {
  // Completed question and reply pairs. This is what is sent as history.
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  // The question being answered, or the one that failed and can be retried.
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // A reply can come from the fallback service, so the label follows the reply.
  const [activeProvider, setActiveProvider] = useState(provider);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view without moving the page itself.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, pendingQuestion, sending, error]);

  async function ask(question: string) {
    const text = question.trim().slice(0, LIMITS.tutorQuestionMax);
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setPendingQuestion(text);
    try {
      const body: AskRequest = {
        question: text,
        history: messages.slice(-LIMITS.tutorHistoryMax).map((message) => ({
          role: message.role,
          content: message.content.slice(0, HISTORY_CONTENT_MAX),
        })),
      };
      const result = await api<AskResponse>(`/api/submissions/${submissionId}/ask`, {
        method: "POST",
        body,
      });
      setMessages((current) => [
        ...current,
        { role: "user", content: text },
        { role: "assistant", content: result.reply },
      ]);
      setActiveProvider(result.provider);
      setPendingQuestion(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    void ask(draft);
    setDraft("");
  }

  const isSample = activeProvider === "mock";
  const showSuggestions = messages.length === 0 && pendingQuestion === null;
  const failed = error !== null && pendingQuestion !== null && !sending;
  const inputId = `tutor-question-${submissionId}`;

  return (
    // The same look as the kit's Card, without its padding: the chat has a
    // header bar, a message area and an input bar that each reach the edges.
    // It is a size container, so the @lg: classes inside follow the width of
    // the chat itself: it is a narrow side column on some screens.
    <div className="@container overflow-hidden rounded-3xl border-2 border-line bg-white">
      <div className="relative isolate flex items-center gap-3 overflow-hidden bg-brand-900 px-4 py-3.5 @lg:px-5">
        <span
          aria-hidden="true"
          className="absolute -right-8 -top-20 -z-10 h-36 w-36 rounded-full bg-brand-600"
        />
        <span
          aria-hidden="true"
          className="absolute -bottom-5 right-24 -z-10 h-9 w-9 rounded-full bg-accent-400"
        />
        <span
          aria-hidden="true"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-accent-400 text-ink"
        >
          <HelperIcon isSample={isSample} className="h-6 w-6" />
        </span>
        {/* Title over label in a narrow column, side by side in a wide one. */}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1 @lg:flex-row @lg:items-center @lg:justify-between @lg:gap-3">
          <h2 className="min-w-0 text-xl font-extrabold leading-tight text-white @lg:text-2xl">
            Ask about this activity
          </h2>
          <AiLabel provider={activeProvider}>AI helper</AiLabel>
        </div>
      </div>

      <p className="flex items-start gap-2 border-b-2 border-line bg-brand-50 px-4 py-2.5 text-[13px] font-semibold leading-snug text-muted @lg:px-5">
        <Info className="mt-0.5 h-4 w-4 flex-none text-brand-600" aria-hidden="true" />
        <span>
          This is an AI helper that explains this activity. It can make mistakes, so check
          with the teacher.
          {isSample &&
            " The app is in sample mode, so these are sample replies. Real answers need an AI key."}
        </span>
      </p>

      {/* A faint grid of dots, like the paper of an exercise book. */}
      <div className="bg-canvas bg-[radial-gradient(var(--color-brand-100)_1.25px,transparent_1.25px)] [background-size:18px_18px]">
        <div
          ref={listRef}
          role="log"
          aria-label="Conversation with the AI helper"
          // Shorter on a short screen, so the whole chat fits beside the page
          // without a second scrollbar. Messages fade out at the top and bottom
          // edges as they scroll; the fade is no deeper than the padding, so
          // nothing is dimmed while the list is at rest.
          className="max-h-[clamp(12rem,42dvh,24rem)] overflow-y-auto px-3 py-4 [mask-image:linear-gradient(to_bottom,transparent,black_0.875rem,black_calc(100%-0.875rem),transparent)] motion-safe:scroll-smooth @lg:max-h-[clamp(12rem,50dvh,28rem)] @lg:px-5"
        >
          <ul className="space-y-3.5">
            <Bubble role="assistant" isSample={isSample} animate>
              {intro}
            </Bubble>
            {messages.map((message, index) => (
              <Bubble
                key={index}
                role={message.role}
                isSample={isSample}
                animate={message.role === "assistant"}
              >
                {message.content}
              </Bubble>
            ))}
            {pendingQuestion !== null && (
              <Bubble role="user" isSample={isSample} animate failed={failed}>
                {pendingQuestion}
              </Bubble>
            )}
            {sending && (
              <li className="flex items-end gap-2">
                <HelperAvatar isSample={isSample} />
                <div className="flex origin-bottom-left animate-pop items-center gap-2.5 rounded-[1.25rem] rounded-bl-md border-2 border-line bg-white px-3.5 py-2.5 text-sm font-bold text-muted">
                  <span aria-hidden="true" className="flex items-center gap-1">
                    {DOT_DELAYS.map((delay) => (
                      <span
                        key={delay}
                        className="h-2 w-2 animate-dot rounded-full bg-brand-500"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </span>
                  Writing a reply
                </div>
              </li>
            )}
            {/* The error sits in the conversation, under the question it is about. */}
            {failed && (
              <li className="flex justify-end">
                <Alert
                  tone="danger"
                  className="w-full max-w-[min(100%,30rem)] origin-top-right animate-pop rounded-tr-md"
                >
                  <p className="flex min-w-0 items-start gap-2">
                    <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                    <span className="min-w-0 break-words">{error}</span>
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2.5"
                    onClick={() => void ask(pendingQuestion)}
                  >
                    <RotateCw className="h-4 w-4" aria-hidden="true" />
                    Try again
                  </Button>
                </Alert>
              </li>
            )}
          </ul>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="px-3 pb-4 @lg:px-5">
            {/* The list below carries the same words as its label. */}
            <p
              aria-hidden="true"
              className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-muted"
            >
              <Lightbulb className="h-3.5 w-3.5 text-accent-600" />
              Suggested questions
            </p>
            {/* A tidy stack in a narrow column, a row of pills in a wide one. */}
            <ul
              className="flex flex-col gap-2 @lg:flex-row @lg:flex-wrap @lg:gap-2.5"
              aria-label="Suggested questions"
            >
              {suggestions.slice(0, SUGGESTION_MAX).map((suggestion, index) => (
                <li
                  key={suggestion}
                  className="max-w-full animate-rise"
                  style={{ animationDelay: `${150 + index * 80}ms` }}
                >
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => void ask(suggestion)}
                    className="group flex min-h-11 w-full max-w-full items-center gap-2.5 rounded-[1.25rem] border-2 border-brand-200 bg-white py-1.5 pl-4 pr-1.5 text-left text-sm font-extrabold text-brand-800 shadow-edge-sm transition-[translate,box-shadow,background-color,border-color] duration-100 hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50 active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1 break-words">{suggestion}</span>
                    {/* Tapping a suggestion sends it straight away. */}
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-colors duration-100 group-hover:bg-accent-400 group-hover:text-ink"
                    >
                      <ArrowUp className="h-4 w-4" strokeWidth={3} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t-2 border-line px-4 pb-4 pt-3.5 @lg:px-5">
        <Field
          label="Your question"
          htmlFor={inputId}
          hint={
            <span className="flex justify-between gap-3">
              <span>{`Up to ${LIMITS.tutorQuestionMax} characters.`}</span>
              {/* A running count for sighted users; the limit is already said in words. */}
              <span aria-hidden="true" className="tabular-nums">
                {draft.length} / {LIMITS.tutorQuestionMax}
              </span>
            </span>
          }
        >
          {/* One bar holds the box and the button, as in a chat app. The bar
              shows the keyboard focus, so the box inside drops its own outline. */}
          <div className="flex items-center gap-2 rounded-[1.25rem] border-2 border-line bg-white p-1.5 pl-4 transition-[border-color,box-shadow] duration-100 has-[input:focus-visible]:border-brand-600 has-[input:focus-visible]:ring-4 has-[input:focus-visible]:ring-brand-200">
            <input
              id={inputId}
              type="text"
              value={draft}
              maxLength={LIMITS.tutorQuestionMax}
              autoComplete="off"
              enterKeyHint="send"
              placeholder="Type a question"
              className="min-w-0 flex-1 bg-transparent py-2 text-base font-semibold text-ink outline-none! placeholder:font-medium placeholder:text-slate-500"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-busy={sending || undefined}
              className="inline-flex min-h-11 flex-none items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 text-[15px] font-extrabold text-white transition-[background-color,scale] duration-100 hover:bg-brand-500 active:scale-95 disabled:cursor-not-allowed disabled:bg-brand-100 disabled:text-brand-400 disabled:active:scale-100"
            >
              {sending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <SendHorizontal className="h-4 w-4" aria-hidden="true" />
              )}
              Send
            </button>
          </div>
        </Field>
      </form>
    </div>
  );
}
