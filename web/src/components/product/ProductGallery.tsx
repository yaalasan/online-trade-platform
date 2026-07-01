"use client";

import { useState, useRef } from "react";
import type { Media, MediaType } from "./types";
import { bySort } from "./types";

interface Props {
  media: Media[];
  editable?: boolean;
  onUpload?: (type: MediaType) => void;
}

export default function ProductGallery({ media, editable, onUpload }: Props) {
  const items = [...media].sort(bySort);
  const [active, setActive] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const current = items[active];

  const zoom = (e: React.MouseEvent) => {
    const el = e.currentTarget.querySelector("img") as HTMLImageElement | null;
    if (!el || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    el.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    el.style.transform = "scale(1.9)";
  };
  const unzoom = (e: React.MouseEvent) => {
    const el = e.currentTarget.querySelector("img") as HTMLImageElement | null;
    if (el) el.style.transform = "scale(1)";
  };

  return (
    <div className="gallery">
      <div className="stage" ref={stageRef} onMouseMove={zoom} onMouseLeave={unzoom}>
        {current?.type === "video" ? (
          <video src={current.url} controls poster={current.thumbUrl} />
        ) : current ? (
          <img src={current.url} alt="" />
        ) : (
          <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#fff" }}>
            No media yet
          </div>
        )}
        {current?.type !== "video" && <div className="zoomhint">🔍 Hover to zoom</div>}
        {items.length > 0 && <div className="counter">{active + 1} / {items.length}</div>}
      </div>

      <div className="rail">
        {items.map((m, i) => (
          <div
            key={m.id}
            className={"thumb" + (i === active ? " active" : "")}
            onClick={() => setActive(i)}
          >
            <img src={m.thumbUrl} alt="" />
            {m.type === "video" && <div className="vtag" />}
          </div>
        ))}

        {editable && (["image", "video", "360"] as MediaType[]).map((t) => (
          <button key={t} className="addtile" onClick={() => onUpload?.(t)}>
            <b>+</b>
            {t === "image" ? "Photo" : t === "video" ? "Video" : "360°"}
          </button>
        ))}
      </div>
    </div>
  );
}
