"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRfq } from "@/server/rfqs";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export function DeleteRfqButton({ rfqId }: { rfqId: string }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("rfqs.deleteConfirm"))) return;
        const fd = new FormData();
        fd.set("id", rfqId);
        start(async () => {
          const res = await deleteRfq(fd);
          if (res.ok) router.push("/dashboard/rfqs");
          else {
            alert(res.error);
            router.refresh();
          }
        });
      }}
    >
      {pending ? t("common.deleting") : t("common.delete")}
    </Button>
  );
}
