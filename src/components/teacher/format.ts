// Small text formatters for the teacher screens.

// A fixed time zone, so the server prints the same date wherever it runs.
const DATE = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

/** ISO string -> "Oct 2, 2026". Empty for a value that is not a date. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : DATE.format(date);
}

/** plural(1, "student") -> "1 student"; plural(3, "student") -> "3 students". */
export function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}
