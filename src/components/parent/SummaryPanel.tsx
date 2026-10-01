"use client";

// The parent's plain-language summary of one submission. A stored summary is
// shown straight away; otherwise it is requested once when the panel opens.
// Both languages arrive together, so switching language sends no request.

import { Check, Languages, Lightbulb, RotateCw, Target, ThumbsUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { HomeArt } from "@/components/parent/illustrations";
import {
  AiLabel,
  Alert,
  Button,
  Card,
  IconTile,
  SectionTitle,
  Skeleton,
  Spinner,
  cn,
} from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import type { SummaryRequest, SummaryResponse } from "@/lib/contracts";
import type { AiProviderName, ParentSummary } from "@/lib/types";

type Language = keyof ParentSummary;

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "fil", label: "Filipino" },
];

const HEADINGS: Record<Language, { didWell: string; toPractice: string; homeTip: string }> = {
  en: { didWell: "Did well", toPractice: "To practise", homeTip: "Try this at home" },
  fil: {
    didWell: "Mahusay na nagawa",
    toPractice: "Dapat pang sanayin",
    homeTip: "Subukan ito sa bahay",
  },
};

function requestSummary(submissionId: string): Promise<SummaryResponse> {
  const body: SummaryRequest = {};
  return api<SummaryResponse>(`/api/submissions/${submissionId}/summary`, {
    method: "POST",
    body,
  });
}

// Green with a tick for what went well, amber with a target for what to
// practise: an icon beside every point, so colour is never the only signal.
const POINT_TONES = {
  good: {
    HeadIcon: ThumbsUp,
    ItemIcon: Check,
    band: "border-emerald-100 bg-emerald-50",
    head: "bg-emerald-600 text-white",
    item: "bg-emerald-100 text-emerald-700",
  },
  practise: {
    HeadIcon: Target,
    ItemIcon: Target,
    band: "border-amber-100 bg-amber-50",
    head: "bg-amber-400 text-amber-950",
    item: "bg-amber-100 text-amber-800",
  },
};

function PointsCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: keyof typeof POINT_TONES;
}) {
  if (items.length === 0) return null;
  const { HeadIcon, ItemIcon, band, head, item: itemTone } = POINT_TONES[tone];
  return (
    <div className="overflow-hidden rounded-3xl border-2 border-line bg-white shadow-edge">
      <div className={cn("flex items-center gap-3 border-b-2 px-4 py-3", band)}>
        <span
          aria-hidden="true"
          className={cn("flex h-10 w-10 flex-none items-center justify-center rounded-xl", head)}
        >
          <HeadIcon className="h-5 w-5" strokeWidth={2.5} />
        </span>
        <h3 className="min-w-0 break-words text-lg font-extrabold leading-tight text-ink">
          {title}
        </h3>
      </div>
      <ul className="space-y-3 px-4 py-4">
        {items.map((item, index) => (
          <li
            key={index}
            className="flex animate-rise items-start gap-3"
            style={{ animationDelay: `${120 + Math.min(index, 5) * 70}ms` }}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full",
                itemTone,
              )}
            >
              <ItemIcon className="h-3.5 w-3.5" strokeWidth={3.5} />
            </span>
            <span className="min-w-0 break-words text-[15px] font-semibold leading-relaxed text-ink">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkeletonLine({ className }: { className?: string }) {
  return <Skeleton className={cn("h-3.5 rounded-full", className)} />;
}

/**
 * Pale shapes where the summary will appear. They show only that the page is
 * waiting; they do not claim to know how far the writing has got.
 */
function SummarySkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="space-y-3 rounded-3xl border-2 border-line bg-white p-5 shadow-edge">
        <SkeletonLine className="w-full" />
        <SkeletonLine className="w-11/12" />
        <SkeletonLine className="w-2/3" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["bg-emerald-50", "bg-amber-50"] as const).map((band) => (
          <div
            key={band}
            className="overflow-hidden rounded-3xl border-2 border-line bg-white shadow-edge"
          >
            <div className={cn("flex items-center gap-3 px-4 py-3", band)}>
              <span className="h-10 w-10 animate-pulse rounded-xl bg-white" />
              <span className="h-3.5 w-24 animate-pulse rounded-full bg-white" />
            </div>
            <div className="space-y-3 p-4">
              <SkeletonLine className="w-full" />
              <SkeletonLine className="w-4/5" />
              <SkeletonLine className="w-3/5" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-3xl border-2 border-accent-200 bg-accent-50 p-4">
        <span className="h-12 w-12 flex-none animate-pulse rounded-2xl bg-accent-200" />
        <div className="flex-1 space-y-3">
          <span className="block h-3.5 w-32 animate-pulse rounded-full bg-accent-200" />
          <span className="block h-3.5 w-4/5 animate-pulse rounded-full bg-accent-200 [animation-delay:120ms]" />
        </div>
      </div>
    </div>
  );
}

export function SummaryPanel({
  submissionId,
  initialSummary,
  initialProvider,
}: {
  submissionId: string;
  /** The stored summary, or null if none has been written yet. */
  initialSummary: ParentSummary | null;
  /** Which service wrote the stored summary. */
  initialProvider: AiProviderName;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [provider, setProvider] = useState(initialProvider);
  const [loading, setLoading] = useState(initialSummary === null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("en");
  // React runs effects twice in development; this keeps it to one request.
  const requested = useRef(false);

  const load = useCallback(() => {
    requestSummary(submissionId)
      .then((result) => {
        setSummary(result.summary);
        setProvider(result.provider);
      })
      .catch((caught: unknown) => setError(errorMessage(caught)))
      .finally(() => setLoading(false));
  }, [submissionId]);

  useEffect(() => {
    if (initialSummary !== null || requested.current) return;
    requested.current = true;
    load();
  }, [initialSummary, load]);

  function retry() {
    if (loading) return;
    setLoading(true);
    setError(null);
    load();
  }

  const text = summary?.[language];
  const headings = HEADINGS[language];

  return (
    <section aria-labelledby="summary-title" className="min-w-0">
      {/* The height matches the heading of the column beside it on a laptop. */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 lg:min-h-16">
        <div className="min-w-0">
          <SectionTitle>
            <span id="summary-title">Summary for parents</span>
          </SectionTitle>
          {summary && (
            <div className="mt-1">
              <AiLabel provider={provider}>AI-written summary</AiLabel>
            </div>
          )}
        </div>

        {text && (
          <div className="flex items-center gap-2">
            <Languages className="h-5 w-5 flex-none text-muted" aria-hidden="true" />
            <div
              role="group"
              aria-label="Summary language"
              className="relative grid grid-cols-2 rounded-2xl border-2 border-line bg-white p-1 shadow-edge-sm"
            >
              {/* The blue pill slides under the chosen language. */}
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-xl bg-brand-600 transition-transform duration-200 ease-out",
                  language === LANGUAGES[1].code && "translate-x-full",
                )}
              />
              {LANGUAGES.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={language === code}
                  onClick={() => setLanguage(code)}
                  className={cn(
                    "relative min-h-10 rounded-xl px-4 text-sm font-extrabold transition-colors duration-200",
                    language === code ? "text-white" : "text-brand-800 hover:text-brand-600",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="space-y-4">
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border-2 border-brand-200 bg-brand-50 px-4 py-3 text-sm font-bold text-brand-900"
          >
            <Spinner className="h-5 w-5 shrink-0 text-brand-600" />
            Writing the summary. This takes a few seconds.
          </div>
          <SummarySkeleton />
        </div>
      )}

      {error && !loading && (
        <Card className="animate-rise space-y-4">
          <Alert tone="danger" title="The summary could not be written">
            {error}
          </Alert>
          <Button onClick={retry}>
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </Card>
      )}

      {text && (
        // The key replays the entrance when the language changes.
        <div key={language} lang={language} className="animate-rise space-y-4">
          <Card>
            <p className="whitespace-pre-wrap break-words text-lg font-bold leading-relaxed text-ink sm:text-xl">
              {text.overview}
            </p>
          </Card>

          {(text.didWell.length > 0 || text.toPractice.length > 0) && (
            // Side by side only when there are two cards to show.
            <div
              className={cn(
                "grid gap-4",
                text.didWell.length > 0 && text.toPractice.length > 0 && "sm:grid-cols-2",
              )}
            >
              <PointsCard title={headings.didWell} items={text.didWell} tone="good" />
              <PointsCard title={headings.toPractice} items={text.toPractice} tone="practise" />
            </div>
          )}

          {text.homeTip && (
            <div className="relative overflow-hidden rounded-3xl border-2 border-accent-300 bg-accent-100 p-4 shadow-[0_5px_0_#fadb5f] sm:p-5">
              <HomeArt className="pointer-events-none absolute -bottom-3 -right-2 hidden h-28 w-28 opacity-70 sm:block" />
              <div className="relative flex items-start gap-3.5 sm:pr-24">
                <IconTile tone="accent">
                  <Lightbulb />
                </IconTile>
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-extrabold leading-tight text-ink">
                    {headings.homeTip}
                  </h3>
                  <p className="mt-1 break-words text-[15px] font-semibold leading-relaxed text-ink">
                    {text.homeTip}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
