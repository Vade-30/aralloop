// Shown while any page is loading its data.

import { Page, Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <Page className="flex items-center justify-center">
      <div role="status" className="flex flex-col items-center gap-3 py-16 text-slate-600">
        <Spinner className="h-8 w-8 text-brand-600" />
        <p className="text-sm">Loading</p>
      </div>
    </Page>
  );
}
