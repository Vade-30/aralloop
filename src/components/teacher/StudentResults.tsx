// Results page: every student in the class, and for those who submitted,
// each answer with how it was graded and a form to change the score.

import {
  ITEM_TYPE_LABELS,
  type AiProviderName,
  type Answer,
  type Item,
  type SubmissionWithAnswers,
  type User,
} from "@/lib/types";
import { AiLabel, Badge, Score, cn } from "@/components/ui";
import { OverrideForm } from "./OverrideForm";
import { answerRows, formatPercent } from "./results-model";
import { StudentDetails } from "./StudentDetails";

function GradedBy({ answer, aiProvider }: { answer: Answer; aiProvider: AiProviderName }) {
  switch (answer.gradedBy) {
    case "code":
      return <Badge>Checked by answer key</Badge>;
    case "teacher":
      return <Badge tone="brand">Set by teacher</Badge>;
    case "pending":
      return <Badge tone="warning">Waiting for teacher</Badge>;
    case "ai":
      return (
        <>
          <AiLabel provider={aiProvider}>Graded by AI</AiLabel>
          {answer.confidence !== null && (
            <span className="text-xs text-slate-600">
              Confidence {formatPercent(answer.confidence)}
            </span>
          )}
        </>
      );
  }
}

function Row({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function AnswerCard({
  answer,
  item,
  aiProvider,
}: {
  answer: Answer;
  item: Item;
  aiProvider: AiProviderName;
}) {
  return (
    <li
      className={cn(
        "space-y-3 rounded-lg border p-3",
        answer.needsReview ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <h4 className="mr-1 text-sm font-semibold text-slate-900">Item {item.position}</h4>
          <Badge>{ITEM_TYPE_LABELS[item.type]}</Badge>
          {answer.needsReview && <Badge tone="warning">Needs your review</Badge>}
        </div>
        <Score score={answer.score} max={item.points} />
      </div>

      {answer.needsReview && (
        <p className="text-sm text-amber-900">
          {answer.gradedBy === "pending"
            ? "The AI could not grade this answer. Read it and set the score."
            : "The AI was not sure about this grade. Check it and save the score you agree with."}
        </p>
      )}

      <p className="whitespace-pre-wrap break-words text-sm font-medium text-slate-900">
        {item.question}
      </p>

      <dl className="space-y-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Student&apos;s answer
          </dt>
          <dd
            className={cn(
              "mt-0.5 whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm",
              answer.response.trim() === "" ? "italic text-slate-500" : "text-slate-900",
            )}
          >
            {answer.response.trim() === "" ? "No answer" : answer.response}
          </dd>
        </div>
        <Row label={item.type === "short_answer" ? "Model answer" : "Correct answer"}>
          {item.answerKey}
        </Row>
        {item.acceptedAnswers.length > 0 && (
          <Row label="Also accepted">{item.acceptedAnswers.join(", ")}</Row>
        )}
        {item.rubric && <Row label="Rubric">{item.rubric}</Row>}
        {answer.feedback && <Row label="Feedback">{answer.feedback}</Row>}
      </dl>

      <div className="flex flex-wrap items-center gap-1.5">
        <GradedBy answer={answer} aiProvider={aiProvider} />
      </div>

      <OverrideForm
        answerId={answer.id}
        points={item.points}
        score={answer.score}
        feedback={answer.feedback}
        needsReview={answer.needsReview}
      />
    </li>
  );
}

export function StudentResults({
  students,
  submissions,
  items,
  aiProvider,
}: {
  students: User[];
  submissions: SubmissionWithAnswers[];
  items: Item[];
  /**
   * The AI service in use now. Answers do not record which service graded
   * them, so this decides whether AI grades are labelled as sample output.
   */
  aiProvider: AiProviderName;
}) {
  const byStudent = new Map(submissions.map((submission) => [submission.studentId, submission]));

  return (
    <ul className="space-y-2">
      {students.map((student) => {
        const submission = byStudent.get(student.id);
        if (!submission) {
          return (
            <li
              key={student.id}
              className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-slate-500"
            >
              <span className="min-w-0 break-words">{student.name}</span>
              <span className="text-sm">Not submitted yet</span>
            </li>
          );
        }

        const rows = answerRows(submission, items);
        const toReview = rows.filter((row) => row.answer.needsReview).length;
        return (
          <li key={student.id}>
            <StudentDetails
              defaultOpen={toReview > 0 || submission.needsReview}
              summary={
                <>
                  <span className="min-w-0 break-words font-medium text-slate-900">
                    {student.name}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {(toReview > 0 || submission.needsReview) && (
                      <Badge tone="warning">
                        {toReview > 0 ? `${toReview} to review` : "To review"}
                      </Badge>
                    )}
                    <Score score={submission.totalScore} max={submission.maxScore} />
                  </span>
                </>
              }
            >
              <ul className="space-y-3">
                {rows.map(({ answer, item }) => (
                  <AnswerCard key={answer.id} answer={answer} item={item} aiProvider={aiProvider} />
                ))}
              </ul>
            </StudentDetails>
          </li>
        );
      })}
    </ul>
  );
}
