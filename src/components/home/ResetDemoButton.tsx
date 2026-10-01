"use client";

// "Reset sample data" on the role picker. It wipes everything, so it asks for
// confirmation before sending the request. It is not a main action, so it
// looks quiet until the confirm step.

import { CircleCheck, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import type { OkResponse } from "@/lib/contracts";

type Step = "idle" | "confirm" | "resetting" | "done";

export function ResetDemoButton() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    if (step === "resetting") return;
    setStep("resetting");
    setError(null);
    try {
      await api<OkResponse>("/api/demo/reset", { method: "POST" });
      setStep("done");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setStep("confirm");
    }
  }

  if (step === "idle" || step === "done") {
    return (
      <div className="flex flex-col items-start gap-3 md:flex-none md:items-end">
        {step === "done" && (
          <Alert tone="success" className="animate-pop">
            <span className="flex items-center gap-2">
              <CircleCheck className="h-4 w-4 flex-none" aria-hidden="true" />
              The sample data was restored.
            </span>
          </Alert>
        )}
        <Button variant="ghost" size="sm" onClick={() => setStep("confirm")}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reset sample data
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full animate-pop space-y-3 md:max-w-sm md:flex-none">
      {error && <Alert tone="danger">{error}</Alert>}
      <Alert tone="warning" title="Reset the sample data?">
        This deletes every lesson, activity, answer and score, and puts back the sample
        class. It cannot be undone.
      </Alert>
      <div className="flex flex-wrap gap-3">
        <Button variant="danger" loading={step === "resetting"} onClick={reset}>
          Yes, reset
        </Button>
        <Button
          variant="secondary"
          disabled={step === "resetting"}
          onClick={() => {
            setStep("idle");
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
