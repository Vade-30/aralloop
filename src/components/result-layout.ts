// How a result screen is laid out under its score card, for the student's
// results and the parent's summary: the main column on the left and the AI
// helper in a narrow column on the right. On phones and tablets it is one
// column with the helper last.

/** The wrapper of the two columns. */
export const RESULT_COLUMNS =
  "mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6";

/**
 * The helper's column. It stays in view while the page scrolls, but only on
 * screens tall enough to hold all of it, so its input is never cut off on a
 * short projector screen.
 */
export const RESULT_HELPER_COLUMN =
  "min-w-0 lg:[@media(min-height:860px)]:sticky lg:[@media(min-height:860px)]:top-6";
