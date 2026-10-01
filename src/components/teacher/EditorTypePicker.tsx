// The answer type of a draft item, picked from four tiles: all the choices are
// on screen with their icon and colour, instead of folded into a drop-down
// list. Underneath it is a plain group of radio buttons, so the arrow keys and
// screen readers work as usual. No hooks; the item editor holds the value.

import { Check } from "lucide-react";
import { ITEM_TYPES, ITEM_TYPE_LABELS, type ItemType } from "@/lib/types";
import { cn } from "@/components/ui";
import { ITEM_TYPE_STYLES } from "./EditorItemType";

export function EditorTypePicker({
  name,
  value,
  disabled,
  onChange,
}: {
  /** Name of the radio group; unique per item. */
  name: string;
  value: ItemType;
  disabled: boolean;
  onChange: (type: ItemType) => void;
}) {
  return (
    // min-w-0: a fieldset is otherwise as wide as its longest word.
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-extrabold text-ink">Answer type</legend>
      {/* Two by two on a phone, with the icon beside the name; four in a row
          from a tablet up, with the icon above it. The bottom padding leaves
          room for the chosen tile's raised edge. */}
      <div className="grid grid-cols-2 gap-2 pb-1 sm:grid-cols-4 sm:gap-2.5">
        {ITEM_TYPES.map((type) => {
          const { Icon, tile, chip, picked } = ITEM_TYPE_STYLES[type];
          const chosen = type === value;
          return (
            <label
              key={type}
              className={cn(
                "relative flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border-2 px-2.5 py-2 text-[13px] font-extrabold leading-tight transition-[translate,border-color,background-color,box-shadow,color] duration-150 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 sm:flex-col sm:justify-center sm:gap-1.5 sm:px-2 sm:py-3 sm:text-center",
                chosen
                  ? cn(picked, "text-ink")
                  : "border-line bg-white text-muted shadow-[0_4px_0_#e3e9f8] hover:border-brand-300 hover:text-ink has-[:enabled]:hover:-translate-y-0.5 has-[:enabled]:active:translate-y-0.5",
              )}
            >
              <input
                type="radio"
                name={name}
                value={type}
                className="sr-only"
                checked={chosen}
                disabled={disabled}
                onChange={() => onChange(type)}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-8 w-8 flex-none items-center justify-center rounded-xl transition-colors duration-150 sm:h-10 sm:w-10",
                  chosen ? tile : chip,
                )}
              >
                <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </span>
              <span className="min-w-0 break-words">{ITEM_TYPE_LABELS[type]}</span>
              {chosen && (
                // A tick as well as the colour, so the choice does not depend on colour.
                <span
                  aria-hidden="true"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 animate-pop items-center justify-center rounded-full bg-ink text-white ring-2 ring-white"
                >
                  <Check className="h-3 w-3" strokeWidth={4} />
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
