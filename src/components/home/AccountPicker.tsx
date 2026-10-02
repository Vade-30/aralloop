"use client";

// The sample accounts on the role picker, one column per role. Choosing an
// account stores it as the session and opens that role's home screen.
//
// Each column wears its role's colour and the numbers of the loop's steps that
// role does, the same as the tiles in LoopStrip. Inside a `group/loop` wrapper
// the two are also linked by pointer: pointing at a step lights up its column.

import {
  ArrowRight,
  Backpack,
  Check,
  Flag,
  GraduationCap,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Avatar, Spinner, cn } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import type { SessionRequest, SessionResponse } from "@/lib/contracts";
import type { Role } from "@/lib/types";
import { RolePeek } from "./RolePeek";

export interface AccountOption {
  id: string;
  name: string;
  /** e.g. "Parent of Miguel Santos". */
  description: string;
  /** Where this account lands after it is chosen. */
  homePath: string;
}

export interface AccountGroup {
  /** Picks the icon, the colours and the short notes of the column. */
  role: Role;
  label: string;
  accounts: AccountOption[];
}

interface RoleLook {
  icon: LucideIcon;
  /** Border and background of the column. */
  lane: string;
  /** The column while the pointer is on one of this role's steps in the loop. */
  lit: string;
  /** Colours of the round icon badge in the column heading. */
  tile: string;
  avatar: "accent" | "brand" | "soft";
  /** An account card under the pointer: its border and edge take the role's colour. */
  cardHover: string;
  caption: string;
  /** The steps of the loop this role does, as numbered in LoopStrip. */
  steps: number[];
  stepsLabel: string;
  /** What this role does in the app, shown on wide screens. */
  can: string[];
}

const ROLE_LOOKS: Record<Role, RoleLook> = {
  teacher: {
    icon: GraduationCap,
    lane: "border-brand-100 bg-brand-50 hover:border-brand-300",
    lit: "group-has-[[data-loop-role=teacher]:hover]/loop:-translate-y-1 group-has-[[data-loop-role=teacher]:hover]/loop:border-brand-400",
    tile: "bg-brand-600 text-white",
    avatar: "brand",
    cardHover: "enabled:hover:border-brand-500 enabled:hover:shadow-[0_5px_0_#93b4fd]",
    caption: "Creates and reviews activities",
    steps: [1, 2],
    stepsLabel: "Steps 1 and 2 of the loop",
    can: [
      "Paste a lesson and get an AI draft",
      "Edit and publish the activity",
      "Change any score",
    ],
  },
  student: {
    icon: Backpack,
    lane: "border-accent-200 bg-accent-50 hover:border-accent-400",
    lit: "group-has-[[data-loop-role=student]:hover]/loop:-translate-y-1 group-has-[[data-loop-role=student]:hover]/loop:border-accent-500",
    tile: "bg-accent-400 text-ink",
    avatar: "accent",
    cardHover: "enabled:hover:border-accent-500 enabled:hover:shadow-[0_5px_0_#fadb5f]",
    caption: "Answer activities and get feedback",
    steps: [3, 4],
    stepsLabel: "Steps 3 and 4 of the loop",
    can: ["Answer a published activity", "See the score and feedback", "Ask the AI helper"],
  },
  parent: {
    icon: HeartHandshake,
    lane: "border-brand-100 bg-brand-50 hover:border-brand-300",
    lit: "group-has-[[data-loop-role=parent]:hover]/loop:-translate-y-1 group-has-[[data-loop-role=parent]:hover]/loop:border-brand-400",
    tile: "bg-brand-900 text-accent-400",
    avatar: "soft",
    cardHover: "enabled:hover:border-brand-500 enabled:hover:shadow-[0_5px_0_#93b4fd]",
    caption: "Sees how their child is doing",
    steps: [5],
    stepsLabel: "Step 5 of the loop",
    can: [
      "Read a summary in English or Filipino",
      "See the child's answers",
      "Ask the AI helper",
    ],
  },
};

// Side by side on a laptop, one column per group that exists.
const COLUMNS: Record<number, string> = {
  1: "",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
};

export function AccountPicker({
  groups,
  currentUserId,
}: {
  groups: AccountGroup[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(account: AccountOption) {
    if (pendingId) return;
    setPendingId(account.id);
    setError(null);
    try {
      const body: SessionRequest = { userId: account.id };
      await api<SessionResponse>("/api/session", { method: "POST", body });
      // Stay in the loading state while the next screen loads.
      router.push(account.homePath);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setPendingId(null);
    }
  }

  return (
    <div>
      {error && (
        <Alert tone="danger" className="mb-4 animate-pop">
          {error}
        </Alert>
      )}
      {/* The columns are as tall as the tallest one, so they read as one row. */}
      <div className={cn("grid gap-4 lg:gap-5", COLUMNS[groups.length])}>
        {groups.map((group, groupIndex) => {
          const look = ROLE_LOOKS[group.role];
          const Icon = look.icon;
          return (
            <section
              key={group.label}
              aria-label={group.label}
              data-lane={group.role}
              className={cn(
                "relative flex animate-rise flex-col rounded-[1.75rem] border-2 p-3 transition-[translate,border-color] duration-200",
                look.lane,
                look.lit,
              )}
              style={{ animationDelay: `${200 + groupIndex * 90}ms` }}
            >
              <div className="flex items-center gap-3.5 px-1 pb-3 pt-1">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-12 w-12 flex-none items-center justify-center rounded-full",
                    look.tile,
                  )}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-xl font-extrabold leading-tight text-ink sm:text-2xl">
                    {group.label}
                  </h2>
                  <p className="text-[13px] font-bold leading-snug text-muted">{look.caption}</p>
                </div>
              </div>
              {/* The same numbered dots as on the steps of the loop above. */}
              <p className="absolute right-3.5 top-3.5 flex items-center gap-1.5">
                <span className="sr-only">{look.stepsLabel}</span>
                <span
                  aria-hidden="true"
                  className="text-[10px] font-black uppercase tracking-widest text-muted"
                >
                  {look.steps.length > 1 ? "Steps" : "Step"}
                </span>
                <span aria-hidden="true" className="flex -space-x-1">
                  {look.steps.map((step) => (
                    <span
                      key={step}
                      className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-ink text-[10px] font-black leading-none text-white"
                    >
                      {step}
                    </span>
                  ))}
                </span>
              </p>

              <ul
                className={cn(
                  "grid gap-3 lg:grid-cols-1",
                  // A lone account keeps the whole width of a tablet.
                  group.accounts.length > 1 && "sm:grid-cols-2",
                )}
              >
                {group.accounts.map((account, index) => {
                  const pending = pendingId === account.id;
                  const inUse = account.id === currentUserId;
                  // The loop begins with the teacher, so until an account is
                  // chosen the first teacher is marked as the place to start.
                  const startHere =
                    currentUserId === null && group.role === "teacher" && index === 0;
                  return (
                    <li
                      key={account.id}
                      className="flex animate-rise"
                      style={{
                        animationDelay: `${300 + groupIndex * 90 + Math.min(index, 6) * 70}ms`,
                      }}
                    >
                      <button
                        type="button"
                        disabled={pendingId !== null}
                        aria-busy={pending || undefined}
                        onClick={() => choose(account)}
                        className={cn(
                          // A card that is one big button: it lifts on hover and
                          // presses down onto its edge, like the kit's buttons.
                          "group relative flex min-h-[4.75rem] w-full min-w-0 items-center gap-2.5 rounded-3xl border-2 bg-white p-3 text-left transition-[translate,box-shadow,border-color,opacity] duration-150 enabled:hover:-translate-y-0.5 enabled:active:translate-y-[3px] enabled:active:shadow-none disabled:cursor-not-allowed",
                          inUse || pending
                            ? "border-brand-600 shadow-edge-brand"
                            : cn("border-line shadow-edge", look.cardHover),
                          pendingId !== null && !pending && "opacity-60",
                        )}
                      >
                        <Avatar
                          name={account.name}
                          tone={look.avatar}
                          className="transition-[rotate,scale] duration-200 group-enabled:group-hover:-rotate-6 group-enabled:group-hover:scale-110"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block break-words font-display text-lg font-extrabold leading-tight text-ink">
                            {account.name}
                          </span>
                          <span className="mt-0.5 block break-words text-[13px] font-bold leading-snug text-muted">
                            {account.description}
                          </span>
                        </span>
                        {inUse && (
                          <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-white">
                            <Check className="h-3 w-3" strokeWidth={4} aria-hidden="true" />
                            In use
                          </span>
                        )}
                        {startHere && (
                          <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-accent-400 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-ink shadow-[0_2px_0_#c99a12]">
                            <Flag className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                            Start here
                          </span>
                        )}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-10 w-10 flex-none items-center justify-center rounded-2xl transition-[translate,background-color,color] duration-150",
                            pending
                              ? "bg-brand-600 text-white"
                              : cn(
                                  "group-enabled:group-hover:translate-x-0.5 group-enabled:group-hover:bg-accent-400 group-enabled:group-hover:text-ink",
                                  // Yellow marks the one main action on the screen.
                                  startHere ? "bg-accent-400 text-ink" : "bg-brand-50 text-brand-600",
                                ),
                          )}
                        >
                          {pending ? (
                            <Spinner className="h-5 w-5" />
                          ) : (
                            <ArrowRight className="h-5 w-5" strokeWidth={2.75} />
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <ul className="mt-4 hidden space-y-1.5 px-1 pb-1 lg:block">
                {look.can.map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-2 text-[13px] font-bold leading-snug text-muted"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 flex-none text-brand-600"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                    {line}
                  </li>
                ))}
              </ul>

              {/* Fills the space a short column has left over on a wide screen. */}
              <RolePeek role={group.role} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
