"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth/client";
import { useT } from "@/lib/i18n/client";

/**
 * Replaces Clerk's <UserButton />. Shows the signed-in identity and a sign-out
 * action wired to better-auth.
 */
export function UserMenu({ label }: { label: string }) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    await signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <span className="max-w-[12rem] truncate text-sm text-neutral-600" title={label}>
        {label}
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={busy}
        className="rounded-md border border-neutral-200 px-2 py-1 text-sm text-neutral-600 hover:border-brand hover:text-brand disabled:opacity-50"
      >
        {t("auth.signOut")}
      </button>
    </div>
  );
}
