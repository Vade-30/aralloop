"use client";

// One item of a draft activity, as an editable card. All state lives in the
// parent editor; this component only reports changes.
//
// The card reads top to bottom as three groups: what the student is asked
// (question and answer type), what decides the score (the green panel), and
// what the student reads afterwards (the blue panel).

import {
  Check,
  CircleAlert,
  KeyRound,
  Lightbulb,
  Minus,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { LIMITS } from "@/lib/contracts";
import { Badge, Button, Card, Field, Input, Textarea, cn } from "@/components/ui";
import {
  ItemNumberTile,
  ItemStateChip,
  ItemTypeChip,
  choiceLetter,
  itemCardId,
  type ItemState,
} from "./EditorItemType";
import { EditorTypePicker } from "./EditorTypePicker";
import {
  MAX_CHOICES,
  MAX_POINTS,
  MIN_CHOICES,
  MIN_POINTS,
  addChoice,
  changeType,
  parseAccepted,
  parsePoints,
  removeChoice,
  type DraftItem,
} from "./editor-model";
import { plural } from "./format";

// Same look as the label that Field puts above a control.
const LEGEND_CLASS = "text-sm font-extrabold text-ink";
// The field that holds the correct answer. Important, to win over Input's own border.
const KEY_FIELD_CLASS = "border-emerald-500!";
const STEP_BUTTON_CLASS =
  "flex h-10 w-10 flex-none items-center justify-center text-emerald-800 transition-colors enabled:hover:bg-emerald-100 enabled:active:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40";

export function ItemEditor({
  item,
  number,
  problems,
  ready,
  disabled,
  canRemove,
  enterDelay = 0,
  onChange,
  onRemove,
}: {
  item: DraftItem;
  /** 1-based position, shown as "Item 3". */
  number: number;
  /** What the teacher still has to fix on this item. */
  problems: string[];
  /** Nothing is missing, whether or not the teacher has tried to save yet. */
  ready: boolean;
  disabled: boolean;
  canRemove: boolean;
  /** Milliseconds to wait before the card rises in, so a list appears in turn. */
  enterDelay?: number;
  onChange: (item: DraftItem) => void;
  onRemove: () => void;
}) {
  const id = itemCardId(item.key);
  const set = (patch: Partial<DraftItem>) => onChange({ ...item, ...patch });
  const points = parsePoints(item.points);
  const accepted = parseAccepted(item.accepted);
  const state: ItemState = problems.length > 0 ? "problem" : ready ? "ready" : "todo";

  // The buttons beside the points field. From a value that is not valid yet,
  // either button lands on the lowest allowed value.
  function stepPoints(delta: number) {
    const next = points === null ? MIN_POINTS : points + delta;
    set({ points: String(Math.min(MAX_POINTS, Math.max(MIN_POINTS, next))) });
  }

  return (
    <Card
      id={id}
      // Focusable from code only: the outline moves here when its tile is used.
      tabIndex={-1}
      style={{ animationDelay: `${enterDelay}ms` }}
      className={cn(
        "animate-rise scroll-mt-4 space-y-4 transition-[border-color,box-shadow] duration-200",
        problems.length > 0
          ? "border-red-300! shadow-[0_5px_0_#fecaca]!"
          : "focus-within:border-brand-300 focus-within:shadow-[0_5px_0_#bfd3fe]",
      )}
    >
      <div className="flex items-start gap-3">
        <ItemNumberTile number={number} type={item.type} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-extrabold leading-tight text-ink">Item {number}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <ItemTypeChip type={item.type} />
            {points !== null && (
              <Badge>
                <Star className="h-3.5 w-3.5" aria-hidden="true" />
                {plural(points, "point")}
              </Badge>
            )}
            <ItemStateChip state={state} />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="flex-none text-muted! enabled:hover:bg-red-50! enabled:hover:text-red-700!"
          disabled={disabled || !canRemove}
          onClick={onRemove}
          aria-label={`Remove item ${number}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {/* A phone has room for the bin only; the button's name stays "Remove item 3". */}
          <span className="hidden sm:inline">Remove item</span>
        </Button>
      </div>

      <Field label="Question" htmlFor={`${id}-question`}>
        <Textarea
          id={`${id}-question`}
          rows={3}
          value={item.question}
          maxLength={LIMITS.questionMax}
          disabled={disabled}
          onChange={(event) => set({ question: event.target.value })}
        />
      </Field>

      <EditorTypePicker
        name={`${id}-type`}
        value={item.type}
        disabled={disabled}
        onChange={(type) => onChange(changeType(item, type))}
      />

      {/* Everything that decides the score sits in one green panel. Keyed by
          type, so the panel rises in again when the answer type changes. */}
      <div
        key={item.type}
        className="animate-rise rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-3 sm:p-4"
      >
        {/* On a phone the points drop under the heading. */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-800">
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Answer key
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor={`${id}-points`} className={LEGEND_CLASS}>
              Points
            </label>
            {/* The three parts read as one control, so the focus outline of the
                number goes around all of it. */}
            <div className="flex items-center rounded-xl border-2 border-emerald-300 bg-white has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-500">
              <button
                type="button"
                className={cn(STEP_BUTTON_CLASS, "rounded-l-[10px]")}
                disabled={disabled || (points !== null && points <= MIN_POINTS)}
                aria-label={`One point less for item ${number}`}
                onClick={() => stepPoints(-1)}
              >
                <Minus className="h-4 w-4" strokeWidth={3.5} aria-hidden="true" />
              </button>
              {/* The browser's own small arrows are hidden; the two buttons do their job. */}
              <input
                id={`${id}-points`}
                type="number"
                inputMode="numeric"
                min={MIN_POINTS}
                max={MAX_POINTS}
                step={1}
                value={item.points}
                disabled={disabled}
                className="h-10 w-12 border-x-2 border-emerald-200 bg-white text-center font-display text-lg font-extrabold text-ink [appearance:textfield] focus-visible:outline-none! disabled:bg-slate-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                onChange={(event) => set({ points: event.target.value })}
              />
              <button
                type="button"
                className={cn(STEP_BUTTON_CLASS, "rounded-r-[10px]")}
                disabled={disabled || (points !== null && points >= MAX_POINTS)}
                aria-label={`One point more for item ${number}`}
                onClick={() => stepPoints(1)}
              >
                <Plus className="h-4 w-4" strokeWidth={3.5} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {item.type === "multiple_choice" && (
          <fieldset className="min-w-0">
            <legend className={cn(LEGEND_CLASS, "mb-1")}>Choices</legend>
            <p className="mb-3 text-xs font-semibold text-muted">
              Select the circle beside the correct choice.
            </p>
            <ul className="space-y-3">
              {item.choices.map((choice, index) => {
                const correct = item.correctIndex === index;
                return (
                  // Choices have no identity of their own; the index is their key.
                  <li key={index} className="flex items-center gap-1.5">
                    <label className="group relative flex h-11 w-10 shrink-0 cursor-pointer items-center justify-center has-[:disabled]:cursor-not-allowed">
                      {/* The real radio stays in the page for keyboards and screen
                          readers; the circle after it is what the teacher sees. */}
                      <input
                        type="radio"
                        name={`${id}-correct`}
                        className="peer sr-only"
                        checked={correct}
                        disabled={disabled}
                        onChange={() => set({ correctIndex: index })}
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-black transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 peer-disabled:opacity-60",
                          correct
                            ? "border-emerald-600 bg-emerald-600 text-white shadow-[0_3px_0_#047857]"
                            : "border-emerald-300 bg-white text-muted group-hover:border-emerald-600",
                        )}
                      >
                        {correct ? (
                          <Check className="h-5 w-5 animate-pop" strokeWidth={3.5} />
                        ) : (
                          choiceLetter(index)
                        )}
                      </span>
                      <span className="sr-only">Mark choice {index + 1} as correct</span>
                    </label>
                    <div className="relative min-w-0 flex-1">
                      <Input
                        aria-label={`Choice ${index + 1}`}
                        value={choice}
                        maxLength={LIMITS.choiceMax}
                        disabled={disabled}
                        className={cn("min-w-0", correct && KEY_FIELD_CLASS)}
                        onChange={(event) =>
                          set({
                            choices: item.choices.map((value, i) =>
                              i === index ? event.target.value : value,
                            ),
                          })
                        }
                      />
                      {correct && (
                        // A tab on the field's top edge, so green is not the only sign.
                        <span className="pointer-events-none absolute -top-2 right-3 rounded-md bg-emerald-700 px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white">
                          Correct answer
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors enabled:hover:bg-red-100 enabled:hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={disabled || item.choices.length <= MIN_CHOICES}
                      aria-label={`Remove choice ${index + 1}`}
                      onClick={() => onChange(removeChoice(item, index))}
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {item.choices.length < MAX_CHOICES && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                disabled={disabled}
                onClick={() => onChange(addChoice(item))}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add choice
              </Button>
            )}
          </fieldset>
        )}

        {item.type === "true_false" && (
          <fieldset className="min-w-0">
            <legend className={cn(LEGEND_CLASS, "mb-2")}>Correct answer</legend>
            <div className="grid grid-cols-2 gap-3 pb-1">
              {(["True", "False"] as const).map((value) => {
                const chosen = item.trueFalse === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      "relative flex min-h-13 cursor-pointer items-center gap-2.5 rounded-2xl border-2 bg-white px-3.5 text-[15px] font-extrabold transition-[border-color,box-shadow] duration-150 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
                      chosen
                        ? "border-emerald-600 text-emerald-900 shadow-[0_4px_0_#059669]"
                        : "border-line text-ink shadow-[0_4px_0_#e3e9f8] hover:border-emerald-300",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${id}-true-false`}
                      className="sr-only"
                      checked={chosen}
                      disabled={disabled}
                      onChange={() => set({ trueFalse: value })}
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 transition-colors",
                        chosen
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-emerald-300 bg-white text-transparent",
                      )}
                    >
                      <Check
                        className={cn("h-4 w-4", chosen && "animate-pop")}
                        strokeWidth={3.5}
                      />
                    </span>
                    {value}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {item.type === "identification" && (
          <div className="space-y-4">
            <Field label="Correct answer" htmlFor={`${id}-answer`}>
              <div className="relative">
                <Input
                  id={`${id}-answer`}
                  value={item.answer}
                  disabled={disabled}
                  className={cn("pl-10!", KEY_FIELD_CLASS)}
                  onChange={(event) => set({ answer: event.target.value })}
                />
                <Check
                  className={cn(
                    "pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors",
                    item.answer.trim() === "" ? "text-emerald-300" : "text-emerald-600",
                  )}
                  strokeWidth={3}
                  aria-hidden="true"
                />
              </div>
            </Field>
            <Field
              label="Also accept"
              htmlFor={`${id}-accepted`}
              hint="Other spellings or names that are also correct, separated by semicolons (;)."
            >
              <Input
                id={`${id}-accepted`}
                value={item.accepted}
                disabled={disabled}
                onChange={(event) => set({ accepted: event.target.value })}
              />
              {accepted.length > 0 && (
                // How the line above is read: one chip per accepted answer. The
                // field already says it all to a screen reader.
                <ul aria-hidden="true" className="mt-2 flex flex-wrap gap-1.5">
                  {accepted.map((value) => (
                    <li
                      key={value}
                      className="inline-flex max-w-full animate-pop items-center gap-1 rounded-lg border-2 border-emerald-200 bg-white px-2 py-0.5 text-xs font-extrabold text-emerald-800"
                    >
                      <Check className="h-3 w-3 flex-none" strokeWidth={4} />
                      <span className="min-w-0 break-words">{value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          </div>
        )}

        {item.type === "short_answer" && (
          <div className="space-y-4">
            <Field label="Model answer" htmlFor={`${id}-answer`}>
              <Textarea
                id={`${id}-answer`}
                rows={3}
                value={item.answer}
                maxLength={LIMITS.responseMax}
                disabled={disabled}
                className={KEY_FIELD_CLASS}
                onChange={(event) => set({ answer: event.target.value })}
              />
            </Field>
            <Field
              label="Rubric"
              htmlFor={`${id}-rubric`}
              hint="What an answer must include for full points. The AI grades against this. If you leave it empty, the model answer is used."
            >
              <Textarea
                id={`${id}-rubric`}
                rows={3}
                value={item.rubric}
                maxLength={LIMITS.feedbackMax}
                disabled={disabled}
                onChange={(event) => set({ rubric: event.target.value })}
              />
            </Field>
          </div>
        )}
      </div>

      {/* What the student reads afterwards: blue, like the same part of the published view. */}
      <div className="flex gap-3 rounded-2xl border-2 border-brand-100 bg-brand-50 p-3 sm:p-4">
        <span
          aria-hidden="true"
          className="hidden h-9 w-9 flex-none items-center justify-center rounded-xl bg-white text-brand-600 sm:flex"
        >
          <Lightbulb className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <Field
            label="Explanation"
            htmlFor={`${id}-explanation`}
            hint="Shown to students after they submit."
          >
            <Textarea
              id={`${id}-explanation`}
              rows={2}
              value={item.explanation}
              maxLength={LIMITS.feedbackMax}
              disabled={disabled}
              onChange={(event) => set({ explanation: event.target.value })}
            />
          </Field>
        </div>
      </div>

      {problems.length > 0 && (
        <ul
          role="alert"
          className="space-y-1.5 rounded-2xl border-2 border-red-200 bg-red-50 px-3.5 py-3 text-sm font-bold text-red-800"
        >
          {problems.map((problem) => (
            <li key={problem} className="flex gap-2">
              <CircleAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              <span className="min-w-0">{problem}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
