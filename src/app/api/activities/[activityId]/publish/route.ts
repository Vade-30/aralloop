// POST /api/activities/[activityId]/publish — the teacher approves a draft so
// students can see it. Publishing twice is harmless.

import type { PublishResponse } from "@/lib/contracts";
import { getActivity, publishActivity } from "@/lib/db/repo";
import { badRequest, notFound, requireUser, route } from "@/lib/http";

type Context = { params: Promise<{ activityId: string }> };

export const POST = route(
  async (_request, { params }: Context): Promise<PublishResponse> => {
    const user = await requireUser("teacher");
    const { activityId } = await params;

    const existing = await getActivity(activityId);
    if (!existing || existing.classId !== user.classId) {
      throw notFound("That activity");
    }

    if (existing.status === "published") {
      // Returned as it is, so the original publish time is kept.
      const { items, ...activity } = existing;
      void items;
      return { activity };
    }
    if (existing.items.length === 0) {
      throw badRequest("This activity has no questions. Add at least one before publishing.");
    }

    const activity = await publishActivity(existing.id);
    if (!activity) throw notFound("That activity");
    return { activity };
  },
);
