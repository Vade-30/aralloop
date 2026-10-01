"use client";

// The two choices a teacher makes before the AI writes an activity (how many
// items, which format) and the request that starts it. Shared by the new
// lesson form and the "generate another activity" form on the lesson page.

import { api } from "@/lib/client-api";
import { LIMITS, type ActivityResponse, type GenerateActivityRequest } from "@/lib/contracts";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from "@/lib/types";
import { Field, Select } from "@/components/ui";

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

const ITEM_COUNTS = Array.from(
  { length: LIMITS.itemCountMax - LIMITS.itemCountMin + 1 },
  (_, index) => LIMITS.itemCountMin + index,
);

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
  return (
    // Side by side only where the form itself is wide enough: the same fields
    // sit in a wide card on the new lesson page and in a narrow side panel on
    // the lesson page.
    <div className="@container">
      <div className="grid gap-4 @md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Field label="Number of items" htmlFor={`${idPrefix}-count`}>
          <Select
            id={`${idPrefix}-count`}
            value={value.itemCount}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, itemCount: Number(event.target.value) })}
          >
            {ITEM_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count} items
              </option>
            ))}
          </Select>
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
