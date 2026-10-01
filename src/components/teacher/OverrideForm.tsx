"use client";

// Teacher override for one answer: set the score and the feedback the student
// and parent will see. Open by default when the answer is waiting for review.

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/client-api";
import { LIMITS, type OverrideAnswerRequest } from "@/lib/contracts";
import { Alert, Button, Field, Input, Textarea, formatScore } from "@/components/ui";

/** What the arrows on the score field move by; any score in range is accepted. */
const SCORE_STEP = 0.5;

export function OverrideForm({
  answerId,
  points,
  score: currentScore,
  feedback: currentFeedback,
  needsReview,
}: {
  answerId: string;
  /** The most this item is worth. */
  points: number;
  score: number;
  feedback: string;
  needsReview: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(needsReview);
  // Not formatScore: an AI score such as 1.25 must not be rounded on the way in.
  const [score, setScore] = useState(String(Math.round(currentScore * 100) / 100));
  const [feedback, setFeedback] = useState(currentFeedback);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): OverrideAnswerRequest | string {
    const value = Number(score);
    if (score.trim() === "" || !Number.isFinite(value)) return "Enter a score.";
    if (value < 0 || value > points) {
      return `Enter a score from 0 to ${formatScore(points)}.`;
    }
    if (feedback.trim().length > LIMITS.feedbackMax) {
      return `Shorten the feedback to ${LIMITS.feedbackMax} characters or fewer.`;
    }
    return { score: value, feedback: feedback.trim() };
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const body = validate();
    if (typeof body === "string") {
      setError(body);
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api<unknown>(`/api/answers/${encodeURIComponent(answerId)}`, {
        method: "PATCH",
        body,
      });
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Change score
      </Button>
    );
  }

  const scoreId = `score-${answerId}`;
  const feedbackId = `feedback-${answerId}`;

  return (
    <form onSubmit={save} noValidate className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <Field label={`Score (out of ${formatScore(points)})`} htmlFor={scoreId}>
          <Input
            id={scoreId}
            type="number"
            inputMode="decimal"
            min={0}
            max={points}
            step={SCORE_STEP}
            value={score}
            disabled={saving}
            onChange={(event) => {
              setScore(event.target.value);
              setSaved(false);
            }}
          />
        </Field>
        <Field label="Feedback for the student" htmlFor={feedbackId}>
          <Textarea
            id={feedbackId}
            rows={3}
            value={feedback}
            maxLength={LIMITS.feedbackMax}
            disabled={saving}
            onChange={(event) => {
              setFeedback(event.target.value);
              setSaved(false);
            }}
          />
        </Field>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">Score saved.</Alert>}
      <Button type="submit" size="sm" loading={saving}>
        Save score
      </Button>
      <p className="text-xs text-slate-500">
        Saving a score updates the student&apos;s total. The parent summary is rewritten the next
        time the parent opens it.
      </p>
    </form>
  );
}
