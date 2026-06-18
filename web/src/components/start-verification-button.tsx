"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startNewVerificationCase } from "@/server/verification";
import { Button } from "@/components/ui/button";

export function StartVerificationButton({ label }: { label: string }) {
  const router = useRouter();
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
      {pending ? "Starting…" : label}
    </Button>
  );
}
