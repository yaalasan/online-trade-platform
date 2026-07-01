"use client";

import type { DescriptionBlock } from "./types";
import { bySort } from "./types";

interface Props {
  blocks: DescriptionBlock[];
  editable?: boolean;
  onAddBlock?: () => void; // open your block-type picker + uploader
}

// Suppliers interleave as much media as they want — each block is text, a banner,
// an image grid, or a video. This is the "more space for media" requirement.
export default function DescriptionBlocks({ blocks, editable, onAddBlock }: Props) {
  const ordered = [...blocks].sort(bySort);

  return (
    <div>
      {ordered.map((b) => {
        switch (b.type) {
          case "text":
            return (
              <div className="descblock" key={b.id}>
                <p>{b.content.text}</p>
              </div>
            );
          case "banner":
            return (
              <div className="descblock" key={b.id}>
                <img className="mediabanner" src={b.content.url} alt={b.content.alt || ""} />
              </div>
            );
          case "image_grid":
            return (
              <div className="descblock" key={b.id}>
                <div className="mediagrid">
                  {b.content.images.map((img, i) => (
                    <img key={i} src={img.url} alt={img.alt || ""} />
                  ))}
                </div>
              </div>
            );
          case "video":
            return (
              <div className="descblock" key={b.id}>
                <video
                  src={b.content.url}
                  poster={b.content.poster}
                  controls
                  style={{ width: "100%", borderRadius: 10, border: "1px solid var(--line)" }}
                />
              </div>
            );
          default:
            return null;
        }
      })}

      {editable && (
        <div className="add-media-cta" onClick={onAddBlock}>
          <b>+ Add media block</b> · image grid, banner, or video · drag to reorder
        </div>
      )}
    </div>
  );
}
