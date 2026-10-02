// What every screen shows while it loads its data: the blue band, a row of
// number tiles over its edge and a few cards, all as pale blocks, so the
// screen does not jump when the page arrives. It says only that the page is
// loading, and nothing about how far along that is.

import { Card, Page, PageHeaderSkeleton, Skeleton, StatRow, cn } from "@/components/ui";

// Widths of the lines in each placeholder card, so the cards do not look like
// copies of one another.
const CARDS = [
  { title: "w-2/3", lines: ["w-full", "w-4/5"] },
  { title: "w-1/2", lines: ["w-full", "w-3/5"] },
  { title: "w-3/5", lines: ["w-11/12", "w-2/3"] },
];

function CardSkeleton({ title, lines }: { title: string; lines: string[] }) {
  return (
    <Card>
      <div className="flex items-center gap-3.5">
        <Skeleton className="h-12 w-12 flex-none rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className={cn("h-4 rounded-lg", title)} />
          <Skeleton className="h-3 w-2/5 rounded-lg" />
        </div>
      </div>
      <div className="mt-5 space-y-2.5 border-t-2 border-line pt-4">
        {lines.map((width, index) => (
          // A width can repeat, so the lines are keyed by their place.
          <Skeleton key={index} className={cn("h-3 rounded-lg", width)} />
        ))}
      </div>
    </Card>
  );
}

export function PageSkeleton() {
  return (
    <Page>
      <PageHeaderSkeleton overlap />
      {/* The same row as the number tiles of a dashboard; it is positioned,
          so it sits over the bottom edge of the band. */}
      <StatRow>
        {[0, 1, 2, 3].map((tile) => (
          <div
            key={tile}
            aria-hidden="true"
            className="rounded-3xl border-2 border-line bg-white px-3 py-4"
          >
            <Skeleton className="mx-auto h-9 w-14" />
            <Skeleton className="mx-auto mt-2.5 h-3.5 w-20 max-w-full rounded-lg" />
          </div>
        ))}
      </StatRow>

      <div
        aria-hidden="true"
        className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
      >
        <div className="space-y-4">
          {CARDS.map((card) => (
            <CardSkeleton key={card.title} {...card} />
          ))}
        </div>
        <div className="hidden lg:block">
          <CardSkeleton title="w-1/2" lines={["w-full", "w-4/5", "w-full", "w-3/5"]} />
        </div>
      </div>
    </Page>
  );
}
