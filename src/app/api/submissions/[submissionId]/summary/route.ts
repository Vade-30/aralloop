// POST /api/submissions/[submissionId]/summary — the plain-language summary
// for a parent, in English and Filipino. It is written by the AI the first
// time someone opens it and stored, so reloading never calls the AI again.
// A teacher's score override clears it, and the next request writes a new one.
//
// Open to the teacher of the class and the parent of the student.

import type { z } from "zod";
import { writeParentSummary, type ResultItem } from "@/lib/ai";
import { summaryRequest, type SummaryResponse } from "@/lib/contracts";
import {
  getActivity,
  getClass,
  getLesson,
  getSubmissionById,
  getUser,
  setSubmissionSummary,
} from "@/lib/db/repo";
import { notFound, parseBody, requireUser, route } from "@/lib/http";
import type { ActivityWithItems, SubmissionWithAnswers } from "@/lib/types";

export const maxDuration = 60;

type Context = { params: Promise<{ submissionId: string }> };

/** Like parseBody, but a request with no body counts as {} (every field has a default). */
async function parseOptionalBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<z.output<Schema>> {
  const text = await request.clone().text();
  if (text.trim() === "") return schema.parse({});
  return parseBody(request, schema);
}

/** Every item of the activity with what the student answered and scored. */
function toResultItems(
  activity: ActivityWithItems,
  submission: SubmissionWithAnswers,
): ResultItem[] {
  const answers = new Map(submission.answers.map((answer) => [answer.itemId, answer]));
  return activity.items.map((item) => {
    const answer = answers.get(item.id);
    return {
      position: item.position,
      type: item.type,
      question: item.question,
      correctAnswer: item.answerKey,
      response: answer?.response ?? "",
      score: answer?.score ?? 0,
      points: item.points,
      feedback: answer?.feedback ?? "",
    };
  });
}

export const POST = route(
  async (request, { params }: Context): Promise<SummaryResponse> => {
    const user = await requireUser();
    const { submissionId } = await params;

    const submission = await getSubmissionById(submissionId);
    const activity = submission && (await getActivity(submission.activityId));
    if (!submission || !activity) throw notFound("That submission");

    const isClassTeacher =
      user.role === "teacher" && activity.classId === user.classId;
    const isParentOfStudent =
      user.role === "parent" && user.childId === submission.studentId;
    if (!isClassTeacher && !isParentOfStudent) throw notFound("That submission");

    const body = await parseOptionalBody(request, summaryRequest);
    // Only the teacher may ask for a rewrite; from anyone else it is ignored.
    const regenerate = body.regenerate && isClassTeacher;

    if (submission.summary && submission.summaryProvider && !regenerate) {
      return { summary: submission.summary, provider: submission.summaryProvider };
    }

    const [lesson, schoolClass, student] = await Promise.all([
      getLesson(activity.lessonId),
      getClass(activity.classId),
      getUser(submission.studentId),
    ]);
    if (!lesson) throw notFound("The lesson for this activity");
    if (!schoolClass) throw notFound("The class for this activity");
    if (!student) throw notFound("The student for this submission");

    const written = await writeParentSummary({
      studentName: student.name,
      gradeLevel: schoolClass.gradeLevel,
      subject: schoolClass.subject,
      lessonTitle: lesson.title,
      activityTitle: activity.title,
      totalScore: submission.totalScore,
      maxScore: submission.maxScore,
      pendingReview: submission.needsReview,
      items: toResultItems(activity, submission),
    });

    await setSubmissionSummary(submission.id, written.data, written.provider);
    return { summary: written.data, provider: written.provider };
  },
);
