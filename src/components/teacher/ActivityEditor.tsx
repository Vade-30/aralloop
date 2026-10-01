"use client";

// Editor for a draft activity. The teacher reviews what the AI wrote, changes
// anything, then saves or publishes. Publishing always saves first, so what
// students get is exactly what is on screen.
//
// Around the fields: an outline that jumps between items, a summary that
// shows how many items are ready, and a second view of the same draft as a
// student will get it. None of these change what is saved.

import { CircleCheck, Eye, EyeOff, PencilLine, Plus, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import {
  LIMITS,
  type ActivityResponse,
  type OkResponse,
  type PublishResponse,
} from "@/lib/contracts";
import { ACTIVITY_TYPE_LABELS, type ActivityType, type ActivityWithItems } from "@/lib/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  SectionTitle,
  Textarea,
  cn,
} from "@/components/ui";
import { itemCardId, type ItemState } from "./EditorItemType";
import { EditorOutline } from "./EditorOutline";
import { EditorReason } from "./EditorReason";
import { EditorStudentView } from "./EditorStudentView";
import { EditorSummary } from "./EditorSummary";
import {
  blankItem,
  fromActivity,
  parsePoints,
  toUpdateRequest,
  validateDraft,
  type Draft,
  type DraftItem,
} from "./editor-model";
import { ItemEditor } from "./ItemEditor";

type Busy = "save" | "publish" | "delete" | null;
/** The items as fields to edit, or as a student will get them. */
type View = "edit" | "student";

const VIEWS = [
  { value: "edit", label: "Edit", Icon: PencilLine },
  { value: "student", label: "Student view", Icon: Eye },
] as const;

/** [2] -> "2"; [2, 5] -> "2 and 5"; [1, 2, 5] -> "1, 2 and 5". */
function listNumbers(numbers: number[]): string {
  if (numbers.length <= 1) return numbers.join("");
  return `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
}

const TITLE_ID = "activity-title";

function draftType(items: DraftItem[]): ActivityType | null {
  if (items.length === 0) return null;
  return items.every((item) => item.type === items[0].type) ? items[0].type : "mixed";
}

export function ActivityEditor({
  activity,
  lessonTitle,
}: {
  activity: ActivityWithItems;
  lessonTitle: string;
}) {
  const router = useRouter();
  const apiPath = `/api/activities/${encodeURIComponent(activity.id)}`;

  const [draft, setDraft] = useState<Draft>(() => fromActivity(activity));
  // Where each item stood when the page opened, to stagger their entrance.
  const [openingOrder] = useState(
    () => new Map(draft.items.map((item, index) => [item.key, index])),
  );
  const newItemCount = useRef(0);
  const [view, setView] = useState<View>("edit");
  // After the first switch of view the cards no longer wait for the page's
  // opening sequence.
  const [switched, setSwitched] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  // Problems are listed only after a first attempt to save, then update live.
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const disabled = busy !== null;
  // Always worked out, for the ready marks; shown as problems only once checked.
  const live = validateDraft(draft);
  const problems = checked ? live : [];
  const generalProblems = problems
    .filter((problem) => problem.itemKey === null)
    .map((problem) => problem.message);
  const itemNumbers = draft.items.flatMap((item, index) =>
    problems.some((problem) => problem.itemKey === item.key) ? [index + 1] : [],
  );
  const unfinished = new Set(live.map((problem) => problem.itemKey));
  const stateOf = (item: DraftItem): ItemState =>
    !unfinished.has(item.key) ? "ready" : checked ? "problem" : "todo";
  const type = draftType(draft.items);
  const canAdd = draft.items.length < LIMITS.itemCountMax;

  // Covers closing the tab or reloading; in-app links are not intercepted.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function edit(change: (current: Draft) => Draft) {
    setDraft(change);
    setDirty(true);
    setSaved(false);
    setError(null);
  }

  function changeItem(next: DraftItem) {
    edit((current) => ({
      ...current,
      items: current.items.map((item) => (item.key === next.key ? next : item)),
    }));
  }

  function removeItem(key: string) {
    edit((current) => ({ ...current, items: current.items.filter((item) => item.key !== key) }));
  }

  function changeView(next: View) {
    if (next === view) return;
    setView(next);
    setSwitched(true);
  }

  function addItem() {
    newItemCount.current += 1;
    const item = blankItem(`new-${newItemCount.current}`);
    edit((current) => ({ ...current, items: [...current.items, item] }));
    // A new item is filled in as fields, whichever view was showing.
    changeView("edit");
    // Wait for the new card to exist before moving to it.
    requestAnimationFrame(() => {
      document.getElementById(`${itemCardId(item.key)}-question`)?.focus();
    });
  }

  /** Validates and saves. False means the teacher has something to fix first. */
  async function saveDraft(): Promise<boolean> {
    const found = validateDraft(draft);
    setChecked(true);
    if (found.length > 0) {
      const first = found[0];
      const target = first.itemKey === null ? TITLE_ID : itemCardId(first.itemKey);
      // The problems are listed on the fields, so go back to them, and wait
      // for them to be on screen before moving to the first one.
      changeView("edit");
      requestAnimationFrame(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return false;
    }
    await api<ActivityResponse>(apiPath, { method: "PATCH", body: toUpdateRequest(draft) });
    setDirty(false);
    return true;
  }

  async function handleSave() {
    if (busy) return;
    setBusy("save");
    setError(null);
    setSaved(false);
    try {
      if (await saveDraft()) {
        setSaved(true);
        router.refresh();
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function handlePublish() {
    if (busy) return;
    setBusy("publish");
    setError(null);
    setSaved(false);
    let draftSaved = false;
    try {
      draftSaved = await saveDraft();
      if (!draftSaved) {
        setBusy(null);
        return;
      }
      await api<PublishResponse>(`${apiPath}/publish`, { method: "POST" });
      // Stay in the loading state until the results page replaces this screen.
      router.push(`/teacher/activities/${activity.id}/results`);
      router.refresh();
    } catch (caught) {
      const message = errorMessage(caught);
      setError(draftSaved ? `Your changes were saved, but publishing failed. ${message}` : message);
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (busy) return;
    if (!window.confirm("Delete this draft? This cannot be undone.")) return;
    setBusy("delete");
    setDeleteError(null);
    try {
      await api<OkResponse>(apiPath, { method: "DELETE" });
      setDirty(false);
      router.push("/teacher");
      router.refresh();
    } catch (caught) {
      setDeleteError(errorMessage(caught));
      setBusy(null);
    }
  }

  return (
    // One column on a phone, with the summary moved to the top and the actions
    // in a bar that follows the screen. From a laptop up, the summary and the
    // actions become a side panel that stays in view beside the items.
    <div className="relative flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
      {/* The scroll margins keep a focused field clear of the phone's action bar. */}
      <div className="min-w-0 space-y-4 [&_input]:scroll-mb-28 [&_textarea]:scroll-mb-28">
        {/* Neutral on purpose: a sample-mode draft was not written by AI. */}
        <EditorReason
          provider={activity.aiProvider}
          reason={activity.aiReason || "No reason was recorded for this format."}
          className="animate-rise"
        >
          {type && <Badge tone="brand">{ACTIVITY_TYPE_LABELS[type]}</Badge>}
        </EditorReason>

        <Card className="animate-rise space-y-4 [animation-delay:80ms]">
          <Field label="Activity title" htmlFor={TITLE_ID} hint={`From the lesson: ${lessonTitle}`}>
            <Input
              id={TITLE_ID}
              value={draft.title}
              maxLength={LIMITS.lessonTitleMax}
              disabled={disabled}
              onChange={(event) => edit((current) => ({ ...current, title: event.target.value }))}
            />
          </Field>
          <Field
            label="Instructions"
            htmlFor="activity-instructions"
            hint="Students read this before they start."
          >
            <Textarea
              id="activity-instructions"
              rows={3}
              value={draft.instructions}
              maxLength={LIMITS.feedbackMax}
              disabled={disabled}
              onChange={(event) =>
                edit((current) => ({ ...current, instructions: event.target.value }))
              }
            />
          </Field>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-2">
          <SectionTitle>
            Items{" "}
            <span className="font-sans text-base font-bold text-muted">({draft.items.length})</span>
          </SectionTitle>
          <div
            role="group"
            aria-label="Show the items as"
            className="inline-flex rounded-2xl border-2 border-line bg-white p-1 shadow-edge-sm"
          >
            {VIEWS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => changeView(value)}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-extrabold transition-colors duration-150",
                  view === value
                    ? "bg-brand-600 text-white"
                    : "text-muted hover:bg-brand-50 hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* The outline is a row above the items on a phone and a rail beside
            them on a laptop, where it stays in view while the items scroll. */}
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[2.5rem_minmax(0,1fr)] lg:items-start">
          <EditorOutline
            entries={draft.items.map((item, index) => ({
              id: itemCardId(item.key),
              number: index + 1,
              type: item.type,
              state: stateOf(item),
              title: item.question.trim(),
            }))}
            onAdd={canAdd ? addItem : undefined}
            disabled={disabled}
            className="lg:sticky lg:top-4"
          />

          <div className="min-w-0 space-y-4">
            {view === "student" ? (
              <EditorStudentView items={draft.items} />
            ) : (
              <>
                {draft.items.map((item, index) => {
                  // Only the items the page opened with arrive one after another. An
                  // item added later appears at once, because focus moves into it.
                  const opened = openingOrder.get(item.key);
                  return (
                    <ItemEditor
                      key={item.key}
                      item={item}
                      number={index + 1}
                      problems={problems
                        .filter((problem) => problem.itemKey === item.key)
                        .map((problem) => problem.message)}
                      ready={!unfinished.has(item.key)}
                      disabled={disabled}
                      canRemove={draft.items.length > 1}
                      enterDelay={
                        opened === undefined ? 0 : (switched ? 0 : 160) + Math.min(opened, 8) * 60
                      }
                      onChange={changeItem}
                      onRemove={() => removeItem(item.key)}
                    />
                  );
                })}
                {canAdd ? (
                  <button
                    type="button"
                    className="group flex min-h-16 w-full items-center justify-center gap-2.5 rounded-3xl border-2 border-dashed border-brand-300 bg-white/70 px-4 text-[15px] font-extrabold text-brand-700 transition-colors enabled:hover:border-brand-500 enabled:hover:bg-brand-50 enabled:active:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={disabled}
                    onClick={addItem}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-100 transition-[scale,background-color,color] duration-150 group-enabled:group-hover:scale-110 group-enabled:group-hover:bg-brand-600 group-enabled:group-hover:text-white"
                    >
                      <Plus className="h-5 w-5" strokeWidth={3} />
                    </span>
                    Add item
                  </button>
                ) : (
                  <p className="rounded-3xl border-2 border-dashed border-line px-4 py-4 text-center text-sm font-semibold text-muted">
                    An activity can have up to {LIMITS.itemCountMax} items.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* On a phone this wrapper has no box of its own (`contents`), so its
          three parts take their places in the column: the summary first, the
          action bar and the rest after the items. */}
      <aside
        aria-label="Summary and actions"
        className="contents lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-2rem)] lg:space-y-4 lg:overflow-y-auto lg:pb-1.5 lg:[scrollbar-width:thin]"
      >
        <EditorSummary
          entries={draft.items.map((item) => ({
            type: item.type,
            // Points that are not valid yet count as none until they are fixed.
            points: parsePoints(item.points) ?? 0,
          }))}
          status={<Badge>Draft</Badge>}
          readiness={{
            ready: draft.items.filter((item) => !unfinished.has(item.key)).length,
            total: draft.items.length,
            blocker: live.find((problem) => problem.itemKey === null)?.message,
          }}
          className="order-first animate-rise [animation-delay:40ms] lg:order-none"
        >
          <p className="flex gap-2.5 text-xs font-semibold text-muted">
            <EyeOff className="mt-0.5 h-4 w-4 flex-none text-brand-600" aria-hidden="true" />
            <span>
              <strong className="font-extrabold text-ink">
                Nothing is visible to students until you publish.
              </strong>{" "}
              Check every item and change anything that is not right.
            </span>
          </p>
        </EditorSummary>

        {/* On a phone this bar follows the bottom of the screen while the
            teacher scrolls through the items, then settles in its own place
            after them, so it never ends up covering the last field. */}
        <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-3xl bg-brand-900 p-3 pb-4 shadow-[0_14px_28px_-10px_rgba(22,32,74,0.65)] sm:mx-auto sm:w-full sm:max-w-lg lg:static lg:mx-0 lg:max-w-none lg:p-4 lg:pb-5 lg:shadow-edge-brand">
          {problems.length > 0 && (
            // Kept short because this bar covers part of the screen on a phone;
            // each item lists its own problems in full.
            <Alert tone="danger" title="Not saved yet">
              {generalProblems.map((message) => (
                <p key={message}>{message}</p>
              ))}
              {itemNumbers.length > 0 && (
                <p>
                  Fix {itemNumbers.length === 1 ? "item" : "items"} {listNumbers(itemNumbers)},
                  marked in red.
                </p>
              )}
            </Alert>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          {saved && !dirty && (
            <Alert tone="success" className="animate-pop">
              <span className="flex gap-2">
                <CircleCheck className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                Draft saved. Students cannot see it until you publish.
              </span>
            </Alert>
          )}
          {busy === "publish" && (
            // No steps or percentages: the page cannot see what the server is doing.
            <p role="status" className="flex items-center gap-2.5 px-1 text-xs font-extrabold text-brand-100">
              <span aria-hidden="true" className="flex gap-1">
                {[0, 160, 320].map((delay) => (
                  <span
                    key={delay}
                    className="h-2 w-2 animate-dot rounded-full bg-accent-400"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
              Publishing. Keep this page open.
            </p>
          )}
          {dirty && (
            // Spelled out where there is room. On a phone the dot on "Save
            // draft" stands for it, and screen readers still get the words.
            <p className="sr-only text-xs font-extrabold text-brand-100 lg:not-sr-only lg:flex lg:items-center lg:gap-2">
              <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-accent-400" />
              Unsaved changes
            </p>
          )}
          <div className="flex flex-row-reverse gap-2 lg:flex-col lg:gap-3">
            <Button
              size="lg"
              className="flex-1 lg:w-full lg:flex-none"
              loading={busy === "publish"}
              disabled={disabled}
              onClick={handlePublish}
            >
              {busy !== "publish" && <Send className="hidden h-5 w-5 sm:block" aria-hidden="true" />}
              Publish to class
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="relative flex-none px-4! lg:w-full"
              loading={busy === "save"}
              disabled={disabled}
              onClick={handleSave}
            >
              Save draft
              {dirty && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-pop rounded-full border-2 border-brand-900 bg-accent-400 lg:hidden"
                />
              )}
            </Button>
          </div>
        </div>

        {/* The side gutter leaves room for the button's focus outline inside
            the side panel, which scrolls on a short screen. */}
        <div className="space-y-2 px-1.5">
          <p className="text-xs font-semibold text-muted">
            Publishing saves your changes and makes the activity visible to students. It cannot be
            edited after that.
          </p>
          {deleteError && <Alert tone="danger">{deleteError}</Alert>}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-red-700! enabled:hover:bg-red-50!"
            loading={busy === "delete"}
            disabled={disabled}
            onClick={handleDelete}
          >
            {busy !== "delete" && <Trash2 className="h-4 w-4" aria-hidden="true" />}
            Delete draft
          </Button>
        </div>
      </aside>
    </div>
  );
}
