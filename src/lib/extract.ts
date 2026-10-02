// Turns an uploaded lesson file (.txt, .md, .pdf, .docx or a photo) into clean
// plain text plus a suggested title. Runs on the server only: the PDF and Word
// parsers are Node packages (see serverExternalPackages in next.config.ts).
// A photo is read by whatever ImageReader the caller passes in (the API route
// passes the AI), so this file itself never calls a model.

import mammoth from "mammoth";
import { extractText } from "unpdf";
import { LIMITS } from "./contracts";
import { cutToLimit } from "./cut-text";

/** Photo types a teacher can upload, with the media type sent to the reader. */
export const IMAGE_MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
} as const;
type ImageExtension = keyof typeof IMAGE_MIME_TYPES;

/** File types a teacher can upload as a lesson. */
export const SUPPORTED_EXTENSIONS = [
  ".txt",
  ".md",
  ".pdf",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
] as const;
type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/** Reads the lesson text, and its heading if it shows one, from a photo. */
export type ImageReader = (image: {
  mimeType: string;
  data: Uint8Array;
}) => Promise<{ title: string; text: string }>;

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

function isImage(extension: string): extension is ImageExtension {
  return Object.hasOwn(IMAGE_MIME_TYPES, extension);
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
 * Pulls the plain text out of an uploaded lesson file. Throws ExtractError
 * for an unsupported type, an unreadable file, or a file with no text (for
 * example a scanned PDF). Photos are accepted only when readImage is given;
 * whatever it throws is passed on.
 */
export async function extractLessonText(
  fileName: string,
  data: Uint8Array,
  readImage?: ImageReader,
): Promise<{ title: string; text: string; truncated: boolean }> {
  const { stem, extension } = splitFileName(fileName);
  if (!isSupported(extension) || (isImage(extension) && !readImage)) {
    const accepted = SUPPORTED_EXTENSIONS.filter((each) => readImage || !isImage(each));
    const supported = `${accepted.slice(0, -1).join(", ")} or ${accepted.at(-1)}`;
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
  // A camera names its files "IMG_2041", so the heading in the photo is the
  // better title when there is one.
  let heading = "";
  if (isImage(extension) && readImage) {
    const read = await readImage({ mimeType: IMAGE_MIME_TYPES[extension], data });
    raw = read.text;
    heading = cleanText(read.title).replace(/\s+/g, " ");
  } else if (extension === ".pdf") raw = await readPdf(data);
  else if (extension === ".docx") raw = await readDocx(data);
  else raw = decodePlainText(data);

  const cleaned = cleanText(raw);
  if (cleaned.length < LIMITS.lessonContentMin) {
    throw new ExtractError(
      isImage(extension)
        ? `We could not read enough text in this photo. Take it again in good light, with the whole page in view and the words sharp, or ${PASTE_INSTEAD}.`
        : extension === ".pdf"
          ? `We could not find enough text in this PDF. Scanned pages are images, so their text cannot be read here. Upload a photo of the page, or ${PASTE_INSTEAD}.`
          : `This file has too little text to make an activity from. A lesson needs at least ${LIMITS.lessonContentMin} characters. Add more text, or ${PASTE_INSTEAD}.`,
    );
  }

  return {
    title: titleFrom(heading || stem),
    ...cutToLimit(cleaned, LIMITS.lessonContentMax),
  };
}
