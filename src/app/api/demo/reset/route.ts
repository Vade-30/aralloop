// POST /api/demo/reset — wipes all data and restores the sample class, so a
// demo can start from a known state. The role picker calls it, so no account
// is needed. Set ALLOW_DEMO_RESET=false to turn it off.

import { cookies } from "next/headers";
import type { OkResponse } from "@/lib/contracts";
import { resetDemoData } from "@/lib/db/repo";
import { forbidden, route } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/session";

export const POST = route(async (): Promise<OkResponse> => {
  if (process.env.ALLOW_DEMO_RESET === "false") {
    throw forbidden("Resetting the sample data is turned off for this site.");
  }

  await resetDemoData();
  // Whoever was signed in goes back to the role picker.
  (await cookies()).delete(SESSION_COOKIE);
  return { ok: true };
});
