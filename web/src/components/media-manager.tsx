"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadMedia, deleteMediaAsset } from "@/server/manufacturer";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n/client";

export type MediaView = {
  id: string;
  type: string;
  url: string;
  fileName: string | null;
  contentType: string | null;
  caption: string | null;
};

const TYPES = ["FACTORY_PHOTO", "LOGO", "CERTIFICATE", "OTHER"] as const;

export function MediaManager({
  media,
  canManage,
}: {
  media: MediaView[];
  canManage: boolean;
}) {
  const t = useT();
  return (
    <div className="space-y-4">
      {media.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("mediaManager.none")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {media.map((m) => (
            <figure key={m.id} className="overflow-hidden rounded-md border border-neutral-200">
              <div className="flex h-32 items-center justify-center bg-neutral-50">
                {m.contentType?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.caption ?? m.fileName ?? "media"} className="h-full w-full object-cover" />
                ) : (
                  <a href={m.url} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">
                    {m.fileName ?? t("mediaManager.openFile")}
                  </a>
                )}
              </div>
              <figcaption className="flex items-center justify-between gap-2 p-2 text-xs">
                <span className="truncate text-neutral-600">{m.caption || t(`mediaTypes.${m.type}`)}</span>
                {canManage && <DeleteMediaButton id={m.id} />}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {canManage && <UploadMediaForm />}
    </div>
  );
}

function UploadMediaForm() {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await uploadMedia(formData);
      if (res.ok) {
        (document.getElementById("upload-media-form") as HTMLFormElement | null)?.reset();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form id="upload-media-form" action={onSubmit} className="space-y-3 rounded-md border border-neutral-200 p-4">
      <p className="text-sm font-medium">{t("mediaManager.uploadTitle")}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="media-type">{t("company.type")}</Label>
          <Select id="media-type" name="type" defaultValue="FACTORY_PHOTO">
            {TYPES.map((mt) => (
              <option key={mt} value={mt}>
                {t(`mediaTypes.${mt}`)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="media-caption">{t("mediaManager.caption")}</Label>
          <Input id="media-caption" name="caption" placeholder={t("mediaManager.captionPlaceholder")} />
        </div>
      </div>
      <div>
        <Label htmlFor="media-file">{t("mediaManager.fileLabel")}</Label>
        <Input
          id="media-file"
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="h-auto py-1.5"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? t("kybDocs.uploading") : t("mediaManager.upload")}
      </Button>
    </form>
  );
}

function DeleteMediaButton({ id }: { id: string }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("mediaManager.deleteConfirm"))) return;
        const fd = new FormData();
        fd.set("id", id);
        start(async () => {
          const res = await deleteMediaAsset(fd);
          if (!res.ok) alert(res.error);
          router.refresh();
        });
      }}
    >
      ✕
    </Button>
  );
}
