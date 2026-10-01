// A short numbered list of steps with an icon each, joined by a line. Used for
// "How it works" on the dashboard and "What happens next" on the new lesson
// page.

import type { ReactNode } from "react";
import { cn } from "@/components/ui";

type StepTone = "brand" | "accent" | "soft" | "success";

export interface LessonStep {
  icon: ReactNode;
  title: string;
  text: string;
  tone?: StepTone;
}

// The same colours as IconTile, on a smaller square.
const TONES: Record<StepTone, string> = {
  brand: "bg-brand-600 text-white",
  accent: "bg-accent-400 text-ink",
  soft: "bg-brand-50 text-brand-700",
  success: "bg-emerald-100 text-emerald-700",
};

export function LessonSteps({ steps, className }: { steps: LessonStep[]; className?: string }) {
  return (
    <ol className={className}>
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li
            key={step.title}
            className="flex animate-rise gap-3"
            style={{ animationDelay: `${120 + index * 80}ms` }}
          >
            <div className="flex flex-none flex-col items-center">
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-10 w-10 flex-none items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5",
                  TONES[step.tone ?? "soft"],
                )}
              >
                {step.icon}
              </span>
              {!last && (
                <span aria-hidden="true" className="my-1 w-0.5 flex-1 rounded-full bg-brand-100" />
              )}
            </div>
            <div className={cn("min-w-0 pt-0.5", !last && "pb-4")}>
              <p className="text-[15px] font-extrabold leading-snug text-ink">
                <span className="mr-1.5 text-brand-600">{index + 1}.</span>
                {step.title}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-muted">{step.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
