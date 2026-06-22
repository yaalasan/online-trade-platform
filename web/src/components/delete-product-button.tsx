"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct } from "@/server/products";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export function DeleteProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("products.deleteConfirm"))) return;
        const fd = new FormData();
        fd.set("id", productId);
        start(async () => {
          const res = await deleteProduct(fd);
          if (res.ok) router.push("/dashboard/products");
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
