// Read-only view of a published activity with its answer key. Teacher only:
// this component must never be rendered for a student.

import {
  ACTIVITY_TYPE_LABELS,
  ITEM_TYPE_LABELS,
  type ActivityWithItems,
  type Item,
} from "@/lib/types";
import { AiLabel, Alert, Badge, Card, SectionTitle, cn } from "@/components/ui";
import { plural } from "./format";

function Detail({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <h3 className="mr-1 font-semibold text-slate-900">Item {item.position}</h3>
        <Badge>{ITEM_TYPE_LABELS[item.type]}</Badge>
        <Badge>{plural(item.points, "point")}</Badge>
      </div>
      <p className="whitespace-pre-wrap break-words text-slate-900">{item.question}</p>

      {item.choices ? (
        <ul className="space-y-1.5">
          {item.choices.map((choice, index) => {
            const correct = choice === item.answerKey;
            return (
              <li
                key={index}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                  correct
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 text-slate-800",
                )}
              >
                <span className="min-w-0 break-words">{choice}</span>
                {correct && <Badge tone="success">Correct answer</Badge>}
              </li>
            );
          })}
        </ul>
      ) : null}

      <dl className="space-y-3">
        {/* Also covers a choice item whose key matches none of its choices. */}
        {(!item.choices || !item.choices.includes(item.answerKey)) && (
          <Detail label={item.type === "short_answer" ? "Model answer" : "Correct answer"}>
            {item.answerKey}
          </Detail>
        )}
        {item.acceptedAnswers.length > 0 && (
          <Detail label="Also accepted">{item.acceptedAnswers.join(", ")}</Detail>
        )}
        {item.rubric && <Detail label="Rubric">{item.rubric}</Detail>}
        {item.explanation && (
          <Detail label="Explanation shown after submitting">{item.explanation}</Detail>
        )}
      </dl>
    </Card>
  );
}

export function PublishedActivity({ activity }: { activity: ActivityWithItems }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="success">Published</Badge>
        <Badge tone="brand">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
        <AiLabel provider={activity.aiProvider}>AI-generated · reviewed by teacher</AiLabel>
      </div>

      {activity.aiReason && (
        <Alert tone="info" title="Why this format">
          {activity.aiReason}
        </Alert>
      )}

      {activity.instructions && (
        <Card>
          <SectionTitle>Instructions</SectionTitle>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">
            {activity.instructions}
          </p>
        </Card>
      )}

      <SectionTitle>
        Items and answer key{" "}
        <span className="font-normal text-slate-500">({activity.items.length})</span>
      </SectionTitle>
      {activity.items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
