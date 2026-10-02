"use client";

// "Log out" in the app header. It ends the session and goes back to the
// first screen. It sits on the dark blue band, so it is a see-through pill
// like the AI status beside it, not one of the kit's light buttons.

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import type { OkResponse } from "@/lib/contracts";
import { Spinner } from "./ui";

export function SwitchAccountButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function switchAccount() {
    setLoading(true);
    // Even if the request fails, the first screen lets the user choose again.
    await api<OkResponse>("/api/session", { method: "DELETE" }).catch(() => {});
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={loading}
      aria-busy={loading || undefined}
      onClick={switchAccount}
      // The white ring keeps keyboard focus visible on the dark band.
      className="group inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-2 border-white/30 bg-white/10 px-3.5 text-sm font-extrabold text-white transition-[background-color,border-color,scale] duration-100 hover:border-white/60 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
    >
      {loading ? (
        <Spinner className="h-4 w-4" />
      ) : (
        // The arrow steps out of the door under the pointer.
        <LogOut
          className="h-4 w-4 transition-[translate] duration-150 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      )}
      Log out
    </button>
  );
}
