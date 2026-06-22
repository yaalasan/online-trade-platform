"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInquiry, assignInquiryToMe } from "@/server/inquiries";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n/client";

const STATUSES = ["NEW", "IN_REVIEW", "INTRODUCED", "CLOSED"] as const;

export function InquiryBrokerControls({
  id,
  status,
  brokerNotes,
  assignedToName,
}: {
  id: string;
  status: string;
  brokerNotes: string | null;
  assignedToName: string | null;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();

  function onSave(formData: FormData) {
    formData.set("id", id);
    start(async () => {
      const res = await updateInquiry(formData);
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  }

  function onAssign() {
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      const res = await assignInquiryToMe(fd);
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  }

  return (
    <form action={onSave} className="space-y-2 border-t border-neutral-100 pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor={`status-${id}`}>{t("common.status")}</Label>
          <Select id={`status-${id}`} name="status" defaultValue={status} className="w-40" disabled={pending}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.inquiry.${s}`)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onAssign}>
          {assignedToName ? t("brokerControls.assignedPrefix", { name: assignedToName }) : t("brokerControls.assignToMe")}
        </Button>
      </div>
      <div>
        <Label htmlFor={`notes-${id}`}>{t("brokerControls.internalNotes")}</Label>
        <Textarea
          id={`notes-${id}`}
          name="brokerNotes"
          rows={2}
          defaultValue={brokerNotes ?? ""}
          disabled={pending}
          placeholder={t("brokerControls.notesPlaceholder")}
        />
      </div>
    </form>
  );
}
