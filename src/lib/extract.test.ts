// Tests for lesson file extraction. The .pdf and .docx fixtures are built in
// memory by the small writers below, so no binary files live in the repo and
// both real parsers (unpdf and mammoth) are exercised end to end.

import { describe, expect, it } from "vitest";
import { LIMITS } from "./contracts";
import { ExtractError, SUPPORTED_EXTENSIONS, extractLessonText } from "./extract";

const LESSON =
  "Photosynthesis is how plants make their own food. " +
  "They use sunlight, water and carbon dioxide to make sugar and oxygen.";

const utf8 = (text: string) => new TextEncoder().encode(text);

/** A one-page PDF with one line of Helvetica text per entry. ASCII only. */
function buildPdf(lines: string[]): Uint8Array {
  const escaped = lines.map((line) => line.replace(/[\\()]/g, "\\$&"));
  const content =
    lines.length === 0
      ? ""
      : `BT\n/F1 12 Tf\n14 TL\n72 740 Td\n${escaped.map((line) => `(${line}) Tj\nT*`).join("\n")}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A zip archive with every file stored uncompressed, which is all a .docx needs. */
function buildZip(files: Record<string, string>): Uint8Array {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.from(text, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0x21, 12); // date: 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, data);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // version made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(0, 12);
    entry.writeUInt16LE(0x21, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42); // where the local header starts
    central.push(entry, nameBytes);

    offset += local.length + nameBytes.length + data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const count = Object.keys(files).length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}

/** A minimal Word document with one paragraph per entry. */
function buildDocx(paragraphs: string[]): Uint8Array {
  const escapeXml = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`)
    .join("");
  const header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return buildZip({
    "[Content_Types].xml":
      `${header}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      "</Types>",
    "_rels/.rels":
      `${header}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>",
    "word/document.xml":
      `${header}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:body>${body}</w:body></w:document>`,
  });
}

/** Runs the extraction and returns the ExtractError it must throw. */
async function extractError(fileName: string, data: Uint8Array): Promise<ExtractError> {
  try {
    await extractLessonText(fileName, data);
  } catch (error) {
    expect(error).toBeInstanceOf(ExtractError);
    return error as ExtractError;
  }
  throw new Error(`Expected ${fileName} to be rejected.`);
}

describe("plain text files", () => {
  it("reads a .txt file", async () => {
    const result = await extractLessonText("lesson.txt", utf8(LESSON));
    expect(result).toEqual({ title: "lesson", text: LESSON, truncated: false });
  });

  it("reads a .md file and keeps its markdown", async () => {
    const markdown = `# Photosynthesis\n\n${LESSON}\n\n- sunlight\n- water`;
    const result = await extractLessonText("notes.md", utf8(markdown));
    expect(result.text).toBe(markdown);
    expect(result.truncated).toBe(false);
  });

  it("strips a byte order mark", async () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8(LESSON)]);
    const result = await extractLessonText("lesson.txt", withBom);
    expect(result.text).toBe(LESSON);
    expect(result.text.charCodeAt(0)).not.toBe(0xfeff);
  });

  it("normalises line endings, blank lines and trailing spaces", async () => {
    const messy = `  First line of the lesson.   \r\nSecond line.\t\r\n\r\n\r\n\r\n${LESSON}\r\rLast line.  \n\n`;
    const result = await extractLessonText("lesson.txt", utf8(messy));
    expect(result.text).toBe(
      `First line of the lesson.\nSecond line.\n\n${LESSON}\n\nLast line.`,
    );
  });

  it("keeps accented letters, including from files saved in an older Windows encoding", async () => {
    const text = `Si Niño ay nag-aaral tungkol sa piña. ${LESSON}`;
    expect((await extractLessonText("aralin.txt", utf8(text))).text).toBe(text);
    expect((await extractLessonText("aralin.txt", Buffer.from(text, "latin1"))).text).toBe(text);
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
    expect((await extractLessonText("aralin.txt", utf16)).text).toBe(text);
  });

  it("rejects a binary file that was renamed to .txt", async () => {
    const binary = new Uint8Array(400).fill(0);
    const error = await extractError("lesson.txt", binary);
    expect(error.userMessage).toMatch(/does not contain plain text/);
  });
});

describe("title", () => {
  it("comes from the file name, with dashes and underscores as spaces", async () => {
    const result = await extractLessonText("photosynthesis-notes_week__3.TXT", utf8(LESSON));
    expect(result.title).toBe("photosynthesis notes week 3");
  });

  it("only drops the last extension and any folder path", async () => {
    expect((await extractLessonText("lesson.final.v2.md", utf8(LESSON))).title).toBe(
      "lesson.final.v2",
    );
    expect((await extractLessonText("C:\\fakepath\\My Lesson.txt", utf8(LESSON))).title).toBe(
      "My Lesson",
    );
  });

  it("is cut to the longest allowed title", async () => {
    const name = `${"word-".repeat(60)}end.txt`;
    const result = await extractLessonText(name, utf8(LESSON));
    expect(result.title.length).toBeLessThanOrEqual(LIMITS.lessonTitleMax);
    expect(result.title.startsWith("word word word")).toBe(true);
    expect(result.title).toBe(result.title.trim());
  });

  it("falls back to a default when the name has nothing usable", async () => {
    expect((await extractLessonText("___.txt", utf8(LESSON))).title).toBe("Untitled lesson");
  });
});

describe("truncation", () => {
  const max = LIMITS.lessonContentMax;

  it("leaves text at the limit alone", async () => {
    const text = "a".repeat(max);
    const result = await extractLessonText("lesson.txt", utf8(text));
    expect(result.text).toHaveLength(max);
    expect(result.truncated).toBe(false);
  });

  it("cuts at a paragraph boundary when one is near the limit", async () => {
    const first = "First paragraph sentence. ".repeat(700).trim(); // 18,199 characters
    const second = "Second paragraph sentence. ".repeat(200).trim();
    const result = await extractLessonText("lesson.txt", utf8(`${first}\n\n${second}`));
    expect(result.truncated).toBe(true);
    expect(result.text).toBe(first);
  });

  it("cuts at a sentence boundary otherwise", async () => {
    const text = "This is one sentence of the lesson. ".repeat(1000);
    const result = await extractLessonText("lesson.txt", utf8(text));
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(max);
    expect(result.text.length).toBeGreaterThan(max - 40);
    expect(result.text.endsWith("of the lesson.")).toBe(true);
  });

  it("cuts between words when there is no sentence boundary", async () => {
    const text = "word ".repeat(6000);
    const result = await extractLessonText("lesson.txt", utf8(text));
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(max);
    expect(result.text.endsWith("word")).toBe(true);
  });

  it("cuts hard when the text has no boundary at all", async () => {
    const result = await extractLessonText("lesson.txt", utf8("a".repeat(max + 5000)));
    expect(result.truncated).toBe(true);
    expect(result.text).toHaveLength(max);
  });
});

describe("rejected files", () => {
  it("rejects an unsupported type and lists the supported ones", async () => {
    for (const name of ["slides.pptx", "old.doc", "photo.jpg", "no-extension"]) {
      const error = await extractError(name, utf8(LESSON));
      expect(error.userMessage).toMatch(/not supported/);
      for (const extension of SUPPORTED_EXTENSIONS) {
        expect(error.userMessage).toContain(extension);
      }
    }
  });

  it("rejects a file with too little text", async () => {
    const error = await extractError("lesson.txt", utf8("Too short."));
    expect(error.userMessage).toMatch(/too little text/);
    expect(error.userMessage).toContain(String(LIMITS.lessonContentMin));
    expect(error.message).toBe(error.userMessage);
    expect(error.name).toBe("ExtractError");
  });

  it("rejects an empty file", async () => {
    const error = await extractError("lesson.md", new Uint8Array());
    expect(error.userMessage).toMatch(/too little text/);
  });

  it("rejects a file over the upload limit", async () => {
    const error = await extractError("big.txt", new Uint8Array(LIMITS.uploadMaxBytes + 1));
    expect(error.userMessage).toMatch(/larger than 4 MB/);
  });
});

describe("pdf files", () => {
  it("reads the text of a real PDF", async () => {
    const pdf = buildPdf([
      "Photosynthesis is how plants make their own food.",
      "They use sunlight, water and carbon dioxide (CO2).",
      "The result is sugar and oxygen.",
    ]);
    const result = await extractLessonText("Science_Lesson-1.pdf", pdf);
    expect(result).toEqual({
      title: "Science Lesson 1",
      text:
        "Photosynthesis is how plants make their own food.\n" +
        "They use sunlight, water and carbon dioxide (CO2).\n" +
        "The result is sugar and oxygen.",
      truncated: false,
    });
  });

  it("explains that a scanned PDF has no text to read", async () => {
    const error = await extractError("scan.pdf", buildPdf([]));
    expect(error.userMessage).toMatch(/Scanned pages are images/);
    expect(error.userMessage).toMatch(/paste the lesson text instead/);
  });

  it("rejects a file that is not really a PDF", async () => {
    const error = await extractError("broken.pdf", utf8(LESSON));
    expect(error.userMessage).toMatch(/PDF could not be read/);
  });
});

describe("docx files", () => {
  it("reads the text of a real Word document", async () => {
    const docx = buildDocx([
      "Photosynthesis",
      "Plants make their own food from sunlight, water & carbon dioxide.",
      "Ang mga halaman ay gumagawa ng sariling pagkain. Si Niño ay nagtanim ng piña.",
    ]);
    const result = await extractLessonText("Aralin_2-halaman.docx", docx);
    expect(result.title).toBe("Aralin 2 halaman");
    expect(result.truncated).toBe(false);
    expect(result.text).toBe(
      "Photosynthesis\n\n" +
        "Plants make their own food from sunlight, water & carbon dioxide.\n\n" +
        "Ang mga halaman ay gumagawa ng sariling pagkain. Si Niño ay nagtanim ng piña.",
    );
  });

  it("rejects a file that is not really a Word document", async () => {
    const error = await extractError("broken.docx", utf8(LESSON));
    expect(error.userMessage).toMatch(/Word file could not be read/);
  });

  it("rejects a Word document with almost no text", async () => {
    const error = await extractError("empty.docx", buildDocx(["Hello."]));
    expect(error.userMessage).toMatch(/too little text/);
  });
});
