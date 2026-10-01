"use client";

// The outline of an activity: one numbered tile per item, in the colour of its
// answer type. A tile jumps to its item, and the tile of the item being read
// is filled in. On a laptop it is a rail that stays beside the items; on a
// phone it is a row above them. The draft editor adds a mark per item (ready
// or not) and a tile that adds an item; the published view shows it plain.

import { Plus } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { ItemType } from "@/lib/types";
import { cn } from "@/components/ui";
import { ITEM_STATE_STYLES, ITEM_TYPE_STYLES, type ItemState } from "./EditorItemType";

export interface OutlineEntry {
  /** DOM id of the item's card. */
  id: string;
  /** 1-based position. */
  number: number;
  type: ItemType;
  /** Draft only: whether the item is ready to publish. */
  state?: ItemState;
  /** The question, shown when the pointer rests on the tile. */
  title?: string;
}

/** How far down the window the reading line sits: an item is current once its top is above it. */
const READING_LINE = 0.35;
/** How long a tile stays filled in after it is used, while the page scrolls to its item. */
const JUMP_HOLD_MS = 1200;

/**
 * The id of the item being read: the last one whose top has passed the reading
 * line, or none above the list. The second value marks an item as current by
 * hand, for a jump.
 */
function useItemInView(ids: string[]): [string | null, (id: string) => void] {
  const [current, setCurrent] = useState<string | null>(null);
  const heldUntil = useRef(0);
  const signature = ids.join("\n");

  useEffect(() => {
    const list = signature === "" ? [] : signature.split("\n");
    let frame = 0;
    const update = () => {
      frame = 0;
      if (performance.now() < heldUntil.current) return;
      const line = window.innerHeight * READING_LINE;
      let found: string | null = null;
      // The cards are looked up each time: the editor replaces them when its view changes.
      for (const id of list) {
        const card = document.getElementById(id);
        if (card && card.getBoundingClientRect().top <= line) found = id;
      }
      // At the end of the page the last items cannot reach the line.
      const atEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atEnd && found !== null) found = list[list.length - 1];
      setCurrent(found);
    };
    // At most once per frame, however often the page reports a scroll.
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [signature]);

  function hold(id: string) {
    heldUntil.current = performance.now() + JUMP_HOLD_MS;
    setCurrent(id);
  }

  return [current, hold];
}

export function EditorOutline({
  entries,
  onAdd,
  disabled = false,
  className,
}: {
  entries: OutlineEntry[];
  /** Draft only: adds an item. Leave out to hide the tile. */
  onAdd?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [current, holdCurrent] = useItemInView(entries.map((entry) => entry.id));
  const listRef = useRef<HTMLOListElement>(null);

  // A long rail scrolls on its own; keep the filled-in tile inside it. The
  // list's own scroll position is moved, never the page.
  useEffect(() => {
    const list = listRef.current;
    const tile = list?.querySelector('[aria-current="true"]');
    if (!list || !tile || list.scrollHeight <= list.clientHeight) return;
    const frame = list.getBoundingClientRect();
    const box = tile.getBoundingClientRect();
    if (box.top < frame.top) list.scrollTop -= frame.top - box.top + 8;
    else if (box.bottom > frame.bottom) list.scrollTop += box.bottom - frame.bottom + 8;
  }, [current]);

  function jump(event: MouseEvent<HTMLAnchorElement>, id: string) {
    const card = document.getElementById(id);
    if (!card) return;
    // Without this the browser jumps at once and adds the id to the address.
    event.preventDefault();
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
    // Keyboard and screen reader users continue from the item they jumped to.
    card.focus({ preventScroll: true });
    holdCurrent(id);
  }

  return (
    <nav aria-label="Items" className={className}>
      {/* On a laptop the list is pushed out by its own padding on every side,
          so a tile's mark and its focus outline are not cut off when the rail
          scrolls. */}
      <ol
        ref={listRef}
        className="flex flex-wrap gap-2 lg:-m-1.5 lg:max-h-[calc(100dvh-2rem)] lg:flex-col lg:flex-nowrap lg:overflow-y-auto lg:p-1.5 lg:[scrollbar-width:none]"
      >
        {entries.map((entry) => {
          const active = entry.id === current;
          const look = ITEM_TYPE_STYLES[entry.type];
          const state = entry.state ? ITEM_STATE_STYLES[entry.state] : null;
          return (
            <li key={entry.id} className="flex-none">
              <a
                href={`#${entry.id}`}
                title={entry.title || undefined}
                aria-label={state ? `Item ${entry.number}, ${state.label}` : `Item ${entry.number}`}
                aria-current={active ? "true" : undefined}
                onClick={(event) => jump(event, entry.id)}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-xl font-display text-lg font-extrabold leading-none transition-[translate,background-color,color,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-y-0.5",
                  active
                    ? cn(look.tile, "shadow-[0_3px_0_rgba(22,32,74,0.28)]")
                    : cn(look.chip, "hover:shadow-[0_3px_0_rgba(22,32,74,0.12)]"),
                )}
              >
                {entry.number}
                {state && (
                  // Keyed by state, so the mark pops when the item changes.
                  <span
                    key={entry.state}
                    aria-hidden="true"
                    className={cn(
                      "absolute -right-1.5 -top-1.5 flex h-4 w-4 animate-pop items-center justify-center rounded-full ring-2 ring-canvas",
                      state.mark,
                    )}
                  >
                    <state.Icon className="h-2.5 w-2.5" strokeWidth={4} />
                  </span>
                )}
              </a>
            </li>
          );
        })}
        {onAdd && (
          <li className="flex-none">
            <button
              type="button"
              aria-label="Add item"
              title="Add item"
              disabled={disabled}
              onClick={onAdd}
              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-dashed border-brand-300 text-brand-700 transition-colors enabled:hover:border-brand-500 enabled:hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
            </button>
          </li>
        )}
      </ol>
    </nav>
  );
}
