// A small sketch of each role's own screen, drawn with plain blocks in the
// app's colours. It peeks up from the bottom of an account column that has
// room left over. It is decoration only, so it is hidden from screen readers
// and holds no words or numbers.

import { Check, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import type { Role } from "@/lib/types";

function Line({ className }: { className: string }) {
  return <span className={cn("block h-1.5 rounded-full", className)} />;
}

/** The sheet of paper every sketch is drawn on. */
function Sheet({ children }: { children: ReactNode }) {
  return (
    <div className="h-full rounded-t-[1.25rem] border-2 border-b-0 border-line bg-white p-3 shadow-[0_-3px_0_#e3e9f8]">
      {children}
    </div>
  );
}

/** The teacher's dashboard: a row of number tiles over a list of activities. */
function TeacherPeek() {
  return (
    <Sheet>
      <div className="grid grid-cols-3 gap-2">
        {["bg-brand-600", "bg-emerald-500", "bg-amber-500"].map((colour) => (
          <div key={colour} className="rounded-xl border-2 border-line px-2 py-2">
            <span className={cn("mx-auto block h-3 w-5 rounded", colour)} />
            <Line className="mx-auto mt-1.5 w-4/5 bg-brand-100" />
          </div>
        ))}
      </div>
      {[0, 1].map((row) => (
        <div
          key={row}
          className="mt-2 flex items-center gap-2 rounded-xl border-2 border-line p-2"
        >
          <span
            className={cn(
              "flex h-7 w-7 flex-none items-center justify-center rounded-lg",
              row === 0 ? "bg-brand-600 text-white" : "bg-accent-400 text-ink",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="block min-w-0 flex-1 space-y-1.5">
            <Line className={cn("bg-brand-200", row === 0 ? "w-4/5" : "w-3/5")} />
            <Line className="w-1/2 bg-brand-100" />
          </span>
          <span className="block h-5 w-10 flex-none rounded-lg bg-accent-400" />
        </div>
      ))}
    </Sheet>
  );
}

/** A question with its choices, one of them chosen. */
function StudentPeek() {
  return (
    <Sheet>
      <Line className="w-4/5 bg-brand-200" />
      <Line className="mt-1.5 w-1/2 bg-brand-200" />
      {[false, true, false].map((chosen, index) => (
        <div
          key={index}
          className={cn(
            "mt-2 flex items-center gap-2 rounded-xl border-2 p-2",
            chosen ? "border-brand-600 bg-brand-50" : "border-line",
          )}
        >
          <span
            className={cn(
              "block h-4 w-4 flex-none rounded-md",
              chosen ? "bg-brand-600" : "bg-brand-100",
            )}
          />
          <Line className={cn("flex-1", chosen ? "bg-brand-300" : "bg-brand-100")} />
        </div>
      ))}
    </Sheet>
  );
}

/** The parent's summary: a score ring, a few lines, and a choice of two languages. */
function ParentPeek() {
  return (
    <Sheet>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full border-[5px] border-emerald-400 text-emerald-600">
          <Check className="h-5 w-5" strokeWidth={4} />
        </span>
        <span className="block min-w-0 flex-1 space-y-1.5">
          <Line className="w-3/5 bg-brand-200" />
          <Line className="w-2/5 bg-brand-100" />
        </span>
        <span className="flex flex-none gap-1">
          <span className="block h-5 w-8 rounded-full bg-brand-600" />
          <span className="block h-5 w-8 rounded-full border-2 border-line" />
        </span>
      </div>
      <div className="mt-3 space-y-2 rounded-xl bg-accent-50 p-2.5">
        <Line className="bg-accent-300" />
        <Line className="w-11/12 bg-accent-300" />
        <Line className="w-2/3 bg-accent-300" />
        <Line className="w-4/5 bg-accent-300" />
      </div>
    </Sheet>
  );
}

const PEEKS: Record<Role, () => ReactNode> = {
  teacher: TeacherPeek,
  student: StudentPeek,
  parent: ParentPeek,
};

/**
 * Put it last in a column that is a flex column. It takes whatever height is
 * left over and shows its sketch only when that is enough for one, so the
 * tallest column, which has nothing left over, shows none.
 */
export function RolePeek({ role }: { role: Role }) {
  const Peek = PEEKS[role];
  return (
    <div
      aria-hidden="true"
      // A size container: its own height never depends on the sketch inside.
      className="pointer-events-none relative -mx-3 -mb-3 hidden min-h-0 flex-1 overflow-hidden rounded-b-[1.625rem] [container-type:size] lg:block"
    >
      <div className="absolute inset-x-6 bottom-0 hidden h-36 translate-y-7 -rotate-2 [@container(min-height:7.5rem)]:block">
        <Peek />
      </div>
    </div>
  );
}
