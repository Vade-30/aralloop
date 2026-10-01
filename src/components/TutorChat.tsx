"use client";

// The after-submission tutor, used on the student's results screen and the
// parent's summary screen. It only exists on screens for a submitted
// activity, and the API refuses to answer before submission, so it cannot be
// used to get answers during an activity.

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AiLabel,
  Alert,
  Button,
  Card,
  Field,
  Input,
  SectionTitle,
  Spinner,
  cn,
} from "@/components/ui";
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

function Bubble({ role, children }: { role: TutorMessage["role"]; children: string }) {
  const isUser = role === "user";
  return (
    <li className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm",
          isUser
            ? "rounded-br-sm bg-brand-600 text-white"
            : "rounded-bl-sm bg-slate-100 text-slate-900",
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

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Ask about this activity</SectionTitle>
        <AiLabel provider={activeProvider}>AI helper</AiLabel>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        This is an AI helper that explains this activity. It can make mistakes, so check
        with the teacher.
        {isSample &&
          " The app is in sample mode, so these are sample replies. Real answers need an AI key."}
      </p>

      <div
        ref={listRef}
        role="log"
        aria-label="Conversation with the AI helper"
        className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3"
      >
        <ul className="space-y-2">
          <Bubble role="assistant">{intro}</Bubble>
          {messages.map((message, index) => (
            <Bubble key={index} role={message.role}>
              {message.content}
            </Bubble>
          ))}
          {pendingQuestion !== null && <Bubble role="user">{pendingQuestion}</Bubble>}
          {sending && (
            <li className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5 text-sm text-slate-600">
                <Spinner className="h-4 w-4" />
                Writing a reply
              </div>
            </li>
          )}
        </ul>
      </div>

      {error && pendingQuestion !== null && !sending && (
        <Alert tone="danger" className="mt-3">
          <p>{error}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => void ask(pendingQuestion)}
          >
            Try again
          </Button>
        </Alert>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
          {suggestions.slice(0, SUGGESTION_MAX).map((suggestion) => (
            <li key={suggestion} className="max-w-full">
              <button
                type="button"
                disabled={sending}
                onClick={() => void ask(suggestion)}
                className="min-h-10 max-w-full rounded-full border border-brand-200 bg-brand-50 px-3.5 py-2 text-left text-sm font-medium text-brand-800 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="mt-4">
        <Field
          label="Your question"
          htmlFor={`tutor-question-${submissionId}`}
          hint={`Up to ${LIMITS.tutorQuestionMax} characters.`}
        >
          <div className="flex gap-2">
            <Input
              id={`tutor-question-${submissionId}`}
              type="text"
              value={draft}
              maxLength={LIMITS.tutorQuestionMax}
              autoComplete="off"
              placeholder="Type a question"
              className="min-w-0 flex-1"
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="submit" loading={sending} disabled={!draft.trim()}>
              Send
            </Button>
          </div>
        </Field>
      </form>
    </Card>
  );
}
