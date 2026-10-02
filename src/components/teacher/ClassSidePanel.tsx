// Side panel of the teacher dashboard: the class's join code and students,
// and a short reminder of how a lesson travels from the teacher to the parent.

import { FilePlus2, HeartHandshake, MessageSquareText, PencilLine } from "lucide-react";
import { Avatar, Card } from "@/components/ui";
import type { SchoolClass } from "@/lib/types";
import { plural } from "./format";
import { LessonSteps, type LessonStep } from "./LessonSteps";

/** Avatars shown before the rest are folded into "+n". */
const AVATAR_LIMIT = 5;
const AVATAR_TONES = ["accent", "brand", "soft"] as const;

const HOW_IT_WORKS: LessonStep[] = [
  {
    icon: <FilePlus2 />,
    tone: "accent",
    title: "Add a lesson",
    text: "Paste the text or upload a file.",
  },
  {
    icon: <PencilLine />,
    tone: "brand",
    title: "Review the draft",
    text: "The AI drafts an activity. You edit it and publish.",
  },
  {
    icon: <MessageSquareText />,
    title: "Students answer",
    text: "Answers are graded with feedback. You can change any score.",
  },
  {
    icon: <HeartHandshake />,
    tone: "success",
    title: "Parents stay in the loop",
    text: "They read a summary in English or Filipino.",
  },
];

export function ClassSidePanel({
  schoolClass,
  studentNames,
}: {
  schoolClass: SchoolClass;
  studentNames: string[];
}) {
  const shown = studentNames.slice(0, AVATAR_LIMIT);
  const hidden = studentNames.length - shown.length;

  return (
    <aside aria-label="About this class" className="space-y-6 lg:sticky lg:top-6">
      <div
        className="animate-rise overflow-hidden rounded-3xl border-2 border-line bg-white"
        style={{ animationDelay: "160ms" }}
      >
        <div className="relative isolate overflow-hidden bg-brand-600 px-5 pb-5 pt-4 text-white">
          <span
            aria-hidden="true"
            className="absolute -right-8 -top-10 -z-10 h-28 w-28 rounded-full bg-brand-500"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-5 -right-3 -z-10 h-12 w-12 rounded-full bg-accent-400"
          />
          <p className="text-xs font-black uppercase tracking-widest text-brand-100">Join code</p>
          {/* Plain large letters: raised tiles here looked like keys to press. */}
          <p className="mt-1 break-all font-display text-4xl font-extrabold leading-none tracking-[0.18em] text-white">
            {schoolClass.joinCode}
          </p>
        </div>
        <div className="px-5 py-4">
          {shown.length > 0 && (
            <div aria-hidden="true" className="mb-3 flex items-center -space-x-2">
              {shown.map((name, index) => (
                <Avatar
                  key={index}
                  name={name}
                  tone={AVATAR_TONES[index % AVATAR_TONES.length]}
                  className="ring-[3px] ring-white"
                />
              ))}
              {hidden > 0 && (
                <span className="flex h-11 min-w-11 items-center justify-center rounded-full bg-brand-50 px-2 text-sm font-black text-brand-800 ring-[3px] ring-white">
                  +{hidden}
                </span>
              )}
            </div>
          )}
          <p className="text-[15px] font-extrabold text-ink">
            {plural(studentNames.length, "student")} in this class
          </p>
          <p className="text-sm font-semibold text-muted">
            {schoolClass.gradeLevel} · {schoolClass.subject}
          </p>
        </div>
      </div>

      <Card className="animate-rise" style={{ animationDelay: "240ms" }}>
        <h2 className="text-lg font-extrabold text-ink">How it works</h2>
        <LessonSteps steps={HOW_IT_WORKS} className="mt-4" />
      </Card>
    </aside>
  );
}
