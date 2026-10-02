// Rules for reading several uploaded files into one lesson: the order they
// are joined in, the title, the length limit and the note shown afterwards.
// No React and no requests, so it is tested on its own; NewLessonForm sends
// the files and shows the result.

import { LIMITS } from "@/lib/contracts";
import { cutToLimit } from "@/lib/cut-text";

export const PHOTO_PATTERN = /\.(jpe?g|png|webp|heic|heif)$/i;

/** One file whose text was read, as /api/lessons/extract answered for it. */
export interface ReadLessonFile {
  /** The name the teacher picked it by. */
  name: string;
  title: string;
  text: string;
  truncated: boolean;
}

const byName = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const count = new Intl.NumberFormat("en-PH");

/**
 * Files in the order of their names, with "page-2" before "page-10". A file
 * dialog hands over several files in an order of its own (Windows puts the
 * last one clicked first), and a camera numbers its photos as they are taken,
 * so the names are the order the teacher expects.
 */
export function inNameOrder<T extends { name: string }>(files: readonly T[]): T[] {
  return [...files].sort((a, b) => byName.compare(a.name, b.name));
}

/**
 * Joins the text of the files, in the order given, into one lesson no longer
 * than LIMITS.lessonContentMax. The title is the first file's.
 */
export function joinLessonFiles(files: readonly ReadLessonFile[]): {
  title: string;
  text: string;
  truncated: boolean;
} {
  const joined = cutToLimit(files.map((file) => file.text).join("\n\n"), LIMITS.lessonContentMax);
  return {
    title: (files[0]?.title ?? "").slice(0, LIMITS.lessonTitleMax),
    text: joined.text,
    truncated: joined.truncated || files.some((file) => file.truncated),
  };
}

/** What the teacher is told after the text is put in the lesson box. */
export function uploadNote(files: readonly ReadLessonFile[], truncated: boolean): string {
  const limit = count.format(LIMITS.lessonContentMax);
  const photos = files.filter((file) => PHOTO_PATTERN.test(file.name)).length;

  if (files.length === 1) {
    const { name } = files[0];
    if (truncated) {
      return `Text read from ${name}. The file was longer than ${limit} characters, so only the first part was kept.`;
    }
    return photos > 0
      ? `The AI read this text from ${name}. It can misread a word, so check it against the page before generating.`
      : `Text read from ${name}. Check it above before generating.`;
  }

  const parts = [
    `Text read from ${files.length} files and joined in this order: ${files.map((file) => file.name).join(", ")}.`,
  ];
  if (truncated) {
    parts.push(`Together they were longer than ${limit} characters, so only the first part was kept.`);
  }
  parts.push(
    photos > 0
      ? `The AI read the ${photos === 1 ? "photo" : "photos"} and can misread a word, so check the text against the pages before generating.`
      : "Check it above before generating.",
  );
  return parts.join(" ");
}
