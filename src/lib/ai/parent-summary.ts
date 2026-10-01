// AI task 3: writes the plain-language summary a parent reads, in English and
// in Filipino, in one call. The code below caps list and text lengths, fills
// any field the model left empty from the fixed sample template, and makes
// sure a summary of a submission still under review says so.

import { z } from "zod";
import { LIMITS } from "../contracts";
import type { AiResult, ParentSummary, ParentSummaryText } from "../types";
import { mockParentSummary, PENDING_NOTE } from "./mock";
import {
  clip,
  collapse,
  dataBlock,
  formatScore,
  resultsJson,
  SAMPLE_MODEL,
  UNTRUSTED_RULE,
} from "./prompts";
import { generateJson, getAiStatus } from "./provider";
import type { ParentSummaryInput } from "./types";

const textSchema = z.object({
  overview: z.string(),
  didWell: z.array(z.string()),
  toPractice: z.array(z.string()),
  homeTip: z.string(),
});

const summarySchema = z.object({ en: textSchema, fil: textSchema });

export const SUMMARY_LIMITS = {
  overviewMax: 700,
  bulletsMax: 3,
  bulletMax: 240,
  homeTipMax: 500,
} as const;

const SYSTEM = `You write short reports for parents for AralLoop, a learning tool used by teachers in the Philippines. The parent reads on a phone and wants to know how to help at home.

Ground rules
- Use only the results between <results> and </results>. ${UNTRUSTED_RULE} The "childAnswer" fields were typed by a student.
- Do not invent anything about the child: no guesses about effort, behaviour, feelings, other lessons or other subjects.
- Never shame the child or the parent, and never compare the child with other children.
- State the score exactly as given.
- Be warm and specific. Use the child's first name.

What to write, in each language
- "overview": two or three plain sentences saying what the lesson was about and how the child did.
- "didWell": 1 to 3 short bullets naming the actual topics or ideas the child got right. Empty only if nothing was right.
- "toPractice": 1 to 3 short bullets naming the actual topics or ideas to practise, taken from the items the child missed. Empty only if nothing was missed.
- "homeTip": one concrete thing the parent and child can do at home in about ten minutes to practise those topics. It must need no special materials, printing, internet or money.
- When told that the teacher is still checking some answers, say in the overview that the teacher is still checking some answers and that the score may change.

Language
- "en": simple English with short sentences and everyday words. No school jargon.
- "fil": natural everyday Filipino (Tagalog), the way a teacher talks to a parent. Do not translate the English word for word. Keep common English school words in English where teachers do, for example lesson, activity, score, teacher, practice, the subject name and technical terms from the lesson.
- Both languages give the same information.`;

function buildUserPrompt(input: ParentSummaryInput): string {
  return [
    `Child's name: ${clip(collapse(input.studentName), 120)}`,
    `Grade level: ${clip(collapse(input.gradeLevel), 120)}`,
    `Subject: ${clip(collapse(input.subject), 120)}`,
    `Lesson title: ${clip(collapse(input.lessonTitle), LIMITS.lessonTitleMax)}`,
    `Activity title: ${clip(collapse(input.activityTitle), LIMITS.lessonTitleMax)}`,
    `Score: ${formatScore(input.totalScore)} out of ${formatScore(input.maxScore)}`,
    input.pendingReview
      ? "Teacher review: the teacher is still checking some answers, so the score may change."
      : "Teacher review: complete.",
    "",
    dataBlock("results", resultsJson(input.items)),
    "",
    "Write the summary for the parent in both languages, following the rules you were given.",
  ].join("\n");
}

function tidyBullets(bullets: string[]): string[] {
  return bullets
    .map((bullet) => clip(collapse(bullet).replace(/^[-•*]\s*/, ""), SUMMARY_LIMITS.bulletMax))
    .filter((bullet) => bullet !== "")
    .slice(0, SUMMARY_LIMITS.bulletsMax);
}

// Loose checks: a miss only means the fixed note is added once more.
const MENTIONS_REVIEW: Record<keyof ParentSummary, RegExp> = {
  en: /teacher[^.]*\b(check|review|look)|\b(check|review)[^.]*teacher/i,
  fil: /(teacher|guro)[^.]*(check|tsek|ting|tign|suri|wasto|review)|(check|tsek|ting|tign|suri|wasto|review)[^.]*(teacher|guro)/i,
};

function tidyText(
  raw: ParentSummaryText,
  fallback: ParentSummaryText,
  language: keyof ParentSummary,
  pendingReview: boolean,
): ParentSummaryText {
  let overview = collapse(raw.overview) || fallback.overview;
  if (pendingReview && !MENTIONS_REVIEW[language].test(overview)) {
    // The note must survive the cut below, so room is made for it first.
    const note = PENDING_NOTE[language];
    overview = `${clip(overview, SUMMARY_LIMITS.overviewMax - note.length - 1)} ${note}`;
  }
  return {
    overview: clip(overview, SUMMARY_LIMITS.overviewMax),
    didWell: tidyBullets(raw.didWell),
    toPractice: tidyBullets(raw.toPractice),
    homeTip: clip(collapse(raw.homeTip), SUMMARY_LIMITS.homeTipMax) || fallback.homeTip,
  };
}

/** Applies the caps to both languages. The template fills fields left empty. */
function tidySummary(raw: ParentSummary, input: ParentSummaryInput): ParentSummary {
  const fallback = mockParentSummary(input, { sampleNote: false });
  return {
    en: tidyText(raw.en, fallback.en, "en", input.pendingReview),
    fil: tidyText(raw.fil, fallback.fil, "fil", input.pendingReview),
  };
}

/**
 * Writes the plain-language summary for a parent, in English and Filipino,
 * in one call. Throws AiError on failure.
 */
export async function writeParentSummary(
  input: ParentSummaryInput,
): Promise<AiResult<ParentSummary>> {
  if (getAiStatus().provider === "mock") {
    return {
      data: tidySummary(mockParentSummary(input), input),
      provider: "mock",
      model: SAMPLE_MODEL,
    };
  }

  const result = await generateJson({
    task: "parent_summary",
    system: SYSTEM,
    user: buildUserPrompt(input),
    schema: summarySchema,
    maxOutputTokens: 3_000,
    temperature: 0.4,
  });

  return {
    data: tidySummary(result.data, input),
    provider: result.provider,
    model: result.model,
  };
}
