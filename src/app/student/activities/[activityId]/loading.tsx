// Shown while one activity loads, whether it opens as the answer form or as
// the results: the band and two columns over its edge, as pale blocks. It
// says only that the page is loading.

import {
  ANSWER_GRID,
  ANSWER_INFO_SLOT,
  ANSWER_MAIN_SLOT,
} from "@/components/student/answer-layout";
import { Card, Page, PageHeaderSkeleton, Skeleton, cn } from "@/components/ui";

export default function StudentActivityLoading() {
  return (
    <Page>
      <PageHeaderSkeleton overlap />
      <div aria-hidden="true" className={ANSWER_GRID}>
        <Card className={cn(ANSWER_INFO_SLOT, "space-y-3")}>
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 flex-none rounded-2xl" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
        <Card className={cn(ANSWER_MAIN_SLOT, "space-y-4")}>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-5/6" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((option) => (
              <Skeleton key={option} className="h-14 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="ml-auto h-11 w-28 rounded-2xl" />
        </Card>
      </div>
    </Page>
  );
}
