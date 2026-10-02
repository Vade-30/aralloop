// The strip on the first screen that shows the five steps of one lesson, from
// the teacher's lesson to the parent's summary. The "loop" is the three people
// kept in the loop on that lesson; results do not feed the next activity. It has no hooks, so it renders on
// the server. Its keyframes come from HomeMotion.
//
// Each step wears the colour of the account that does it, the same colour as
// that account's column below. Inside a `group/loop` wrapper the two are also
// linked by pointer: pointing at a step lights up its column, and pointing at
// a column lights up its steps.

import {
  BookOpenText,
  HeartHandshake,
  MessageSquareText,
  PencilLine,
  ShieldCheck,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Badge, Card, cn } from "@/components/ui";
import type { Role } from "@/lib/types";
import { LOOP_SECONDS } from "./HomeMotion";

interface Step {
  title: string;
  /** One short line, shown on wide screens only. */
  caption: string;
  icon: LucideIcon;
  /** The account that does this step. */
  role: Role;
}

const STEPS: Step[] = [
  { title: "Lesson", caption: "Teacher pastes a lesson", icon: BookOpenText, role: "teacher" },
  {
    title: "AI draft",
    caption: "AI drafts, teacher edits and publishes",
    icon: Sparkles,
    role: "teacher",
  },
  {
    title: "Student answers",
    caption: "Students answer the activity",
    icon: PencilLine,
    role: "student",
  },
  {
    title: "Feedback",
    caption: "Answers are graded with feedback",
    icon: MessageSquareText,
    role: "student",
  },
  {
    title: "Parent summary",
    caption: "Summary in English or Filipino",
    icon: HeartHandshake,
    role: "parent",
  },
];

// `tile` is the step's icon tile: a round, flat badge, because a step is not
// something to press. `lit` is the ring it gets
// while the pointer or the keyboard focus is in that role's column of accounts.
const ROLE_LOOKS: Record<Role, { tile: string; lit: string }> = {
  teacher: {
    tile: "bg-brand-600 text-white",
    lit: "group-has-[[data-lane=teacher]:is(:hover,:focus-within)]/loop:ring-4 group-has-[[data-lane=teacher]:is(:hover,:focus-within)]/loop:ring-brand-300",
  },
  student: {
    tile: "bg-accent-400 text-ink",
    lit: "group-has-[[data-lane=student]:is(:hover,:focus-within)]/loop:ring-4 group-has-[[data-lane=student]:is(:hover,:focus-within)]/loop:ring-accent-600",
  },
  parent: {
    tile: "bg-brand-900 text-accent-400",
    lit: "group-has-[[data-lane=parent]:is(:hover,:focus-within)]/loop:ring-4 group-has-[[data-lane=parent]:is(:hover,:focus-within)]/loop:ring-brand-300",
  },
};

// The dot crosses the four gaps between the tiles at a steady speed, and a
// tile's hop peaks 4% into its own cycle (see loop-step in HomeMotion).
function hopDelay(index: number): number {
  return (index / (STEPS.length - 1)) * LOOP_SECONDS - 0.04 * LOOP_SECONDS;
}

export function LoopStrip({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        // Positioned, so it can overlap a PageHeader with `overlap`.
        "relative animate-rise lg:grid lg:grid-cols-[11.5rem_minmax(0,1fr)] lg:gap-6",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 lg:mb-0 lg:flex-col lg:items-start lg:justify-center lg:gap-2 lg:border-r-2 lg:border-dashed lg:border-line lg:pr-5">
        <h2 className="text-lg font-extrabold leading-tight text-ink sm:text-xl lg:text-2xl">
          Everyone in the loop
        </h2>
        <Badge tone="brand">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Teacher in control
        </Badge>
      </div>

      <div className="min-w-0">
        <div className="relative">
          {/* The line runs from the middle of the first tile to the middle of the last. */}
          <div
            aria-hidden="true"
            className="absolute left-[10%] right-[10%] top-[21px] border-t-2 border-dashed border-brand-200 sm:top-[27px]"
          >
            <span
              className="absolute left-0 -top-[7px] -ml-1.5 block h-3 w-3 rounded-full bg-accent-500 opacity-0 ring-2 ring-white"
              style={{ animation: `loop-flow ${LOOP_SECONDS}s linear infinite` }}
            />
          </div>

          <ol className="relative grid grid-cols-5 gap-1 sm:gap-3">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const look = ROLE_LOOKS[step.role];
              return (
                <li
                  key={step.title}
                  data-loop-role={step.role}
                  className="flex min-w-0 animate-pop flex-col items-center text-center"
                  style={{ animationDelay: `${120 + index * 90}ms` }}
                >
                  <span
                    className={cn(
                      "relative flex h-11 w-11 flex-none items-center justify-center rounded-full transition-shadow duration-150 sm:h-14 sm:w-14",
                      look.tile,
                      look.lit,
                    )}
                    style={{
                      animation: `loop-step ${LOOP_SECONDS}s ease-in-out ${hopDelay(index).toFixed(2)}s infinite`,
                    }}
                  >
                    <Icon className="h-5 w-5 sm:h-7 sm:w-7" aria-hidden="true" />
                    {/* The list is ordered, so the number is only decoration. */}
                    <span
                      aria-hidden="true"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-ink text-[10px] font-black leading-none text-white"
                    >
                      {index + 1}
                    </span>
                  </span>
                  <span className="mt-3 max-w-full break-words text-[11px] font-extrabold leading-tight text-ink sm:text-sm lg:text-[15px]">
                    {step.title}
                  </span>
                  <span className="mt-1 hidden text-xs font-semibold leading-snug text-muted lg:block">
                    {step.caption}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* What the name means: all three people follow the same lesson and
            the same result. There is no line back to the first step, because
            the teacher, not the app, decides what to teach next. */}
        <p className="mt-4 hidden items-center justify-center gap-1.5 text-xs font-extrabold text-muted lg:flex">
          <UsersRound className="h-3.5 w-3.5 flex-none text-brand-500" aria-hidden="true" />
          Teacher, student and parent see the same lesson and the same result
        </p>
      </div>
    </Card>
  );
}
