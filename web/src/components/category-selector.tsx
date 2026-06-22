"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setManufacturerCategories } from "@/server/manufacturer";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

type Category = { id: string; name: string };

export function CategorySelector({
  categories,
  selectedIds,
  readOnly,
}: {
  categories: Category[];
  selectedIds: string[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const selected = new Set(selectedIds);

  function onSubmit(formData: FormData) {
    setMsg(null);
    start(async () => {
      const res = await setManufacturerCategories(formData);
      if (res.ok) {
        setMsg({ kind: "ok", text: t("categorySelector.saved") });
        router.refresh();
      } else {
        setMsg({ kind: "err", text: res.error });
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <fieldset disabled={readOnly || pending} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {categories.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="categoryIds"
              value={c.id}
              defaultChecked={selected.has(c.id)}
              className="h-4 w-4 rounded border-neutral-300 text-brand focus:ring-brand"
            />
            {c.name}
          </label>
        ))}
      </fieldset>

      {!readOnly && (
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("categorySelector.saveCategories")}
        </Button>
      )}
      {msg && (
        <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
      )}
    </form>
  );
}
