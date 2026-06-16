"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  uploadVerificationDocument,
  deleteVerificationDocument,
  submitVerificationCase,
} from "@/server/verification";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/primitives";

export type VerificationDocView = {
  id: string;
  type: string;
  url: string;
  fileName: string | null;
};

const DOC_TYPES = ["BUSINESS_LICENSE", "TAX_CERTIFICATE", "ISO_CERTIFICATE", "ID_DOCUMENT", "OTHER"] as const;

export function VerificationDocuments({
  documents,
  editable,
}: {
  documents: VerificationDocView[];
  editable: boolean;
}) {
  return (
    <div className="space-y-4">
      {documents.length === 0 ? (
        <p className="text-sm text-neutral-500">No documents attached yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-4 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{d.type.replace(/_/g, " ")}</span>{" "}
                <a href={d.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                  {d.fileName ?? "view"}
                </a>
              </div>
              {editable && <DeleteDocButton id={d.id} />}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <>
          <UploadDocForm />
          <SubmitCaseButton disabled={documents.length === 0} />
        </>
      )}
    </div>
  );
}

function UploadDocForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await uploadVerificationDocument(formData);
      if (res.ok) {
        (document.getElementById("upload-kyb-doc-form") as HTMLFormElement | null)?.reset();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form id="upload-kyb-doc-form" action={onSubmit} className="space-y-3 rounded-md border border-neutral-200 p-4">
      <p className="text-sm font-medium">Add document</p>
      <div>
        <Label htmlFor="doc-type">Type</Label>
        <Select id="doc-type" name="type" defaultValue="BUSINESS_LICENSE">
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="doc-file">File (image or PDF — max 8 MB)</Label>
        <Input
          id="doc-file"
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="h-auto py-1.5"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload document"}
      </Button>
    </form>
  );
}

function SubmitCaseButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <Button
        disabled={pending || disabled}
        onClick={() => {
          if (!confirm("Submit your application for review? You won't be able to edit it while it's reviewed.")) return;
          start(async () => {
            const res = await submitVerificationCase();
            if (!res.ok) alert(res.error);
            router.refresh();
          });
        }}
      >
        {pending ? "Submitting…" : "Submit for review"}
      </Button>
      {disabled && <span className="text-xs text-neutral-500">Attach at least one document first.</span>}
    </div>
  );
}

function DeleteDocButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this document?")) return;
        const fd = new FormData();
        fd.set("id", id);
        start(async () => {
          const res = await deleteVerificationDocument(fd);
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
    >
      Remove
    </Button>
  );
}
