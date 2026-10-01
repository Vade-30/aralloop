"use client";

// Editor for a draft activity. The teacher reviews what the AI wrote, changes
// anything, then saves or publishes. Publishing always saves first, so what
// students get is exactly what is on screen.

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
  AiLabel,
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  SectionTitle,
  Textarea,
} from "@/components/ui";
import {
  blankItem,
  fromActivity,
  toUpdateRequest,
  validateDraft,
  type Draft,
  type DraftItem,
} from "./editor-model";
import { ItemEditor, itemCardId } from "./ItemEditor";

type Busy = "save" | "publish" | "delete" | null;

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
  const newItemCount = useRef(0);
  const [busy, setBusy] = useState<Busy>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  // Problems are listed only after a first attempt to save, then update live.
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const disabled = busy !== null;
  const problems = checked ? validateDraft(draft) : [];
  const generalProblems = problems
    .filter((problem) => problem.itemKey === null)
    .map((problem) => problem.message);
  const itemNumbers = draft.items.flatMap((item, index) =>
    problems.some((problem) => problem.itemKey === item.key) ? [index + 1] : [],
  );
  const type = draftType(draft.items);

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

  function addItem() {
    newItemCount.current += 1;
    const item = blankItem(`new-${newItemCount.current}`);
    edit((current) => ({ ...current, items: [...current.items, item] }));
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
      document
        .getElementById(first.itemKey === null ? TITLE_ID : itemCardId(first.itemKey))
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    <div className="space-y-4">
      <Alert tone="info" title="Why this format">
        <p>{activity.aiReason || "The AI did not give a reason for this format."}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <AiLabel provider={activity.aiProvider}>AI-generated draft</AiLabel>
          {type && <Badge tone="brand">{ACTIVITY_TYPE_LABELS[type]}</Badge>}
        </div>
        <p className="mt-2">
          Nothing is visible to students until you publish. Check every item and change anything
          that is not right.
        </p>
      </Alert>

      <Card className="space-y-4">
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

      <SectionTitle>
        Items <span className="font-normal text-slate-500">({draft.items.length})</span>
      </SectionTitle>
      {draft.items.map((item, index) => (
        <ItemEditor
          key={item.key}
          item={item}
          number={index + 1}
          problems={problems
            .filter((problem) => problem.itemKey === item.key)
            .map((problem) => problem.message)}
          disabled={disabled}
          canRemove={draft.items.length > 1}
          onChange={changeItem}
          onRemove={() => removeItem(item.key)}
        />
      ))}
      {draft.items.length < LIMITS.itemCountMax ? (
        <Button variant="secondary" className="w-full" disabled={disabled} onClick={addItem}>
          Add item
        </Button>
      ) : (
        <p className="text-sm text-slate-600">
          An activity can have up to {LIMITS.itemCountMax} items.
        </p>
      )}

      {/* Stays in view while the teacher scrolls through the items. */}
      <div className="sticky bottom-2 z-10 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
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
          <Alert tone="success">Draft saved. Students cannot see it until you publish.</Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            loading={busy === "save"}
            disabled={disabled}
            onClick={handleSave}
          >
            Save draft
          </Button>
          <Button
            className="flex-1"
            loading={busy === "publish"}
            disabled={disabled}
            onClick={handlePublish}
          >
            Publish to class
          </Button>
        </div>
      </div>

      <p className="text-sm text-slate-600">
        Publishing saves your changes and makes the activity visible to students. It cannot be
        edited after that.
      </p>

      <div className="space-y-2 border-t border-slate-200 pt-4">
        {deleteError && <Alert tone="danger">{deleteError}</Alert>}
        <Button
          variant="danger"
          size="sm"
          loading={busy === "delete"}
          disabled={disabled}
          onClick={handleDelete}
        >
          Delete draft
        </Button>
      </div>
    </div>
  );
}
