"use client";

// One item of a draft activity, as an editable card. All state lives in the
// parent editor; this component only reports changes.

import { LIMITS } from "@/lib/contracts";
import { ITEM_TYPES, ITEM_TYPE_LABELS, type ItemType } from "@/lib/types";
import { Button, Card, Field, Input, Select, Textarea, cn } from "@/components/ui";
import {
  MAX_CHOICES,
  MAX_POINTS,
  MIN_CHOICES,
  MIN_POINTS,
  addChoice,
  changeType,
  removeChoice,
  type DraftItem,
} from "./editor-model";

function isItemType(value: string): value is ItemType {
  return ITEM_TYPES.some((type) => type === value);
}

/** The DOM id of an item's card, used to scroll to the first problem. */
export function itemCardId(key: string): string {
  return `item-${key}`;
}

export function ItemEditor({
  item,
  number,
  problems,
  disabled,
  canRemove,
  onChange,
  onRemove,
}: {
  item: DraftItem;
  /** 1-based position, shown as "Item 3". */
  number: number;
  /** What the teacher still has to fix on this item. */
  problems: string[];
  disabled: boolean;
  canRemove: boolean;
  onChange: (item: DraftItem) => void;
  onRemove: () => void;
}) {
  const id = itemCardId(item.key);
  const set = (patch: Partial<DraftItem>) => onChange({ ...item, ...patch });

  return (
    <Card
      id={id}
      className={cn("scroll-mt-4 space-y-4", problems.length > 0 && "ring-2 ring-red-300")}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">Item {number}</h3>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || !canRemove}
          onClick={onRemove}
          aria-label={`Remove item ${number}`}
        >
          Remove item
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

      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
        <Field label="Answer type" htmlFor={`${id}-type`}>
          <Select
            id={`${id}-type`}
            value={item.type}
            disabled={disabled}
            onChange={(event) => {
              if (isItemType(event.target.value)) onChange(changeType(item, event.target.value));
            }}
          >
            {ITEM_TYPES.map((type) => (
              <option key={type} value={type}>
                {ITEM_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Points" htmlFor={`${id}-points`}>
          <Input
            id={`${id}-points`}
            type="number"
            inputMode="numeric"
            min={MIN_POINTS}
            max={MAX_POINTS}
            step={1}
            value={item.points}
            disabled={disabled}
            onChange={(event) => set({ points: event.target.value })}
          />
        </Field>
      </div>

      {item.type === "multiple_choice" && (
        <fieldset className="min-w-0">
          <legend className="mb-1 text-sm font-medium text-slate-800">Choices</legend>
          <p className="mb-2 text-xs text-slate-500">Select the circle beside the correct choice.</p>
          <ul className="space-y-2">
            {item.choices.map((choice, index) => (
              // Choices have no identity of their own; the index is their key.
              <li key={index} className="flex items-center gap-1">
                <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="radio"
                    name={`${id}-correct`}
                    className="h-5 w-5 accent-brand-600"
                    checked={item.correctIndex === index}
                    disabled={disabled}
                    onChange={() => set({ correctIndex: index })}
                  />
                  <span className="sr-only">Mark choice {index + 1} as correct</span>
                </label>
                <Input
                  aria-label={`Choice ${index + 1}`}
                  value={choice}
                  maxLength={LIMITS.choiceMax}
                  disabled={disabled}
                  className={cn("min-w-0", item.correctIndex === index && "ring-2 ring-emerald-500")}
                  onChange={(event) =>
                    set({
                      choices: item.choices.map((value, i) =>
                        i === index ? event.target.value : value,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={disabled || item.choices.length <= MIN_CHOICES}
                  aria-label={`Remove choice ${index + 1}`}
                  onClick={() => onChange(removeChoice(item, index))}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
          {item.choices.length < MAX_CHOICES && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              disabled={disabled}
              onClick={() => onChange(addChoice(item))}
            >
              Add choice
            </Button>
          )}
        </fieldset>
      )}

      {item.type === "true_false" && (
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-medium text-slate-800">Correct answer</legend>
          <div className="flex gap-2">
            {(["True", "False"] as const).map((value) => (
              <label
                key={value}
                className={cn(
                  "flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium",
                  item.trueFalse === value
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "border-slate-300 bg-white text-slate-800",
                )}
              >
                <input
                  type="radio"
                  name={`${id}-true-false`}
                  className="h-5 w-5 accent-brand-600"
                  checked={item.trueFalse === value}
                  disabled={disabled}
                  onChange={() => set({ trueFalse: value })}
                />
                {value}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {item.type === "identification" && (
        <>
          <Field label="Correct answer" htmlFor={`${id}-answer`}>
            <Input
              id={`${id}-answer`}
              value={item.answer}
              disabled={disabled}
              onChange={(event) => set({ answer: event.target.value })}
            />
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
          </Field>
        </>
      )}

      {item.type === "short_answer" && (
        <>
          <Field label="Model answer" htmlFor={`${id}-answer`}>
            <Textarea
              id={`${id}-answer`}
              rows={3}
              value={item.answer}
              maxLength={LIMITS.responseMax}
              disabled={disabled}
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
        </>
      )}

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

      {problems.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm font-medium text-red-700">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
