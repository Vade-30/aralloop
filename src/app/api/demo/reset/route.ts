// POST /api/demo/reset — deletes the sample class and puts it back as new, so
// a demo can start from a known state. Classes made by signing up are not
// touched. The first screen calls it, so no account is needed. Set
// ALLOW_DEMO_RESET=false to turn it off.

import type { OkResponse } from "@/lib/contracts";
import { resetDemoData } from "@/lib/db/repo";
import { SEED_IDS } from "@/lib/db/seed";
import { forbidden, route } from "@/lib/http";
import { endSession, getCurrentUser } from "@/lib/session";

export const POST = route(async (): Promise<OkResponse> => {
  if (process.env.ALLOW_DEMO_RESET === "false") {
    throw forbidden("Resetting the sample data is turned off for this site.");
  }

  const user = await getCurrentUser();
  await resetDemoData();
  // The sample accounts are new rows now, so whoever used one is signed out.
  // Someone signed in to their own account stays signed in.
  if (!user || user.classId === SEED_IDS.classId) await endSession();
  return { ok: true };
});
