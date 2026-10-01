// Shown while any teacher screen loads its data.

import { Page, Spinner } from "@/components/ui";

export default function TeacherLoading() {
  return (
    <Page>
      <div role="status" className="flex items-center gap-2 text-sm text-slate-600">
        <Spinner className="h-4 w-4" />
        Loading
      </div>
      <div aria-hidden="true" className="mt-6 animate-pulse space-y-4">
        <div className="h-8 w-2/3 rounded-lg bg-slate-200" />
        <div className="h-4 w-1/3 rounded bg-slate-200" />
        <div className="h-28 rounded-xl bg-slate-200" />
        <div className="h-28 rounded-xl bg-slate-200" />
      </div>
    </Page>
  );
}
