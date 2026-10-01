"use client";

// The parent's plain-language summary of one submission. A stored summary is
// shown straight away; otherwise it is requested once when the panel opens.
// Both languages arrive together, so switching language sends no request.

import { useCallback, useEffect, useRef, useState } from "react";
import { AiLabel, Alert, Button, SectionTitle, Spinner, cn } from "@/components/ui";
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

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
        {items.map((item, index) => (
          <li key={index} className="break-words">
            {item}
          </li>
        ))}
      </ul>
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
    <section aria-labelledby="summary-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>
          <span id="summary-title">Summary for parents</span>
        </SectionTitle>
        {summary && <AiLabel provider={provider}>AI-written summary</AiLabel>}
      </div>

      {loading && (
        <div role="status" className="mt-3 flex items-center gap-3 text-sm text-slate-600">
          <Spinner className="h-5 w-5 shrink-0 text-brand-600" />
          Writing the summary. This takes a few seconds.
        </div>
      )}

      {error && !loading && (
        <div className="mt-3 space-y-3">
          <Alert tone="danger" title="The summary could not be written">
            {error}
          </Alert>
          <Button onClick={retry}>Try again</Button>
        </div>
      )}

      {text && (
        <>
          <div
            role="group"
            aria-label="Summary language"
            className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white p-0.5"
          >
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                aria-pressed={language === code}
                onClick={() => setLanguage(code)}
                className={cn(
                  "min-h-10 rounded-md px-4 text-sm font-medium transition-colors",
                  language === code
                    ? "bg-brand-600 text-white"
                    : "text-slate-700 hover:bg-slate-100",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div lang={language} className="mt-4 space-y-4">
            <p className="whitespace-pre-wrap break-words text-base text-slate-900">
              {text.overview}
            </p>
            <BulletList title={headings.didWell} items={text.didWell} />
            <BulletList title={headings.toPractice} items={text.toPractice} />
            {text.homeTip && (
              <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
                <h3 className="text-sm font-semibold text-brand-900">{headings.homeTip}</h3>
                <p className="mt-1 break-words text-sm text-slate-800">{text.homeTip}</p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
