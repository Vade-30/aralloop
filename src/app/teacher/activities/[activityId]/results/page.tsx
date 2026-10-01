// Results of a published activity: class summary, item analysis and every
// student's answers, with a score override on each answer.

import { notFound, redirect } from "next/navigation";
import { ItemAnalysis } from "@/components/teacher/ItemAnalysis";
import {
  classAverage,
  countNeedingReview,
  formatPercent,
  itemAnalysis,
} from "@/components/teacher/results-model";
import { StudentResults } from "@/components/teacher/StudentResults";
import { AiLabel, Badge, ButtonLink, Card, Page, PageHeader, SectionTitle, cn } from "@/components/ui";
import { getAiStatus } from "@/lib/ai";
import { getActivity, listStudents, listSubmissions } from "@/lib/db/repo";
import { requireRole } from "@/lib/session";
import { ACTIVITY_TYPE_LABELS } from "@/lib/types";

function Stat({
  label,
  value,
  note,
  warn = false,
}: {
  label: string;
  value: string;
  note?: string;
  warn?: boolean;
}) {
  return (
    // Not a Card: three of these share a phone's width, so the padding is tighter.
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4",
        warn && "ring-2 ring-amber-300",
      )}
    >
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">{value}</p>
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  );
}

export default async function ResultsPage(
  props: PageProps<"/teacher/activities/[activityId]/results">,
) {
  const user = await requireRole("teacher");
  const { activityId } = await props.params;

  const activity = await getActivity(activityId);
  if (!activity || activity.classId !== user.classId) notFound();
  // A draft has no results yet; the editor is where it gets published.
  if (activity.status !== "published") redirect(`/teacher/activities/${activity.id}`);

  const [students, submissions] = await Promise.all([
    listStudents(user.classId),
    listSubmissions(activity.id),
  ]);
  const average = classAverage(submissions);
  const toReview = countNeedingReview(submissions);
  const stats = itemAnalysis(activity.items, submissions);

  return (
    <Page>
      <PageHeader
        title={activity.title}
        description="Results"
        back={{ href: "/teacher", label: "Back to class" }}
        actions={
          <ButtonLink href={`/teacher/activities/${activity.id}`} variant="secondary">
            View activity
          </ButtonLink>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <Badge tone="success">Published</Badge>
        <Badge tone="brand">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
        <AiLabel provider={activity.aiProvider}>AI-generated · reviewed by teacher</AiLabel>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-2 sm:gap-3">
        <Stat
          label="Submitted"
          value={`${submissions.length} of ${students.length}`}
          note="students"
        />
        <Stat
          label="Class average"
          value={average === null ? "–" : formatPercent(average)}
          note={average === null ? "No submissions yet" : undefined}
        />
        <Stat
          label="Waiting for review"
          value={String(toReview)}
          note={toReview === 1 ? "answer" : "answers"}
          warn={toReview > 0}
        />
      </div>

      <section className="mb-8">
        <SectionTitle className="mb-3">Item analysis</SectionTitle>
        <ItemAnalysis stats={stats} submissionCount={submissions.length} />
      </section>

      <section>
        <SectionTitle className="mb-1">Students</SectionTitle>
        <p className="mb-3 text-sm text-slate-600">
          Open a student to see each answer. You can change any score.
        </p>
        {students.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-600">This class has no students yet.</p>
          </Card>
        ) : (
          <StudentResults
            students={students}
            submissions={submissions}
            items={activity.items}
            aiProvider={getAiStatus().provider}
          />
        )}
      </section>
    </Page>
  );
}
