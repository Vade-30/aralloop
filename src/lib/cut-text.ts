// Shortening text to a character limit without cutting through a sentence.
// Used on the server for one uploaded file (extract.ts) and in the browser
// for several files joined into one lesson, so it imports nothing.

/**
 * Cuts text to max characters, preferably at the end of a paragraph, else at
 * the end of a sentence, else between words.
 */
export function cutToLimit(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };

  const head = text.slice(0, max);
  const paragraphEnd = head.lastIndexOf("\n\n");
  let sentenceEnd = -1;
  for (const match of head.matchAll(/[.!?]["')\]]*(?=\s)/g)) {
    sentenceEnd = match.index + match[0].length;
  }
  const wordEnd = head.search(/\s\S*$/);

  let cut = max;
  // A boundary is only used if it does not throw away a large part of the text.
  if (paragraphEnd >= max * 0.8) cut = paragraphEnd;
  else if (sentenceEnd >= max * 0.5) cut = sentenceEnd;
  else if (wordEnd >= max * 0.5) cut = wordEnd;
  // Never leave half of a two-unit character (an emoji) at the end.
  else if (/[\uD800-\uDBFF]$/.test(head)) cut = max - 1;

  return { text: head.slice(0, cut).trimEnd(), truncated: true };
}
