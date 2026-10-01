// The picture on the right of the first screen's blue band, on wide screens:
// the loop drawn as a ring, with a lesson, a set of answers, a check mark and a
// parent's note sitting on it. It is decoration only, so it is hidden from
// screen readers and holds no words.
//
// It goes in PageHeader's `description`, which is a paragraph, so it is built
// from spans. It is positioned against the band itself and takes no room in
// the layout. Its keyframes come from HomeMotion.

import { BookOpenText, Check, HeartHandshake, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/components/ui";

// The dark edge under each small card, like the edge under the kit's buttons.
const CARD = "border-2 border-line bg-white shadow-[0_4px_0_#162a94]";

/** One thing on the ring: it pops in, then floats slowly. */
function Piece({
  place,
  popAfter,
  floatFrom,
  className,
  children,
}: {
  /** Where it sits in the picture. */
  place: string;
  /** Milliseconds before it pops in. */
  popAfter: number;
  /** Seconds into the float it starts at, so the pieces do not move together. */
  floatFrom: number;
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn("absolute block animate-pop", place)}
      style={{ animationDelay: `${popAfter}ms` }}
    >
      <span
        className={className}
        style={{ animation: `home-bob 6s ease-in-out -${floatFrom}s infinite` }}
      >
        {children}
      </span>
    </span>
  );
}

export function HeroArt() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-2.5 hidden h-[9.5rem] w-[17rem] lg:block"
    >
      {/* The loop, and a dot that goes round it. */}
      <span className="absolute left-[4.75rem] top-2.5 block h-32 w-32 rounded-full border-2 border-dashed border-white/40" />
      <span className="absolute left-[4.75rem] top-2.5 block h-32 w-32 animate-[spin_9s_linear_infinite]">
        <span className="absolute -top-1.5 left-1/2 -ml-[7px] block h-3.5 w-3.5 rounded-full bg-accent-400 ring-[3px] ring-brand-900" />
      </span>

      {/* A lesson, with the AI's mark on its corner. */}
      <Piece
        place="left-0 top-2"
        popAfter={250}
        floatFrom={0}
        className={cn("relative block w-[6.5rem] -rotate-6 rounded-2xl p-2.5", CARD)}
      >
        <span className="flex items-center gap-1.5">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-brand-600 text-white">
            <BookOpenText className="h-3.5 w-3.5" />
          </span>
          <span className="block h-2 flex-1 rounded-full bg-brand-200" />
        </span>
        <span className="mt-2 block h-1.5 rounded-full bg-brand-100" />
        <span className="mt-1.5 block h-1.5 w-3/4 rounded-full bg-brand-100" />
        <span className="absolute -right-2.5 -top-2.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-accent-400 text-ink">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      </Piece>

      {/* A question with one answer chosen. */}
      <Piece
        place="right-0 top-5"
        popAfter={400}
        floatFrom={2}
        className={cn("block w-[6.25rem] rotate-6 space-y-1.5 rounded-2xl p-2", CARD)}
      >
        {[false, true, false].map((chosen, index) => (
          <span
            key={index}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border-2 px-1.5 py-1",
              chosen ? "border-brand-600 bg-brand-50" : "border-line",
            )}
          >
            <span
              className={cn(
                "block h-3 w-3 flex-none rounded-[5px]",
                chosen ? "bg-brand-600" : "bg-brand-100",
              )}
            />
            <span
              className={cn(
                "block h-1.5 flex-1 rounded-full",
                chosen ? "bg-brand-300" : "bg-brand-100",
              )}
            />
          </span>
        ))}
      </Piece>

      {/* The answers checked. */}
      <Piece
        place="left-[7.25rem] top-[3.125rem]"
        popAfter={550}
        floatFrom={3}
        className="flex h-12 w-12 items-center justify-center rounded-full border-[5px] border-emerald-400 bg-white text-emerald-600 shadow-[0_4px_0_#162a94]"
      >
        <Check className="h-5 w-5" strokeWidth={4} />
      </Piece>

      {/* A note for the parent. */}
      <Piece
        place="bottom-0 left-7"
        popAfter={700}
        floatFrom={4}
        className="flex w-[7.75rem] -rotate-3 items-center gap-2 rounded-2xl rounded-bl-md border-2 border-accent-200 bg-accent-400 p-2 shadow-[0_4px_0_#c99a12]"
      >
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-brand-900 text-accent-400">
          <HeartHandshake className="h-4 w-4" />
        </span>
        <span className="block flex-1 space-y-1.5">
          <span className="block h-1.5 rounded-full bg-ink/25" />
          <span className="block h-1.5 w-2/3 rounded-full bg-ink/25" />
        </span>
      </Piece>
    </span>
  );
}
