// POST /api/submissions/[submissionId]/ask — the after-submission tutor.
//
// It is addressed by submission id, so it cannot be reached for an activity
// the student has not handed in yet: there is no way to use it to get answers
// before submitting.
//
// Open to the student who owns the submission, that student's parent, and the
// teacher of the class.

import { answerTutorQuestion } from "@/lib/ai";
import { askRequest, type AskResponse } from "@/lib/contracts";
import {
  getActivity,
  getClass,
  getLesson,
  getSubmissionById,
  getUser,
} from "@/lib/db/repo";
import { notFound, parseBody, requireUser, route } from "@/lib/http";
import { toResultItems } from "@/lib/result-items";

export const maxDuration = 60;

type Context = { params: Promise<{ submissionId: string }> };

export const POST = route(
  async (request, { params }: Context): Promise<AskResponse> => {
    const user = await requireUser();
    const { submissionId } = await params;

    const submission = await getSubmissionById(submissionId);
    const activity = submission && (await getActivity(submission.activityId));
    if (!submission || !activity) throw notFound("That submission");

    const isOwner = user.role === "student" && user.id === submission.studentId;
    const isParentOfStudent =
      user.role === "parent" && user.childId === submission.studentId;
    const isClassTeacher =
      user.role === "teacher" && activity.classId === user.classId;
    if (!isOwner && !isParentOfStudent && !isClassTeacher) {
      throw notFound("That submission");
    }

    const { question, history } = await parseBody(request, askRequest);

    const [lesson, schoolClass, student] = await Promise.all([
      getLesson(activity.lessonId),
      getClass(activity.classId),
      isOwner ? user : getUser(submission.studentId),
    ]);
    if (!lesson) throw notFound("The lesson for this activity");
    if (!schoolClass) throw notFound("The class for this activity");
    if (!student) throw notFound("The student for this submission");

    const answered = await answerTutorQuestion({
      audience: isOwner ? "student" : "parent",
      studentName: student.name,
      gradeLevel: schoolClass.gradeLevel,
      lessonTitle: lesson.title,
      lessonContent: lesson.content,
      activityTitle: activity.title,
      items: toResultItems(activity, submission),
      question,
      history,
    });
    return { reply: answered.data.reply, provider: answered.provider };
  },
);
