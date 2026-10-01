// PATCH /api/answers/[answerId] — the teacher overrides one answer's score
// (and optionally its feedback). The teacher has the final say on every grade.

import { overrideAnswerRequest, type OverrideAnswerResponse } from "@/lib/contracts";
import {
  getActivity,
  getAnswer,
  getSubmissionById,
  overrideAnswer,
} from "@/lib/db/repo";
import { badRequest, notFound, parseBody, requireUser, route } from "@/lib/http";
type Context = { params: Promise<{ answerId: string }> };

export const PATCH = route(
  async (request, { params }: Context): Promise<OverrideAnswerResponse> => {
    const user = await requireUser("teacher");
    const { answerId } = await params;

    // Walk answer -> submission -> activity to find out whose class it is.
    const answer = await getAnswer(answerId);
    const owner = answer && (await getSubmissionById(answer.submissionId));
    const activity = owner && (await getActivity(owner.activityId));
    const item = activity?.items.find((candidate) => candidate.id === answer?.itemId);
    if (!answer || !activity || !item || activity.classId !== user.classId) {
      throw notFound("That answer");
    }

    const { score, feedback } = await parseBody(request, overrideAnswerRequest);
    if (score > item.points) {
      throw badRequest(
        `The score cannot be higher than ${item.points}, the points for this question.`,
      );
    }

    const submission = await overrideAnswer(answer.id, { score, feedback });
    if (!submission) throw notFound("That answer");
    return { submission };
  },
);
