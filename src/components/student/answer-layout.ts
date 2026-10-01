// How the answering screen is laid out. On a laptop it is one grid: the
// question card on the left and, on the right, the activity's details (drawn
// by the page on the server) above the question list (drawn by the form in
// the browser).
//
// The form takes no part in that grid itself ("contents"), so its two parts
// can sit beside a card the form never receives. This keeps the form's props
// down to the public items. On phones and tablets everything is one column.

/** The wrapper. It is positioned, so it can overlap a PageHeader with `overlap`. */
export const ANSWER_GRID =
  "relative lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-6";

/** Top right: the activity's details. */
export const ANSWER_INFO_SLOT = "mb-6 lg:col-start-2 lg:row-start-1 lg:mb-0";

/** The form element: a column on small screens, invisible to the grid on a laptop. */
export const ANSWER_FORM = "grid gap-6 lg:contents";

/** Left, the full height: the question card. */
export const ANSWER_MAIN_SLOT = "min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1";

/** Bottom right: the question list. */
export const ANSWER_SIDE_SLOT = "lg:col-start-2 lg:row-start-2";
