import Link from "next/link";
import { getAiStatus } from "@/lib/ai";
import { getCurrentUser, HOME_PATH } from "@/lib/session";
import type { AiProviderName, Role } from "@/lib/types";
import { SwitchAccountButton } from "./SwitchAccountButton";
import { Badge } from "./ui";

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

export async function AppHeader() {
  const user = await getCurrentUser();
  const ai = getAiStatus();

  return (
    <header className="border-b-4 border-accent-400 bg-brand-800 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link
          href={user ? HOME_PATH[user.role] : "/"}
          className="flex min-h-10 items-center gap-2 text-lg font-semibold text-white"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-400 text-sm font-bold text-brand-900"
          >
            A
          </span>
          AralLoop
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={ai.provider === "mock" ? "warning" : "info"}>
            {PROVIDER_LABELS[ai.provider]}
          </Badge>
          {user && (
            <>
              <span className="text-sm text-white">
                {user.name} <span className="text-brand-200">· {ROLE_LABELS[user.role]}</span>
              </span>
              <SwitchAccountButton />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
