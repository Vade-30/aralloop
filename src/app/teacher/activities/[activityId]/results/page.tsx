// Results of a published activity: class summary, item analysis and every
// student's answers, with a score override on each answer.

import { ClipboardList, Eye, TrendingUp, Trophy, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { ItemAnalysis } from "@/components/teacher/ItemAnalysis";
import {
  classAverage,
  countNeedingReview,
  formatPercent,
  itemAnalysis,
} from "@/components/teacher/results-model";
import { OutcomeLegend } from "@/components/teacher/ResultsOutcome";
import { StudentResults } from "@/components/teacher/StudentResults";
import {
  AiLabel,
  Badge,
  ButtonLink,
  EmptyState,
  Page,
  PageHeader,
  SectionTitle,
  StatRow,
  StatTile,
} from "@/components/ui";
import { getAiStatus } from "@/lib/ai";
import { getActivity, listStudents, listSubmissions } from "@/lib/db/repo";
import { requireRole } from "@/lib/session";
import { ACTIVITY_TYPE_LABELS, type SubmissionWithAnswers } from "@/lib/types";

/** A submission's score as a share of its maximum, 0..1. */
function shareOf(submission: SubmissionWithAnswers): number {
  return submission.maxScore > 0 ? submission.totalScore / submission.maxScore : 0;
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

  // The spread of the class, for the tiles: who is at the top and how low it goes.
  const shares = submissions.map(shareOf);
  const highest = shares.length > 0 ? Math.max(...shares) : null;
  const lowest = shares.length > 0 ? Math.min(...shares) : null;
  const topSubmissions = submissions.filter((submission) => shareOf(submission) === highest);
  // Named when one student holds the top score; a tie shows how many share it.
  const topStudent =
    topSubmissions.length === 1
      ? students.find((student) => student.id === topSubmissions[0].studentId)
      : undefined;
  const highestHint =
    highest === null
      ? "No submissions yet"
      : topSubmissions.length > 1
        ? `${topSubmissions.length} students`
        : (topStudent?.name ?? "1 student");

  return (
    <Page>
      <PageHeader
        eyebrow="Results"
        title={activity.title}
        description={
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="success">Published</Badge>
            <Badge tone="brand">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
            <AiLabel provider={activity.aiProvider}>AI-generated · reviewed by teacher</AiLabel>
          </span>
        }
        back={{ href: "/teacher", label: "Back to class" }}
        actions={
          <ButtonLink href={`/teacher/activities/${activity.id}`} variant="secondary">
            {/* Not the eye: on this screen the eye stands for "to review". */}
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
            View activity
          </ButtonLink>
        }
        overlap
      />

      <StatRow className="mb-8">
        <StatTile
          value={
            <>
              {submissions.length}
              <span className="text-xl sm:text-2xl">{` of ${students.length}`}</span>
            </>
          }
          label="Submitted"
          hint="students"
          icon={<Users />}
        />
        <StatTile
          value={average === null ? "–" : formatPercent(average)}
          label="Class average"
          hint={lowest === null ? "No submissions yet" : `Lowest ${formatPercent(lowest)}`}
          tone={average !== null && average >= 0.75 ? "success" : "brand"}
          icon={<TrendingUp />}
        />
        <StatTile
          value={String(toReview)}
          label="Waiting for review"
          hint={toReview === 1 ? "answer" : "answers"}
          tone={toReview > 0 ? "warning" : "success"}
          icon={<Eye />}
        />
        <StatTile
          value={highest === null ? "–" : formatPercent(highest)}
          label="Highest score"
          hint={highestHint}
          icon={<Trophy />}
        />
      </StatRow>

      {/* The chart and the students each take the full width: within them, the
          bars line up beside their questions and each answer sits beside its key. */}
      <section className="mb-9">
        <ItemAnalysis stats={stats} submissionCount={submissions.length} />
      </section>

      <section>
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2.5">
          <div className="min-w-0">
            <SectionTitle>Students</SectionTitle>
            <p className="mt-0.5 text-sm font-semibold text-muted">
              Open a student to see each answer. You can change any score.
            </p>
          </div>
          {submissions.length > 0 && <OutcomeLegend className="pb-0.5" />}
        </div>
        {students.length === 0 ? (
          <EmptyState title="This class has no students yet." />
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
