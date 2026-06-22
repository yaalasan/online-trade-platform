"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMember, updateMemberRole, removeMember } from "@/server/members";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n/client";

const ASSIGNABLE = ["ADMIN", "MANAGER", "MEMBER"] as const;

export function InviteMemberForm() {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await inviteMember(formData);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <form action={onSubmit} className="flex flex-wrap items-end gap-2">
      <Input name="email" type="email" required placeholder={t("memberForm.emailPlaceholder")} className="w-64" />
      <Select name="role" defaultValue="MEMBER" className="w-32">
        {ASSIGNABLE.map((r) => (
          <option key={r} value={r}>
            {t(`roles.${r}`)}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={pending}>
        {pending ? t("memberForm.adding") : t("memberForm.addMember")}
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function MemberRoleControl({
  membershipId,
  role,
}: {
  membershipId: string;
  role: string;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();

  return (
    <Select
      className="w-32"
      disabled={pending}
      defaultValue={role}
      onChange={(e) => {
        const fd = new FormData();
        fd.set("membershipId", membershipId);
        fd.set("role", e.target.value);
        start(async () => {
          const res = await updateMemberRole(fd);
          if (res.ok) router.refresh();
          else {
            alert(res.error);
            router.refresh();
          }
        });
      }}
    >
      {ASSIGNABLE.map((r) => (
        <option key={r} value={r}>
          {t(`roles.${r}`)}
        </option>
      ))}
    </Select>
  );
}

export function RemoveMemberButton({ membershipId }: { membershipId: string }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("memberForm.removeConfirm"))) return;
        const fd = new FormData();
        fd.set("membershipId", membershipId);
        start(async () => {
          const res = await removeMember(fd);
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
    >
      {t("common.remove")}
    </Button>
  );
}
