"use client";

// The two choices a teacher makes before the AI writes an activity (how many
// items, which format) and the request that starts it. Shared by the new
// lesson form and the "generate another activity" form on the lesson page.

import { api } from "@/lib/client-api";
import { LIMITS, type ActivityResponse, type GenerateActivityRequest } from "@/lib/contracts";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from "@/lib/types";
import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";

export type PreferredType = NonNullable<GenerateActivityRequest["preferredType"]>;

export interface GenerateOptionsValue {
  itemCount: number;
  preferredType: PreferredType;
}

export const DEFAULT_GENERATE_OPTIONS: GenerateOptionsValue = {
  itemCount: LIMITS.itemCountDefault,
  preferredType: "auto",
};

/** Shown while the AI call runs; it can honestly take this long. */
export const GENERATING_MESSAGE =
  "Reading the lesson and writing the activity. This can take up to a minute.";

const ITEM_COUNT_PRESETS: readonly number[] = [5, 10, 15, 20];
const OTHER_COUNT = "other";

/** The nearest allowed item count to what was typed, or null if it is not a number. */
function parseItemCount(text: string): number | null {
  const typed = Number(text);
  if (text.trim() === "" || !Number.isFinite(typed)) return null;
  return Math.min(LIMITS.itemCountMax, Math.max(LIMITS.itemCountMin, Math.round(typed)));
}

const PREFERRED_TYPES: readonly PreferredType[] = ["auto", ...ACTIVITY_TYPES];

function isPreferredType(value: string): value is PreferredType {
  return PREFERRED_TYPES.some((type) => type === value);
}

/** Asks the AI for a draft activity and returns its id. */
export async function requestActivity(
  lessonId: string,
  options: GenerateOptionsValue,
): Promise<string> {
  const body: GenerateActivityRequest = options;
  const { activity } = await api<ActivityResponse>(
    `/api/lessons/${encodeURIComponent(lessonId)}/activities`,
    { method: "POST", body },
  );
  return activity.id;
}

export function GenerateOptionFields({
  idPrefix,
  value,
  onChange,
  disabled = false,
}: {
  /** Keeps the control ids unique when two forms share a page. */
  idPrefix: string;
  value: GenerateOptionsValue;
  onChange: (value: GenerateOptionsValue) => void;
  disabled?: boolean;
}) {
  // "Other" stays chosen even when the typed number matches a preset.
  const [other, setOther] = useState(() => !ITEM_COUNT_PRESETS.includes(value.itemCount));
  const [otherText, setOtherText] = useState(String(value.itemCount));

  return (
    // Side by side only where the form itself is wide enough: the same fields
    // sit in a wide card on the new lesson page and in a narrow side panel on
    // the lesson page.
    <div className="@container">
      <div className="grid gap-4 @md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Field
          label="Number of items"
          htmlFor={`${idPrefix}-count`}
          hint={
            other ? `Type any number from ${LIMITS.itemCountMin} to ${LIMITS.itemCountMax}.` : null
          }
        >
          <div className="flex gap-2">
            <Select
              id={`${idPrefix}-count`}
              value={other ? OTHER_COUNT : value.itemCount}
              disabled={disabled}
              onChange={(event) => {
                if (event.target.value === OTHER_COUNT) {
                  setOther(true);
                  setOtherText(String(value.itemCount));
                  return;
                }
                setOther(false);
                onChange({ ...value, itemCount: Number(event.target.value) });
              }}
            >
              {ITEM_COUNT_PRESETS.map((count) => (
                <option key={count} value={count}>
                  {count} items
                </option>
              ))}
              <option value={OTHER_COUNT}>Other</option>
            </Select>
            {other && (
              <Input
                type="number"
                inputMode="numeric"
                aria-label="Number of items you want"
                // Inline, because the shared input style sets the width to full.
                style={{ width: "5.5rem", flex: "none" }}
                min={LIMITS.itemCountMin}
                max={LIMITS.itemCountMax}
                step={1}
                value={otherText}
                disabled={disabled}
                autoFocus
                onChange={(event) => {
                  setOtherText(event.target.value);
                  const itemCount = parseItemCount(event.target.value);
                  if (itemCount !== null) onChange({ ...value, itemCount });
                }}
                // Show the number that will really be used once typing stops.
                onBlur={() => setOtherText(String(value.itemCount))}
              />
            )}
          </div>
        </Field>
        <Field label="Format" htmlFor={`${idPrefix}-format`}>
          <Select
            id={`${idPrefix}-format`}
            value={value.preferredType}
            disabled={disabled}
            onChange={(event) => {
              const preferredType = event.target.value;
              if (isPreferredType(preferredType)) onChange({ ...value, preferredType });
            }}
          >
            <option value="auto">Let the AI choose (recommended)</option>
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {ACTIVITY_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
}
