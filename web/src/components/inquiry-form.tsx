"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInquiry } from "@/server/inquiries";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/primitives";

type InquiryKind = "SUPPLIER" | "PRODUCT" | "RFQ" | "GENERAL";

/**
 * "Request introduction" control. Collapsed to a button until opened; on submit it
 * sends an inquiry to the SinoSource broker queue with the (hidden) target context.
 */
export function InquiryForm({
  kind,
  targetManufacturerId,
  targetProductId,
  rfqId,
  label = "Request introduction",
}: {
  kind: InquiryKind;
  targetManufacturerId?: string;
  targetProductId?: string;
  rfqId?: string;
  label?: string;
}) {
  const router = useRouter();
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
    return <p className="text-sm text-green-600">Request sent — SinoSource will be in touch.</p>;
  }
  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {label}
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
        placeholder="What are you looking for? Quantities, timeline, target market…"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Send to SinoSource"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
