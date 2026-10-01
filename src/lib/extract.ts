// Turns an uploaded lesson file (.txt, .md, .pdf or .docx) into clean plain
// text plus a suggested title. Runs on the server only: the PDF and Word
// parsers are Node packages (see serverExternalPackages in next.config.ts).

import mammoth from "mammoth";
import { extractText } from "unpdf";
import { LIMITS } from "./contracts";

/** File types a teacher can upload as a lesson. */
export const SUPPORTED_EXTENSIONS = [".txt", ".md", ".pdf", ".docx"] as const;
type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export class ExtractError extends Error {
  /** Safe to show to the user. */
  readonly userMessage: string;
  constructor(userMessage: string) {
    super(userMessage);
    this.name = "ExtractError";
    this.userMessage = userMessage;
  }
}

const PASTE_INSTEAD = "paste the lesson text instead";

function isSupported(extension: string): extension is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extension);
}

/** Splits "C:\\notes\\My-lesson.PDF" into "My-lesson" and ".pdf". */
function splitFileName(fileName: string): { stem: string; extension: string } {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return { stem: base, extension: "" };
  return { stem: base.slice(0, dot), extension: base.slice(dot).toLowerCase() };
}

function titleFrom(stem: string): string {
  const title = stem
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITS.lessonTitleMax)
    .trim();
  return title || "Untitled lesson";
}

function decodeAs(encoding: string, data: Uint8Array, fatal = false): string {
  return new TextDecoder(encoding, { fatal }).decode(data);
}

/**
 * Reads a plain-text file. UTF-8 is expected; files saved by older Windows
 * editors as UTF-16 or "ANSI" are also read, so that letters such as ñ
 * survive.
 */
function decodePlainText(data: Uint8Array): string {
  let text: string;
  if (data[0] === 0xff && data[1] === 0xfe) {
    text = decodeAs("utf-16le", data);
  } else if (data[0] === 0xfe && data[1] === 0xff) {
    text = decodeAs("utf-16be", data);
  } else {
    try {
      text = decodeAs("utf-8", data, true);
    } catch {
      try {
        text = decodeAs("windows-1252", data);
      } catch {
        // This Node build has no legacy encodings; unknown bytes become "?" marks.
        text = decodeAs("utf-8", data);
      }
    }
  }
  if (text.includes("\u0000")) {
    throw new ExtractError(
      `This file does not contain plain text, so it could not be read. Upload a different file or ${PASTE_INSTEAD}.`,
    );
  }
  // TextDecoder already drops a leading byte order mark; this covers a stray one.
  return text.replace(/^\uFEFF/, "");
}

async function readPdf(data: Uint8Array): Promise<string> {
  try {
    // A copy, because PDF.js takes ownership of the bytes it is given. Passing
    // the bytes (not an open document) lets unpdf release the document itself.
    const { text } = await extractText(new Uint8Array(data), { mergePages: true });
    return text;
  } catch (error) {
    const locked = error instanceof Error && error.name === "PasswordException";
    throw new ExtractError(
      locked
        ? `This PDF is locked with a password. Remove the password, or ${PASTE_INSTEAD}.`
        : `This PDF could not be read. It may be damaged. Try another file, or ${PASTE_INSTEAD}.`,
    );
  }
}

async function readDocx(data: Uint8Array): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(data) });
    return result.value;
  } catch {
    throw new ExtractError(
      `This Word file could not be read. Save it again as .docx and try once more, or ${PASTE_INSTEAD}.`,
    );
  }
}

function cleanText(text: string): string {
  return (
    text
      .replace(/\r\n?|[\u2028\u2029\f]/g, "\n")
      // PostgreSQL cannot store a NUL character, and the other control
      // characters are noise. Line breaks and tabs stay.
      .replace(/\p{Cc}/gu, (char) => (char === "\n" || char === "\t" ? char : ""))
      .replace(/[\uFEFF\u200B]/g, "")
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Cuts text to max characters, preferably at the end of a paragraph, else at
 * the end of a sentence, else between words.
 */
function cutToLimit(text: string, max: number): { text: string; truncated: boolean } {
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

/**
 * Pulls the plain text out of an uploaded lesson file. Throws ExtractError
 * for an unsupported type, an unreadable file, or a file with no text (for
 * example a scanned PDF).
 */
export async function extractLessonText(
  fileName: string,
  data: Uint8Array,
): Promise<{ title: string; text: string; truncated: boolean }> {
  const { stem, extension } = splitFileName(fileName);
  if (!isSupported(extension)) {
    const supported = `${SUPPORTED_EXTENSIONS.slice(0, -1).join(", ")} or ${SUPPORTED_EXTENSIONS.at(-1)}`;
    throw new ExtractError(
      `This file type is not supported. Upload a ${supported} file, or ${PASTE_INSTEAD}.`,
    );
  }
  if (data.byteLength > LIMITS.uploadMaxBytes) {
    const megabytes = LIMITS.uploadMaxBytes / (1024 * 1024);
    throw new ExtractError(
      `This file is larger than ${megabytes} MB. Upload a smaller file, or ${PASTE_INSTEAD}.`,
    );
  }

  let raw: string;
  if (extension === ".pdf") raw = await readPdf(data);
  else if (extension === ".docx") raw = await readDocx(data);
  else raw = decodePlainText(data);

  const cleaned = cleanText(raw);
  if (cleaned.length < LIMITS.lessonContentMin) {
    throw new ExtractError(
      extension === ".pdf"
        ? `We could not find enough text in this PDF. Scanned pages are images, so their text cannot be read. Type or ${PASTE_INSTEAD}.`
        : `This file has too little text to make an activity from. A lesson needs at least ${LIMITS.lessonContentMin} characters. Add more text, or ${PASTE_INSTEAD}.`,
    );
  }

  return { title: titleFrom(stem), ...cutToLimit(cleaned, LIMITS.lessonContentMax) };
}
