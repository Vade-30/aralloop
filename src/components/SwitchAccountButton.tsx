"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import type { OkResponse } from "@/lib/contracts";
import { Button } from "./ui";

export function SwitchAccountButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function switchAccount() {
    setLoading(true);
    // Even if the request fails, the role picker lets the user choose again.
    await api<OkResponse>("/api/session", { method: "DELETE" }).catch(() => {});
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" loading={loading} onClick={switchAccount}>
      Switch account
    </Button>
  );
}
