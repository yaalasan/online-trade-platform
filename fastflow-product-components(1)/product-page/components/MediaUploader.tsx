"use client";

import { useRef, useState } from "react";
import type { Media, MediaType } from "./types";

interface Props {
  productId: string;
  type: MediaType;
  onUploaded: (media: Media) => void;   // append to product.media then persist
  apiBase?: string;                     // Flask base, e.g. "/api"
}

// Flow: ask Flask for a presigned PUT URL -> upload straight to R2 -> tell parent.
// The file never passes through your server; Flask only signs and validates metadata.
const MAX_MB = 25;
const ALLOWED: Record<MediaType, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/webm"],
  "360": ["image/jpeg", "image/png"],
};

export default function MediaUploader({ productId, type, onUploaded, apiBase = "/api" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handle = async (file: File) => {
    setErr(null);
    if (!ALLOWED[type].includes(file.type)) return setErr(`Unsupported file type for ${type}.`);
    if (file.size > MAX_MB * 1024 * 1024) return setErr(`File exceeds ${MAX_MB}MB.`);

    setBusy(true);
    try {
      // 1) get a presigned URL + final public URL from Flask (auth required server-side)
      const res = await fetch(`${apiBase}/products/${productId}/media/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ contentType: file.type, size: file.size, kind: type }),
      });
      if (!res.ok) throw new Error("Could not get upload URL.");
      const { uploadUrl, url, thumbUrl, id } = await res.json();

      // 2) upload the bytes straight to R2
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed.");

      // 3) hand the new media row back to the parent to add + persist
      onUploaded({ id, type, url, thumbUrl: thumbUrl || url, sortOrder: Number.MAX_SAFE_INTEGER });
    } catch (e: any) {
      setErr(e.message || "Upload error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={ALLOWED[type].join(",")}
        onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
      />
      <button className="addtile" onClick={() => inputRef.current?.click()} disabled={busy}>
        <b>+</b>
        {busy ? "…" : type === "image" ? "Photo" : type === "video" ? "Video" : "360°"}
      </button>
      {err && <div className="err" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  );
}
