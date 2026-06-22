"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewVerificationCase } from "@/server/verification";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n/client";

const DECISIONS = [
  { value: "UNDER_REVIEW", labelKey: "kybControls.markUnderReview" },
  { value: "APPROVED", labelKey: "kybControls.approve" },
  { value: "REJECTED", labelKey: "kybControls.reject" },
] as const;

export function KybReviewControls({ id, reviewNotes }: { id: string; reviewNotes: string | null }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    formData.set("id", id);
    start(async () => {
      const res = await reviewVerificationCase(formData);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-2 border-t border-neutral-100 pt-3">
      <div>
        <Label htmlFor={`notes-${id}`}>{t("kybControls.reviewNote")}</Label>
        <Textarea id={`notes-${id}`} name="reviewNotes" rows={2} defaultValue={reviewNotes ?? ""} disabled={pending} />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor={`decision-${id}`}>{t("kybControls.decision")}</Label>
          <Select id={`decision-${id}`} name="decision" defaultValue="UNDER_REVIEW" className="w-48" disabled={pending}>
            {DECISIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {t(d.labelKey)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("kybControls.applyDecision")}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
