// How each answer type looks on the teacher's activity screens: its icon and
// its colour. The draft editor, the summary panel and the published view all
// read from here, so a type is recognisable at a glance wherever it appears.
// No hooks, so these work in server and client components alike.

import {
  Check,
  CircleAlert,
  CircleDashed,
  ListChecks,
  PenLine,
  TextCursorInput,
  ToggleLeft,
  type LucideIcon,
} from "lucide-react";
import { ITEM_TYPE_LABELS, type ItemType } from "@/lib/types";
import { cn } from "@/components/ui";

export const ITEM_TYPE_STYLES: Record<
  ItemType,
  {
    Icon: LucideIcon;
    /** Solid tile behind an icon or a number. */
    tile: string;
    /** Segment of the answer type bar in the summary. */
    bar: string;
    /** Soft chip that carries the type's name. */
    chip: string;
    /** The chosen tile of the answer type picker: border, tint and raised edge. */
    picked: string;
  }
> = {
  multiple_choice: {
    Icon: ListChecks,
    tile: "bg-brand-600 text-white",
    bar: "bg-brand-600",
    chip: "bg-brand-100 text-brand-800",
    picked: "border-brand-600 bg-brand-50 shadow-[0_4px_0_#2549e6]",
  },
  true_false: {
    Icon: ToggleLeft,
    tile: "bg-accent-400 text-ink",
    bar: "bg-accent-400",
    chip: "bg-accent-100 text-amber-900",
    picked: "border-accent-500 bg-accent-50 shadow-[0_4px_0_#c99a12]",
  },
  identification: {
    Icon: TextCursorInput,
    tile: "bg-teal-600 text-white",
    bar: "bg-teal-500",
    chip: "bg-teal-100 text-teal-900",
    picked: "border-teal-600 bg-teal-50 shadow-[0_4px_0_#0d9488]",
  },
  short_answer: {
    Icon: PenLine,
    tile: "bg-violet-600 text-white",
    bar: "bg-violet-500",
    chip: "bg-violet-100 text-violet-900",
    picked: "border-violet-600 bg-violet-50 shadow-[0_4px_0_#7c3aed]",
  },
};

/** The DOM id of an item's card. The outline jumps to it, and so does the first problem. */
export function itemCardId(key: string): string {
  return `item-${key}`;
}

/**
 * How far along a draft item is. "todo" has something missing that the teacher
 * has not been told about yet; "problem" is the same after a failed save, when
 * the card lists what to fix.
 */
export type ItemState = "ready" | "todo" | "problem";

export const ITEM_STATE_STYLES: Record<
  ItemState,
  { Icon: LucideIcon; label: string; chip: string; mark: string }
> = {
  ready: {
    Icon: Check,
    label: "Ready",
    chip: "bg-emerald-100 text-emerald-800",
    mark: "bg-emerald-600 text-white",
  },
  todo: {
    Icon: CircleDashed,
    label: "Not finished",
    chip: "bg-accent-100 text-amber-900",
    mark: "bg-accent-400 text-ink",
  },
  problem: {
    Icon: CircleAlert,
    label: "Needs fixing",
    chip: "bg-red-100 text-red-800",
    mark: "bg-red-600 text-white",
  },
};

/** The item's number on a tile in its answer type's colour. */
export function ItemNumberTile({
  number,
  type,
  className,
}: {
  number: number;
  type: ItemType;
  className?: string;
}) {
  return (
    // Decorative: the heading beside it already says "Item 3".
    <span
      aria-hidden="true"
      className={cn(
        "flex h-12 w-12 flex-none items-center justify-center rounded-2xl font-display text-2xl font-extrabold leading-none transition-colors duration-200",
        ITEM_TYPE_STYLES[type].tile,
        className,
      )}
    >
      {number}
    </span>
  );
}

/** Chip with the answer type's icon and name. */
export function ItemTypeChip({ type }: { type: ItemType }) {
  const { Icon, chip } = ITEM_TYPE_STYLES[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-extrabold transition-colors duration-200",
        chip,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {ITEM_TYPE_LABELS[type]}
    </span>
  );
}

/** Chip that says whether a draft item is ready, with an icon so colour is not the only sign. */
export function ItemStateChip({ state }: { state: ItemState }) {
  const { Icon, label, chip } = ITEM_STATE_STYLES[state];
  return (
    // Keyed by state, so the chip pops when an item becomes ready or stops being so.
    <span
      key={state}
      className={cn(
        "inline-flex animate-pop items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-extrabold",
        chip,
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      {label}
    </span>
  );
}

/** 0 -> "A", 1 -> "B": the letter shown beside a choice. */
export function choiceLetter(index: number): string {
  return String.fromCharCode(65 + index);
}
