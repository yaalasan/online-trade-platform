"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInquiry } from "@/server/inquiries";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n/client";

type InquiryKind = "SUPPLIER" | "PRODUCT" | "RFQ" | "GENERAL";

/**
 * "Request introduction" control. Collapsed to a button until opened; on submit it
 * sends an inquiry to the Fastflow broker queue with the (hidden) target context.
 */
export function InquiryForm({
  kind,
  targetManufacturerId,
  targetProductId,
  rfqId,
  label,
}: {
  kind: InquiryKind;
  targetManufacturerId?: string;
  targetProductId?: string;
  rfqId?: string;
  label?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await createInquiry(formData);
      if (res.ok) {
        setDone(true);
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (done) {
    return <p className="text-sm text-green-600">{t("inquiryForm.sent")}</p>;
  }
  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {label ?? t("inquiryForm.requestIntro")}
      </Button>
    );
  }

  return (
    <form action={onSubmit} className="space-y-2 rounded-md border border-neutral-200 p-3">
      <input type="hidden" name="kind" value={kind} />
      {targetManufacturerId && <input type="hidden" name="targetManufacturerId" value={targetManufacturerId} />}
      {targetProductId && <input type="hidden" name="targetProductId" value={targetProductId} />}
      {rfqId && <input type="hidden" name="rfqId" value={rfqId} />}
      <Textarea
        name="message"
        rows={3}
        required
        placeholder={t("inquiryForm.messagePlaceholder")}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? t("inquiryForm.sending") : t("inquiryForm.send")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
