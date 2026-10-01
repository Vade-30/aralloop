"use client";

// The sample accounts on the role picker. Choosing one stores it as the
// session and opens that role's home screen.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Badge, Button } from "@/components/ui";
import { api, errorMessage } from "@/lib/client-api";
import type { SessionRequest, SessionResponse } from "@/lib/contracts";

export interface AccountOption {
  id: string;
  name: string;
  /** e.g. "Parent of Miguel Santos". */
  description: string;
  /** Where this account lands after it is chosen. */
  homePath: string;
}

export interface AccountGroup {
  label: string;
  accounts: AccountOption[];
}

export function AccountPicker({
  groups,
  currentUserId,
}: {
  groups: AccountGroup[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(account: AccountOption) {
    if (pendingId) return;
    setPendingId(account.id);
    setError(null);
    try {
      const body: SessionRequest = { userId: account.id };
      await api<SessionResponse>("/api/session", { method: "POST", body });
      // Stay in the loading state while the next screen loads.
      router.push(account.homePath);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && <Alert tone="danger">{error}</Alert>}
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {group.label}
          </h2>
          <ul className="space-y-2">
            {group.accounts.map((account) => (
              <li key={account.id}>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full py-3"
                  loading={pendingId === account.id}
                  disabled={pendingId !== null}
                  onClick={() => choose(account)}
                >
                  <span className="flex min-w-0 flex-1 flex-col items-start text-left">
                    <span className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                      {account.name}
                      {account.id === currentUserId && <Badge tone="brand">In use</Badge>}
                    </span>
                    <span className="text-sm font-normal text-slate-600">
                      {account.description}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
