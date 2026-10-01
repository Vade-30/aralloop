// Read-only view of a published activity with its answer key. Teacher only:
// this component must never be rendered for a student.

import {
  ArrowRight,
  CalendarCheck,
  ChartColumn,
  Check,
  ClipboardCheck,
  KeyRound,
  Lightbulb,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { ACTIVITY_TYPE_LABELS, type ActivityWithItems, type Item } from "@/lib/types";
import { AiLabel, Badge, ButtonLink, Card, SectionTitle, cn } from "@/components/ui";
import { ItemNumberTile, ItemTypeChip, choiceLetter, itemCardId } from "./EditorItemType";
import { EditorOutline } from "./EditorOutline";
import { EditorReason } from "./EditorReason";
import { EditorSummary } from "./EditorSummary";
import { formatDate, plural } from "./format";

const DETAIL_TONES = {
  // The answer key itself: green, like the correct choice above it.
  key: { box: "border-emerald-200 bg-emerald-50", label: "text-emerald-800" },
  // What the student gets to read afterwards.
  note: { box: "border-brand-100 bg-brand-50", label: "text-brand-800" },
  plain: { box: "border-line bg-canvas", label: "text-muted" },
};

function Detail({
  label,
  icon: Icon,
  tone = "plain",
  children,
}: {
  label: string;
  icon: LucideIcon;
  tone?: keyof typeof DETAIL_TONES;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border-2 px-3.5 py-3", DETAIL_TONES[tone].box)}>
      <dt
        className={cn(
          "flex items-center gap-1.5 text-xs font-black uppercase tracking-wide",
          DETAIL_TONES[tone].label,
        )}
      >
        <Icon className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-ink">
        {children}
      </dd>
    </div>
  );
}

function ItemCard({ item, index }: { item: Item; index: number }) {
  return (
    <Card
      id={itemCardId(item.id)}
      // Focusable from code only: the outline moves here when its tile is used.
      tabIndex={-1}
      className="animate-rise scroll-mt-4 space-y-4 transition-[border-color,box-shadow] duration-200 focus:border-brand-300 focus:shadow-[0_5px_0_#bfd3fe]"
      style={{ animationDelay: `${160 + Math.min(index, 8) * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        <ItemNumberTile number={item.position} type={item.type} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-extrabold leading-tight text-ink">Item {item.position}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <ItemTypeChip type={item.type} />
            <Badge>
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              {plural(item.points, "point")}
            </Badge>
          </div>
        </div>
      </div>
      <p className="whitespace-pre-wrap break-words text-base font-bold text-ink sm:text-[17px]">
        {item.question}
      </p>

      {item.choices ? (
        <ul className="space-y-2.5">
          {item.choices.map((choice, choiceIndex) => {
            const correct = choice === item.answerKey;
            // A, B, C for choices; True and False show their own first letter.
            const marker =
              item.type === "multiple_choice" ? choiceLetter(choiceIndex) : choice.charAt(0);
            return (
              <li
                key={choiceIndex}
                className={cn(
                  "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border-2 px-3 py-2.5 text-sm font-bold",
                  correct
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-[0_3px_0_#10b981]"
                    : "border-line bg-white text-ink",
                )}
              >
                {/* Marker and text stay together; beside a long choice the badge
                    drops to its own line instead of squeezing the text. */}
                <span className="flex min-w-0 flex-auto items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-7 w-7 flex-none items-center justify-center rounded-lg text-xs font-black",
                      correct ? "bg-emerald-600 text-white" : "bg-brand-50 text-brand-800",
                    )}
                  >
                    {correct ? <Check className="h-4 w-4" strokeWidth={3.5} /> : marker}
                  </span>
                  <span className="min-w-0 break-words">{choice}</span>
                </span>
                {correct && <Badge tone="success">Correct answer</Badge>}
              </li>
            );
          })}
        </ul>
      ) : null}

      <dl className="space-y-3">
        {/* Also covers a choice item whose key matches none of its choices. */}
        {(!item.choices || !item.choices.includes(item.answerKey)) && (
          <Detail
            label={item.type === "short_answer" ? "Model answer" : "Correct answer"}
            icon={KeyRound}
            tone="key"
          >
            {item.answerKey}
          </Detail>
        )}
        {item.acceptedAnswers.length > 0 && (
          <Detail label="Also accepted" icon={Check} tone="key">
            {item.acceptedAnswers.join(", ")}
          </Detail>
        )}
        {item.rubric && (
          <Detail label="Rubric" icon={ClipboardCheck}>
            {item.rubric}
          </Detail>
        )}
        {item.explanation && (
          <Detail label="Explanation shown after submitting" icon={Lightbulb} tone="note">
            {item.explanation}
          </Detail>
        )}
      </dl>
    </Card>
  );
}

/** The way on from the answer key. Blue: the yellow main button is the one in the header. */
function ResultsLink({ activityId }: { activityId: string }) {
  return (
    <ButtonLink
      href={`/teacher/activities/${activityId}/results`}
      variant="brand"
      size="lg"
      className="w-full"
    >
      <ChartColumn className="h-5 w-5" aria-hidden="true" />
      View results
      <ArrowRight className="h-5 w-5" aria-hidden="true" />
    </ButtonLink>
  );
}

export function PublishedActivity({ activity }: { activity: ActivityWithItems }) {
  const publishedOn = activity.publishedAt ? formatDate(activity.publishedAt) : "";

  return (
    // The summary comes first, so it leads on a phone. From a laptop up it
    // moves to a side panel that stays in view beside the items.
    <div className="relative flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
      <aside
        aria-label="Summary"
        className="lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1"
      >
        <EditorSummary
          entries={activity.items.map(({ type, points }) => ({ type, points }))}
          status={
            <Badge tone="success">
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
              Published
            </Badge>
          }
          badges={
            <>
              <Badge tone="brand">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
              <AiLabel provider={activity.aiProvider}>AI-generated · reviewed by teacher</AiLabel>
            </>
          }
          className="animate-rise [animation-delay:40ms]"
        >
          {publishedOn && (
            <p className="flex items-center gap-2 text-xs font-bold text-muted">
              <CalendarCheck className="h-4 w-4 flex-none text-brand-600" aria-hidden="true" />
              Published on {publishedOn}
            </p>
          )}
        </EditorSummary>
        {/* On a laptop the header's button scrolls away with the page; this one
            stays beside the items. A phone gets it after the last item instead. */}
        <div className="mt-4 hidden animate-rise pb-1.5 [animation-delay:120ms] lg:block">
          <ResultsLink activityId={activity.id} />
        </div>
      </aside>

      <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
        {activity.aiReason && (
          <EditorReason
            provider={activity.aiProvider}
            reason={activity.aiReason}
            className="animate-rise"
          />
        )}

        {activity.instructions && (
          <Card className="relative animate-rise [animation-delay:80ms]">
            <SectionTitle>Instructions</SectionTitle>
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] font-semibold text-ink">
              {activity.instructions}
            </p>
          </Card>
        )}

        {/* With nothing above it, the heading would sit on the blue band on a laptop. */}
        <SectionTitle className="pt-2 lg:first:pt-16">
          Items and answer key{" "}
          <span className="font-sans text-base font-bold text-muted">
            ({activity.items.length})
          </span>
        </SectionTitle>

        {/* The outline is a row above the items on a phone and a rail beside
            them on a laptop, where it stays in view while the items scroll. */}
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[2.5rem_minmax(0,1fr)] lg:items-start">
          <EditorOutline
            entries={activity.items.map((item) => ({
              id: itemCardId(item.id),
              number: item.position,
              type: item.type,
              title: item.question,
            }))}
            className="lg:sticky lg:top-4"
          />
          <div className="min-w-0 space-y-4">
            {activity.items.map((item, index) => (
              <ItemCard key={item.id} item={item} index={index} />
            ))}
            <div className="pb-1.5 lg:hidden">
              <ResultsLink activityId={activity.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
