// Small wording helpers shared by the student and parent screens.

/** 1 -> "1 point", 2 -> "2 points". */
export function pointsLabel(points: number): string {
  return `${points} ${points === 1 ? "point" : "points"}`;
}

/** 1 -> "1 question", 8 -> "8 questions". */
export function questionsLabel(count: number): string {
  return `${count} ${count === 1 ? "question" : "questions"}`;
}
