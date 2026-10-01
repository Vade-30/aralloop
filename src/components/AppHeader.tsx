import { RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { getAiStatus } from "@/lib/ai";
import { getCurrentUser, HOME_PATH } from "@/lib/session";
import type { AiProviderName, Role } from "@/lib/types";
import { SwitchAccountButton } from "./SwitchAccountButton";

const ROLE_LABELS: Record<Role, string> = {
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
};

const PROVIDER_LABELS: Record<AiProviderName, string> = {
  openai: "AI: OpenAI",
  gemini: "AI: Gemini",
  mock: "Sample mode · no AI key",
};

// The same blue as PageHeader, with no border, so the two read as one band.
export async function AppHeader() {
  const user = await getCurrentUser();
  const ai = getAiStatus();

  return (
    <header className="relative z-10 bg-brand-900 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          href={user ? HOME_PATH[user.role] : "/"}
          className="flex min-h-10 items-center gap-2.5 font-display text-2xl font-extrabold text-white"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-400 text-brand-900"
          >
            <RefreshCw className="h-5 w-5" strokeWidth={3} />
          </span>
          AralLoop
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className={
              ai.provider === "mock"
                ? "inline-flex items-center gap-1.5 rounded-full bg-accent-400 px-3 py-1 text-xs font-extrabold text-ink"
                : "inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold text-white"
            }
          >
            {ai.provider !== "mock" && <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
            {PROVIDER_LABELS[ai.provider]}
          </span>
          {user && (
            <>
              <span className="text-sm font-extrabold text-white">
                {user.name}{" "}
                <span className="font-bold text-brand-200">· {ROLE_LABELS[user.role]}</span>
              </span>
              <SwitchAccountButton />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
