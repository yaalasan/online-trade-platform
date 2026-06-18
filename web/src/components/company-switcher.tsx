"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchCompany } from "@/server/companies";
import { Select } from "@/components/ui/primitives";

type Option = { companyId: string; name: string; role: string };

export function CompanySwitcher({
  options,
  activeCompanyId,
}: {
  options: Option[];
  activeCompanyId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Select
      aria-label="Active company"
      className="w-56"
      disabled={pending}
      defaultValue={activeCompanyId}
      onChange={(e) => {
        const companyId = e.target.value;
        if (companyId === activeCompanyId) return;
        start(async () => {
          const res = await switchCompany(companyId);
          if (res.ok) router.refresh();
        });
      }}
    >
      {options.map((o) => (
        <option key={o.companyId} value={o.companyId}>
          {o.name} · {o.role}
        </option>
      ))}
    </Select>
  );
}
