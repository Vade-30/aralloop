"use client";

// "Reset sample data" on the role picker. It wipes everything, so it asks for
// confirmation before sending the request.

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
      <div className="space-y-3">
        {step === "done" && (
          <Alert tone="success">The sample data was restored.</Alert>
        )}
        <Button variant="secondary" onClick={() => setStep("confirm")}>
          Reset sample data
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <Alert tone="warning" title="Reset the sample data?">
        This deletes every lesson, activity, answer and score, and puts back the sample
        class. It cannot be undone.
      </Alert>
      <div className="flex flex-wrap gap-2">
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
