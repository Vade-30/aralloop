// POST /api/activities/[activityId]/submissions — a student hands in their
// answers (one attempt). Objective items are checked by code and free-text
// answers by the AI; if the AI is unavailable the submission is still saved
// and those answers wait for the teacher.
//
// The answer key is used here on the server only. The response carries the
// student's scores and feedback, never the items.

import { submitRequest, type SubmissionResponse } from "@/lib/contracts";
import {
  createSubmission,
  DuplicateSubmissionError,
  getActivity,
  getClass,
  getLesson,
  getSubmission,
} from "@/lib/db/repo";
import { gradeSubmission } from "@/lib/grading";
import {
  badRequest,
  conflict,
  notFound,
  parseBody,
  requireUser,
  route,
} from "@/lib/http";

// Grading may call the AI.
export const maxDuration = 60;

type Context = { params: Promise<{ activityId: string }> };

const alreadySubmitted = () =>
  conflict("You have already submitted this activity.");

export const POST = route(
  async (request, { params }: Context): Promise<SubmissionResponse> => {
    const user = await requireUser("student");
    const { activityId } = await params;

    // A draft is reported as missing, so a student cannot tell it exists.
    const activity = await getActivity(activityId);
    if (
      !activity ||
      activity.status !== "published" ||
      activity.classId !== user.classId
    ) {
      throw notFound("That activity");
    }

    const body = await parseBody(request, submitRequest);

    if (await getSubmission(activity.id, user.id)) throw alreadySubmitted();

    const itemIds = new Set(activity.items.map((item) => item.id));
    const responses: Record<string, string> = {};
    for (const answer of body.answers) {
      if (!itemIds.has(answer.itemId)) {
        throw badRequest(
          "One of the answers does not belong to this activity. Reload the page and try again.",
        );
      }
      if (Object.hasOwn(responses, answer.itemId)) {
        throw badRequest(
          "One question was answered more than once. Reload the page and try again.",
        );
      }
      responses[answer.itemId] = answer.response;
    }

    const [lesson, schoolClass] = await Promise.all([
      getLesson(activity.lessonId),
      getClass(activity.classId),
    ]);
    if (!lesson) throw notFound("The lesson for this activity");
    if (!schoolClass) throw notFound("The class for this activity");

    const graded = await gradeSubmission({
      activity,
      lesson,
      gradeLevel: schoolClass.gradeLevel,
      responses,
    });

    try {
      const submission = await createSubmission({
        activityId: activity.id,
        studentId: user.id,
        answers: graded.answers,
        totalScore: graded.totalScore,
        maxScore: graded.maxScore,
        gradingProvider: graded.aiProvider,
      });
      return { submission, notice: graded.notice };
    } catch (error) {
      // Two submits at once: the first one stored wins.
      if (error instanceof DuplicateSubmissionError) throw alreadySubmitted();
      throw error;
    }
  },
);
