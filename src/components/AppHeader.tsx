import { RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { getAiStatus } from "@/lib/ai";
import { getCurrentUser, HOME_PATH } from "@/lib/session";
import type { AiProviderName, Role } from "@/lib/types";
import { AppNav, type NavLink } from "./AppNav";
import { SwitchAccountButton } from "./SwitchAccountButton";
import { PAGE_WIDTH, cn } from "./ui";

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

// Every link goes to a page that needs no id, so it works from anywhere.
const NAV_LINKS: Record<Role, NavLink[]> = {
  teacher: [
    { href: "/teacher", label: "Dashboard" },
    { href: "/teacher/lessons/new", label: "New lesson" },
  ],
  student: [{ href: "/student", label: "My activities" }],
  parent: [{ href: "/parent", label: "Results" }],
};

// The same blue as PageHeader, with no border, so the two read as one band.
export async function AppHeader() {
  const user = await getCurrentUser();
  const ai = getAiStatus();

  return (
    <header className="sticky top-0 z-20 bg-brand-900 text-white">
      <div
        className={cn(
          "mx-auto flex w-full items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6",
          PAGE_WIDTH,
        )}
      >
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
        <AppNav
          links={user ? NAV_LINKS[user.role] : []}
          status={
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
          }
          account={
            user ? (
              <>
                <span className="text-sm font-extrabold text-white">
                  {user.name}{" "}
                  <span className="font-bold text-brand-200">· {ROLE_LABELS[user.role]}</span>
                </span>
                <SwitchAccountButton />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex min-h-10 items-center rounded-full border-2 border-white/30 bg-white/10 px-3.5 text-sm font-extrabold text-white transition-[background-color,border-color,scale] duration-100 hover:border-white/60 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white active:scale-95"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex min-h-10 items-center rounded-full bg-accent-400 px-3.5 text-sm font-extrabold text-ink transition-[background-color,scale] duration-100 hover:bg-accent-300 focus-visible:ring-2 focus-visible:ring-white active:scale-95"
                >
                  Sign up
                </Link>
              </>
            )
          }
        />
      </div>
    </header>
  );
}
