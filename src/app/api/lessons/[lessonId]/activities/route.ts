// POST /api/lessons/[lessonId]/activities — the AI turns a lesson into an
// activity, which is stored as a draft for the teacher to review. Nothing
// reaches students until the teacher publishes it.

import { generateActivity } from "@/lib/ai";
import { generateActivityRequest, type ActivityResponse } from "@/lib/contracts";
import { createActivity, getClass, getLesson } from "@/lib/db/repo";
import { notFound, parseOptionalBody, requireUser, route } from "@/lib/http";

export const maxDuration = 60;

type Context = { params: Promise<{ lessonId: string }> };

export const POST = route(
  async (request, { params }: Context): Promise<ActivityResponse> => {
    const user = await requireUser("teacher");
    const { lessonId } = await params;

    const lesson = await getLesson(lessonId);
    if (!lesson || lesson.classId !== user.classId) throw notFound("That lesson");

    const { itemCount, preferredType } = await parseOptionalBody(
      request,
      generateActivityRequest,
    );

    const schoolClass = await getClass(lesson.classId);
    if (!schoolClass) throw notFound("The class for this lesson");

    const generated = await generateActivity({
      lessonTitle: lesson.title,
      lessonContent: lesson.content,
      gradeLevel: schoolClass.gradeLevel,
      subject: schoolClass.subject,
      itemCount,
      preferredType,
    });

    const activity = await createActivity({
      lessonId: lesson.id,
      classId: lesson.classId,
      generated: generated.data,
      provider: generated.provider,
      model: generated.model,
    });
    return { activity };
  },
);
