// The shape shared by every "not found" and "could not load" screen: the band
// with a short title, and one card over its edge with a picture, a message
// and the ways out. No hooks, so it works in server and client components.

import type { ReactNode } from "react";
import { Card, Page, PageHeader } from "@/components/ui";

export function StateScreen({
  title,
  art,
  message,
  alert = false,
  actions,
}: {
  title: string;
  /** A picture from StateArt. Decoration: the message says what happened. */
  art: ReactNode;
  message: ReactNode;
  /** Announce the message to screen readers at once: use it for a failure. */
  alert?: boolean;
  /** Buttons. On a phone each one takes the full width. */
  actions: ReactNode;
}) {
  return (
    <Page size="narrow">
      <PageHeader title={title} overlap />
      {/* Positioned, so it sits over the bottom edge of the band. */}
      <Card className="relative animate-rise px-5 pb-9 pt-7 text-center sm:px-8 sm:pb-11 sm:pt-9">
        {art}
        <div
          role={alert ? "alert" : undefined}
          className="mx-auto mt-5 max-w-md text-balance text-base font-semibold text-muted"
        >
          {message}
        </div>
        <div className="mt-6 flex flex-col justify-center gap-3.5 sm:flex-row sm:gap-3">
          {actions}
        </div>
      </Card>
    </Page>
  );
}
