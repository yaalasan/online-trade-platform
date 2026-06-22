"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCertification, deleteCertification } from "@/server/manufacturer";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n/client";

export type CertificationView = {
  id: string;
  name: string;
  issuer: string | null;
  certificateNo: string | null;
  issuedAt: string | null; // pre-formatted date or null
  expiresAt: string | null;
  documentUrl: string | null;
};

export function CertificationManager({
  certifications,
  canManage,
}: {
  certifications: CertificationView[];
  canManage: boolean;
}) {
  const t = useT();
  return (
    <div className="space-y-4">
      {certifications.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("certManager.none")}</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {certifications.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="truncate text-xs text-neutral-500">
                  {[c.issuer, c.certificateNo].filter(Boolean).join(" · ") || "—"}
                  {c.expiresAt ? ` · ${t("suppliers.expires", { date: c.expiresAt })}` : ""}
                  {c.documentUrl ? (
                    <>
                      {" · "}
                      <a href={c.documentUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                        {t("suppliers.documentLink")}
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
              {canManage && <DeleteCertificationButton id={c.id} />}
            </li>
          ))}
        </ul>
      )}

      {canManage && <AddCertificationForm />}
    </div>
  );
}

function AddCertificationForm() {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await addCertification(formData);
      if (res.ok) {
        (document.getElementById("add-certification-form") as HTMLFormElement | null)?.reset();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form id="add-certification-form" action={onSubmit} className="space-y-3 rounded-md border border-neutral-200 p-4">
      <p className="text-sm font-medium">{t("certManager.addTitle")}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cert-name">{t("common.name")}</Label>
          <Input id="cert-name" name="name" required placeholder="ISO 9001" />
        </div>
        <div>
          <Label htmlFor="cert-issuer">{t("certManager.issuer")}</Label>
          <Input id="cert-issuer" name="issuer" placeholder="SGS" />
        </div>
        <div>
          <Label htmlFor="cert-no">{t("certManager.certNo")}</Label>
          <Input id="cert-no" name="certificateNo" placeholder="CN-12345" />
        </div>
        <div>
          <Label htmlFor="cert-doc">{t("certManager.docUrl")}</Label>
          <Input id="cert-doc" name="documentUrl" type="url" placeholder="https://…" />
        </div>
        <div>
          <Label htmlFor="cert-issued">{t("certManager.issued")}</Label>
          <Input id="cert-issued" name="issuedAt" type="date" />
        </div>
        <div>
          <Label htmlFor="cert-expires">{t("certManager.expiresLabel")}</Label>
          <Input id="cert-expires" name="expiresAt" type="date" />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? t("memberForm.adding") : t("certManager.addCert")}
      </Button>
    </form>
  );
}

function DeleteCertificationButton({ id }: { id: string }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("certManager.removeConfirm"))) return;
        const fd = new FormData();
        fd.set("id", id);
        start(async () => {
          const res = await deleteCertification(fd);
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
    >
      {t("common.remove")}
    </Button>
  );
}
