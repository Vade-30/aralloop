// Shown while any page is loading its data: the band and pale blocks where
// the content will be. Every area of the app shows the same one.

import { PageSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <PageSkeleton />;
}
