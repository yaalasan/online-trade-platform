"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startNewVerificationCase } from "@/server/verification";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export function StartVerificationButton({ label }: { label: string }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startNewVerificationCase();
          if (!res.ok) alert(res.error);
          router.refresh();
        })
      }
    >
      {pending ? t("verification.starting") : label}
    </Button>
  );
}
