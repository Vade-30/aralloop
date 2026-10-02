// POST /api/lessons/extract — pulls the text out of an uploaded lesson file
// (multipart/form-data, field "file") so the teacher can review it before
// saving. A photo of a lesson is read by the AI. Nothing is stored here.

import { readLessonImage } from "@/lib/ai";
import { LIMITS, type ExtractResponse } from "@/lib/contracts";
import { ExtractError, extractLessonText, type ImageReader } from "@/lib/extract";
import { ApiError, badRequest, requireUser, route } from "@/lib/http";

// Reading a photo is an AI call.
export const maxDuration = 60;

const LIMIT_IN_MB = LIMITS.uploadMaxBytes / (1024 * 1024);

const readImage: ImageReader = async (image) => {
  const result = await readLessonImage(image);
  if (result === null) {
    throw new ExtractError(
      "A photo can only be read when the AI service is set up, and AralLoop is running in sample mode. Type or paste the lesson text instead.",
    );
  }
  return result.data;
};

const tooLarge = () =>
  new ApiError(
    413,
    "too_large",
    `That file is too large. The limit is ${LIMIT_IN_MB} MB. Choose a smaller file or paste the lesson text instead.`,
  );

// Room for the multipart boundaries and headers around the file itself.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export const POST = route(async (request): Promise<ExtractResponse> => {
  await requireUser("teacher");

  // Refuse an oversized upload from its declared length, before reading it
  // into memory. The exact file size is checked again below.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > LIMITS.uploadMaxBytes + MULTIPART_OVERHEAD_BYTES) {
    throw tooLarge();
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("The upload could not be read. Choose the file again.");
  }

  const file = form.get("file");
  if (file === null || typeof file === "string") {
    throw badRequest("No file was received. Choose a file to upload.");
  }
  if (file.size > LIMITS.uploadMaxBytes) throw tooLarge();
  if (file.size === 0) {
    throw badRequest("That file is empty. Choose a file that has text in it.");
  }

  try {
    const { title, text, truncated } = await extractLessonText(
      file.name,
      new Uint8Array(await file.arrayBuffer()),
      readImage,
    );
    return { title, text, truncated };
  } catch (error) {
    if (error instanceof ExtractError) throw badRequest(error.userMessage);
    throw error;
  }
});
