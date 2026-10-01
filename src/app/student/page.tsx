// The student's home: the published activities of their class. Activities
// still to answer come first with a "Start" link; answered ones follow with
// the score and a "Review" link.

import {
  ArrowRight,
  CircleCheck,
  Eye,
  ListChecks,
  ListTodo,
  PenLine,
  Shapes,
  TextCursorInput,
  ToggleLeft,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { ClipboardArt, RingArt, StarArt } from "@/components/student/art";
import { activitiesLabel, pointsLabel, questionsLabel } from "@/components/student/labels";
import { percentLabel } from "@/components/student/outcome";
import {
  Badge,
  ButtonLink,
  CARD_LIFT,
  Card,
  EmptyState,
  IconTile,
  Page,
  PageHeader,
  ProgressBar,
  Score,
  ScoreRing,
  SectionTitle,
  StatRow,
  StatTile,
  cn,
} from "@/components/ui";
import { getClass, listActivities, listSubmissionsForStudent } from "@/lib/db/repo";
import { requireRole } from "@/lib/session";
import {
  ACTIVITY_TYPE_LABELS,
  type ActivitySummary,
  type ActivityType,
  type Submission,
} from "@/lib/types";

const TYPE_ICONS: Record<ActivityType, LucideIcon> = {
  multiple_choice: ListChecks,
  true_false: ToggleLeft,
  identification: TextCursorInput,
  short_answer: PenLine,
  mixed: Shapes,
};

// The whole card is the link: the button's hit area is stretched over it.
const CARD_CLASS = cn("relative flex h-full flex-col gap-4", CARD_LIFT);
const STRETCHED = "after:absolute after:inset-0 after:rounded-3xl";
const STAGGER_MS = 80;

/** When the class first saw the activity; drafts have no publish date. */
function shownAt(activity: ActivitySummary): string {
  return activity.publishedAt ?? activity.createdAt;
}

/** "Miguel Santos" -> "Miguel". */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Mean of each score as a share of its maximum, 0..1. Null if there is none. */
function averageScore(submissions: Submission[]): number | null {
  const scored = submissions.filter((submission) => submission.maxScore > 0);
  if (scored.length === 0) return null;
  const sum = scored.reduce(
    (acc, submission) => acc + submission.totalScore / submission.maxScore,
    0,
  );
  return sum / scored.length;
}

function ActivityHeading({ activity }: { activity: ActivitySummary }) {
  return (
    <>
      <h3 className="break-words text-lg font-extrabold leading-snug text-ink">
        {activity.title}
      </h3>
      <p className="mt-0.5 break-words text-sm font-semibold text-muted">
        Lesson: {activity.lessonTitle}
      </p>
    </>
  );
}

export default async function StudentHomePage() {
  const user = await requireRole("student");
  const [schoolClass, published, submissions] = await Promise.all([
    getClass(user.classId),
    listActivities(user.classId, { status: "published" }),
    listSubmissionsForStudent(user.id),
  ]);

  // ISO dates sort correctly as text.
  const activities = [...published].sort((a, b) => shownAt(b).localeCompare(shownAt(a)));
  const submissionByActivity = new Map(
    submissions.map((submission) => [submission.activityId, submission]),
  );

  const toDo = activities.filter((activity) => !submissionByActivity.has(activity.id));
  const done = activities.flatMap((activity) => {
    const submission = submissionByActivity.get(activity.id);
    return submission ? [{ activity, submission }] : [];
  });
  // The numbers describe the activities listed below, nothing else.
  const average = averageScore(done.map((entry) => entry.submission));
  const checkingCount = done.filter((entry) => entry.submission.needsReview).length;

  return (
    <Page>
      <PageHeader
        eyebrow={
          schoolClass ? `${schoolClass.name} · ${schoolClass.subject}` : "Your class activities"
        }
        title={`Hello, ${firstName(user.name)}`}
        description={
          activities.length === 0
            ? undefined
            : toDo.length > 0
              ? `${activitiesLabel(toDo.length)} to do`
              : "You have answered every activity."
        }
        actions={
          activities.length > 0 && (
            <div className="w-full sm:w-56">
              <p className="flex items-baseline justify-between gap-3 text-sm font-extrabold text-white">
                <span>Activities done</span>
                <span className="font-display text-lg leading-none">
                  {done.length} of {activities.length}
                </span>
              </p>
              <ProgressBar
                value={done.length}
                max={activities.length}
                label="Activities done"
                tone="accent"
                onBand
                className="mt-2"
              />
            </div>
          )
        }
        overlap
      />

      <StatRow className="mb-8">
        <StatTile
          value={toDo.length}
          label="To do"
          tone={toDo.length > 0 ? "warning" : "brand"}
          icon={<ListTodo />}
        />
        <StatTile value={done.length} label="Done" tone="success" icon={<CircleCheck />} />
        <StatTile
          value={average === null ? "–" : percentLabel(average)}
          label="Average score"
          icon={<TrendingUp />}
        />
        <StatTile
          value={checkingCount}
          label="Teacher is checking"
          tone={checkingCount > 0 ? "warning" : "brand"}
          icon={<Eye />}
        />
      </StatRow>

      {activities.length === 0 ? (
        <EmptyState
          art={<ClipboardArt />}
          title="No activities yet"
          description="When your teacher publishes an activity, it will show up here."
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-6">
          <section aria-labelledby="to-do-title">
            <div className="mb-3 flex items-center gap-2.5">
              <SectionTitle>
                <span id="to-do-title">To do</span>
              </SectionTitle>
              <Badge tone={toDo.length > 0 ? "warning" : "neutral"}>{toDo.length}</Badge>
            </div>
            {toDo.length === 0 ? (
              <EmptyState
                art={<StarArt />}
                title="Nothing to do right now"
                description="You have answered every activity. New ones will show up here."
              />
            ) : (
              <ul className="space-y-4">
                {toDo.map((activity, index) => {
                  const Icon = TYPE_ICONS[activity.type];
                  return (
                    <li
                      key={activity.id}
                      className="animate-rise"
                      style={{ animationDelay: `${(index + 1) * STAGGER_MS}ms` }}
                    >
                      <Card className={CARD_CLASS}>
                        <div className="flex items-start gap-3.5">
                          <IconTile tone="accent">
                            <Icon />
                          </IconTile>
                          <div className="min-w-0 flex-1">
                            <ActivityHeading activity={activity} />
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                              <Badge tone="brand">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
                              <Badge tone="info">{questionsLabel(activity.itemCount)}</Badge>
                              <Badge tone="info">{pointsLabel(activity.maxScore)}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t-2 border-line pt-3.5">
                          <Badge>Not started</Badge>
                          <ButtonLink href={`/student/activities/${activity.id}`} className={STRETCHED}>
                            Start
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </ButtonLink>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="done-title">
            <div className="mb-3 flex items-center gap-2.5">
              <SectionTitle>
                <span id="done-title">Done</span>
              </SectionTitle>
              <Badge tone={done.length > 0 ? "success" : "neutral"}>{done.length}</Badge>
            </div>
            {done.length === 0 ? (
              <EmptyState
                art={<RingArt />}
                title="Nothing done yet"
                description="Activities you finish show up here with your score."
              />
            ) : (
              <ul className="space-y-4">
                {done.map(({ activity, submission }, index) => (
                  <li
                    key={activity.id}
                    className="animate-rise"
                    style={{ animationDelay: `${(index + 1) * STAGGER_MS + STAGGER_MS / 2}ms` }}
                  >
                    <Card className={CARD_CLASS}>
                      <div className="flex items-start gap-3.5">
                        <ScoreRing score={submission.totalScore} max={submission.maxScore} size={80} />
                        <div className="min-w-0 flex-1">
                          <ActivityHeading activity={activity} />
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <Badge tone="brand">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
                            {submission.needsReview && (
                              <Badge tone="warning">
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                Teacher is checking
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t-2 border-line pt-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-muted">Your score</span>
                          <Score score={submission.totalScore} max={submission.maxScore} />
                        </div>
                        <ButtonLink
                          href={`/student/activities/${activity.id}`}
                          variant="secondary"
                          className={STRETCHED}
                        >
                          Review
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </ButtonLink>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}
