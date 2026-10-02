// Reading several files into one lesson: the order, the joined text, the
// length limit and the note the teacher sees.

import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/contracts";
import { inNameOrder, joinLessonFiles, uploadNote, type ReadLessonFile } from "./lesson-files";

function read(name: string, text: string, overrides: Partial<ReadLessonFile> = {}): ReadLessonFile {
  return { name, title: name.replace(/\.[^.]+$/, ""), text, truncated: false, ...overrides };
}

describe("inNameOrder", () => {
  it("sorts by name, counting numbers as numbers", () => {
    const names = ["page-10.jpg", "Page-2.jpg", "page-1.jpg", "IMG_2042.jpg", "IMG_2041.jpg"];
    expect(inNameOrder(names.map((name) => ({ name }))).map((file) => file.name)).toEqual([
      "IMG_2041.jpg",
      "IMG_2042.jpg",
      "page-1.jpg",
      "Page-2.jpg",
      "page-10.jpg",
    ]);
  });

  it("leaves the list it was given as it was", () => {
    const files = [{ name: "b.txt" }, { name: "a.txt" }];
    inNameOrder(files);
    expect(files.map((file) => file.name)).toEqual(["b.txt", "a.txt"]);
  });
});

describe("joinLessonFiles", () => {
  it("joins the text in order with a blank line between files and takes the first title", () => {
    const joined = joinLessonFiles([
      read("part-1.pdf", "Heat moves by conduction.", { title: "How heat travels" }),
      read("part-2.docx", "Heat also moves by convection."),
    ]);
    expect(joined).toEqual({
      title: "How heat travels",
      text: "Heat moves by conduction.\n\nHeat also moves by convection.",
      truncated: false,
    });
  });

  it("gives one file back unchanged", () => {
    const joined = joinLessonFiles([read("notes.txt", "A short lesson.")]);
    expect(joined).toEqual({ title: "notes", text: "A short lesson.", truncated: false });
  });

  it("cuts the joined text to the lesson limit at the end of a sentence", () => {
    const sentence = "Plants need sunlight to make food. ";
    const half = sentence.repeat(Math.ceil(LIMITS.lessonContentMax / sentence.length / 2) + 5).trim();
    const joined = joinLessonFiles([read("a.txt", half), read("b.txt", half)]);
    expect(joined.truncated).toBe(true);
    expect(joined.text.length).toBeLessThanOrEqual(LIMITS.lessonContentMax);
    expect(joined.text.endsWith("food.")).toBe(true);
  });

  it("reports a file that was already cut on the server", () => {
    const joined = joinLessonFiles([read("a.txt", "First."), read("b.pdf", "Second.", { truncated: true })]);
    expect(joined.truncated).toBe(true);
  });
});

describe("uploadNote", () => {
  it("names the one file that was read", () => {
    expect(uploadNote([read("notes.txt", "")], false)).toBe(
      "Text read from notes.txt. Check it above before generating.",
    );
    expect(uploadNote([read("page.JPG", "")], false)).toMatch(
      /^The AI read this text from page\.JPG\. It can misread a word/,
    );
    expect(uploadNote([read("long.pdf", "")], true)).toMatch(
      /longer than 20,000 characters, so only the first part was kept\.$/,
    );
  });

  it("lists several files in the order they were joined", () => {
    expect(uploadNote([read("a.pdf", ""), read("b.docx", "")], false)).toBe(
      "Text read from 2 files and joined in this order: a.pdf, b.docx. Check it above before generating.",
    );
  });

  it("warns about photos and about text that was cut", () => {
    const note = uploadNote([read("1.jpg", ""), read("2.png", ""), read("3.pdf", "")], true);
    expect(note).toContain("joined in this order: 1.jpg, 2.png, 3.pdf.");
    expect(note).toContain("Together they were longer than 20,000 characters");
    expect(note).toContain("The AI read the photos and can misread a word");
    expect(uploadNote([read("1.jpg", ""), read("3.pdf", "")], false)).toContain("The AI read the photo and");
  });
});
