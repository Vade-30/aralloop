// POST /api/lessons — a teacher saves a lesson into their own class.

import { createLessonRequest, type CreateLessonResponse } from "@/lib/contracts";
import { createLesson } from "@/lib/db/repo";
import { parseBody, requireUser, route } from "@/lib/http";

export const POST = route(async (request): Promise<CreateLessonResponse> => {
  const user = await requireUser("teacher");
  const { title, content } = await parseBody(request, createLessonRequest);
  // The class always comes from the session, never from the request.
  const lesson = await createLesson({ classId: user.classId, title, content });
  return { lesson };
});
