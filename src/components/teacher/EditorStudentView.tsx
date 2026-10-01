// The draft as a student will get it, for the teacher to check before
// publishing: each question with its choices or an empty answer box, and no
// answer key, rubric or explanation. Read-only, and it follows the teacher's
// edits. Teacher only; it is drawn from the draft, never sent to a student.
// No hooks, so it works in server and client components alike.

import { Eye } from "lucide-react";
import { ITEM_TYPE_LABELS } from "@/lib/types";
import { Badge, cn } from "@/components/ui";
import { choiceLetter, itemCardId } from "./EditorItemType";
import { parsePoints, type DraftItem } from "./editor-model";
import { plural } from "./format";

const TRUE_FALSE = ["True", "False"];

/** What a student picks from, or null for an answer they type. */
function choicesOf(item: DraftItem): string[] | null {
  if (item.type === "multiple_choice") return item.choices.map((choice) => choice.trim());
  if (item.type === "true_false") return TRUE_FALSE;
  return null;
}

function Empty({ children }: { children: string }) {
  return <span className="font-sans text-[15px] font-semibold italic text-muted">{children}</span>;
}

function StudentItem({ item, number, total }: { item: DraftItem; number: number; total: number }) {
  const question = item.question.trim();
  const points = parsePoints(item.points);
  const choices = choicesOf(item);

  return (
    <article
      id={itemCardId(item.key)}
      tabIndex={-1}
      style={{ animationDelay: `${Math.min(number - 1, 8) * 60}ms` }}
      className="animate-rise scroll-mt-4 overflow-hidden rounded-3xl border-2 border-line bg-white shadow-edge"
    >
      <div className="bg-brand-900 px-4 py-3 sm:px-5">
        {/* The same heading as on the student's own screen. */}
        <h3 className="text-base font-extrabold uppercase tracking-widest text-accent-400">
          Question {number} of {total}
        </h3>
        {/* One segment per question, with this one lit. Decoration: the heading says it. */}
        <div aria-hidden="true" className="mt-2 flex gap-1">
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 min-w-0 flex-1 rounded-full",
                index === number - 1 ? "bg-accent-400" : "bg-white/25",
              )}
            />
          ))}
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <p className="flex flex-wrap gap-2">
          <Badge tone="brand">{ITEM_TYPE_LABELS[item.type]}</Badge>
          {points !== null && <Badge tone="warning">{plural(points, "point")}</Badge>}
        </p>
        <p className="mt-3 whitespace-pre-wrap break-words font-display text-xl font-bold leading-snug text-ink">
          {question || <Empty>No question yet</Empty>}
        </p>

        {choices ? (
          // An even number of options pairs up on wide screens, as it does for students.
          <ul className={cn("mt-4 grid gap-2.5 pb-1", choices.length % 2 === 0 && "sm:grid-cols-2")}>
            {choices.map((choice, index) => (
              <li
                key={index}
                className="flex min-h-13 items-center gap-3 rounded-2xl border-2 border-line bg-white px-3.5 py-2.5 text-[15px] font-extrabold text-ink shadow-edge-sm"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-brand-100 text-sm font-black text-brand-800"
                >
                  {choiceLetter(index)}
                </span>
                <span className="min-w-0 flex-1 break-words">
                  {choice || <Empty>Empty choice</Empty>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          // Stands for the box the student types in; it shows that box's own hint.
          <p
            className={cn(
              "mt-4 rounded-2xl border-2 border-line bg-white px-4 py-3 text-base font-semibold text-slate-500 shadow-edge-sm",
              item.type === "short_answer" ? "min-h-28" : "min-h-13",
            )}
          >
            {item.type === "short_answer"
              ? "Write your answer in your own words"
              : "Type your answer"}
          </p>
        )}
      </div>
    </article>
  );
}

export function EditorStudentView({ items }: { items: DraftItem[] }) {
  return (
    <>
      <p className="flex animate-rise items-start gap-2.5 rounded-2xl border-2 border-brand-200 bg-brand-50 px-3.5 py-3 text-sm font-semibold text-brand-900">
        <Eye className="mt-0.5 h-4 w-4 flex-none text-brand-600" aria-hidden="true" />
        <span>
          <strong className="font-extrabold">
            Students get one question at a time, without the answer key.
          </strong>{" "}
          Switch back to Edit to change anything.
        </span>
      </p>
      {items.map((item, index) => (
        <StudentItem key={item.key} item={item} number={index + 1} total={items.length} />
      ))}
    </>
  );
}
