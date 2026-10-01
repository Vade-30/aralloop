// Date wording for the parent screens.

// A fixed time zone, so the server shows the same time wherever it runs.
const DATE_FORMAT = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

/** ISO string -> "Oct 2, 2026, 9:15 AM" (Philippine time). */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : DATE_FORMAT.format(date);
}
