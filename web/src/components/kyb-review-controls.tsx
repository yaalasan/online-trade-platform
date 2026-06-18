"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewVerificationCase } from "@/server/verification";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/primitives";

const DECISIONS = [
  { value: "UNDER_REVIEW", label: "Mark under review" },
  { value: "APPROVED", label: "Approve" },
  { value: "REJECTED", label: "Reject" },
] as const;

export function KybReviewControls({ id, reviewNotes }: { id: string; reviewNotes: string | null }) {
  const router = useRouter();
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
        <Label htmlFor={`notes-${id}`}>Review note (required to reject)</Label>
        <Textarea id={`notes-${id}`} name="reviewNotes" rows={2} defaultValue={reviewNotes ?? ""} disabled={pending} />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor={`decision-${id}`}>Decision</Label>
          <Select id={`decision-${id}`} name="decision" defaultValue="UNDER_REVIEW" className="w-48" disabled={pending}>
            {DECISIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Apply decision"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
