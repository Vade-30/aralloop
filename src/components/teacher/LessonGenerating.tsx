// Shown while the AI writes an activity. It says only what is true: the
// request is running and can take a while. The pale lines hint at the draft
// that will open; they are not a progress meter.

import { Skeleton, Spinner, cn } from "@/components/ui";

const ROW_WIDTHS = ["w-11/12", "w-9/12", "w-10/12"];

export function LessonGenerating({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        "animate-pop overflow-hidden rounded-3xl border-2 border-brand-200 bg-brand-50",
        className,
      )}
    >
      <div role="status" className="flex items-start gap-3 px-4 py-4">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-brand-600 text-white"
        >
          <Spinner className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold leading-snug text-ink">{message}</p>
          <p className="mt-1 text-sm font-semibold text-muted">
            The draft opens for you to review when it is ready.
          </p>
        </div>
      </div>
      <div aria-hidden="true" className="space-y-3 border-t-2 border-brand-100 bg-white px-4 py-4">
        <Skeleton className="h-4 w-2/5 rounded-full" />
        {ROW_WIDTHS.map((width) => (
          <div key={width} className="flex items-center gap-3">
            <Skeleton className="h-7 w-7 flex-none rounded-lg" />
            <Skeleton className={cn("h-3 rounded-full", width)} />
          </div>
        ))}
      </div>
    </div>
  );
}
