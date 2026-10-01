// PATCH /api/activities/[activityId]  — the teacher saves their edits to a draft.
// DELETE /api/activities/[activityId] — the teacher discards a draft.
//
// Published activities are locked: students may already be answering them.

import {
  LIMITS,
  updateActivityRequest,
  type ActivityResponse,
  type OkResponse,
  type UpdateActivityRequest,
} from "@/lib/contracts";
import { deleteActivity, getActivity, updateActivity } from "@/lib/db/repo";
import {
  badRequest,
  conflict,
  notFound,
  parseBody,
  requireUser,
  route,
} from "@/lib/http";
import type { ActivityWithItems, ItemInput, User } from "@/lib/types";

type Context = { params: Promise<{ activityId: string }> };

const TRUE_FALSE_CHOICES = ["True", "False"] as const;

/** The activity, or a 404 if it is missing or belongs to another class. */
async function requireOwnActivity(
  activityId: string,
  teacher: User,
): Promise<ActivityWithItems> {
  const activity = await getActivity(activityId);
  if (!activity || activity.classId !== teacher.classId) {
    throw notFound("That activity");
  }
  return activity;
}

/**
 * Checks that one edited item is consistent with its type and drops the
 * fields that do not belong to that type, so grading never has to guess.
 * `number` is the item's 1-based place in the list, used in error messages.
 */
function checkItem(
  item: UpdateActivityRequest["items"][number],
  number: number,
): ItemInput {
  const problem = (message: string) => badRequest(`Item ${number}: ${message}`);
  const common = {
    type: item.type,
    question: item.question,
    explanation: item.explanation || null,
    points: item.points,
  };

  switch (item.type) {
    case "multiple_choice": {
      if (!item.choices) throw problem("add at least two choices.");
      if (new Set(item.choices).size !== item.choices.length) {
        throw problem("two choices are the same. Make each choice different.");
      }
      if (!item.choices.includes(item.answerKey)) {
        throw problem("the correct answer must match one of the choices exactly.");
      }
      return {
        ...common,
        choices: item.choices,
        answerKey: item.answerKey,
        acceptedAnswers: [],
        rubric: null,
      };
    }
    case "true_false": {
      const answerKey = TRUE_FALSE_CHOICES.find(
        (choice) => choice.toLowerCase() === item.answerKey.toLowerCase(),
      );
      if (!answerKey) {
        throw problem('the correct answer must be "True" or "False".');
      }
      return {
        ...common,
        choices: [...TRUE_FALSE_CHOICES],
        answerKey,
        acceptedAnswers: [],
        rubric: null,
      };
    }
    case "identification":
      return {
        ...common,
        choices: null,
        answerKey: item.answerKey,
        acceptedAnswers: item.acceptedAnswers,
        rubric: null,
      };
    case "short_answer":
      return {
        ...common,
        choices: null,
        answerKey: item.answerKey,
        acceptedAnswers: [],
        // The AI grades short answers against the rubric, so there must be
        // one: without it, the model answer is the standard.
        rubric: item.rubric || item.answerKey.slice(0, LIMITS.feedbackMax),
      };
  }
}

export const PATCH = route(
  async (request, { params }: Context): Promise<ActivityResponse> => {
    const user = await requireUser("teacher");
    const { activityId } = await params;
    const existing = await requireOwnActivity(activityId, user);
    if (existing.status === "published") {
      throw conflict("Published activities cannot be edited.");
    }

    const body = await parseBody(request, updateActivityRequest);
    const items = body.items.map((item, index) => checkItem(item, index + 1));

    const activity = await updateActivity(existing.id, {
      title: body.title,
      instructions: body.instructions,
      items,
    });
    if (!activity) {
      // It was a draft a moment ago, so it was published or deleted meanwhile.
      throw conflict(
        "This activity was published or deleted while you were editing it. Reload the page.",
      );
    }
    return { activity };
  },
);

export const DELETE = route(
  async (_request, { params }: Context): Promise<OkResponse> => {
    const user = await requireUser("teacher");
    const { activityId } = await params;
    const existing = await requireOwnActivity(activityId, user);
    if (existing.status === "published") {
      throw conflict("Published activities cannot be deleted.");
    }

    await deleteActivity(existing.id);
    return { ok: true };
  },
);
