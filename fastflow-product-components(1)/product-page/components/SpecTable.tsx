"use client";

import { useState } from "react";
import type { Spec } from "./types";
import { bySort } from "./types";

interface Props {
  specs: Spec[];
  editable?: boolean;
  onChange?: (specs: Spec[]) => void; // fires on every edit; persist debounced / on blur
}

// Read-only OR editable, controlled by `editable`.
// Nothing here is hardcoded — the table is whatever rows this product has.
export default function SpecTable({ specs, editable, onChange }: Props) {
  const [rows, setRows] = useState<Spec[]>([...specs].sort(bySort));

  const push = (next: Spec[]) => {
    setRows(next);
    onChange?.(next);
  };

  const update = (id: string, patch: Partial<Spec>) =>
    push(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const remove = (id: string) =>
    push(rows.filter((r) => r.id !== id).map((r, i) => ({ ...r, sortOrder: i })));

  const move = (id: string, dir: -1 | 1) => {
    const i = rows.findIndex((r) => r.id === id);
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    push(next.map((r, k) => ({ ...r, sortOrder: k })));
  };

  const add = () =>
    push([
      ...rows,
      { id: crypto.randomUUID(), label: "", value: "", sortOrder: rows.length },
    ]);

  if (!editable) {
    return (
      <div className="spectable">
        {rows.map((s) => (
          <div className="srow" key={s.id}>
            <div className="k">{s.label}</div>
            <div className="v">{s.value}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {rows.map((s) => (
        <div className="editrow" key={s.id}>
          <input
            placeholder="Label (e.g. Frame material)"
            value={s.label}
            onChange={(e) => update(s.id, { label: e.target.value })}
          />
          <input
            placeholder="Value (e.g. Aluminum alloy)"
            value={s.value}
            onChange={(e) => update(s.id, { value: e.target.value })}
          />
          <div style={{ display: "flex", gap: 4 }}>
            <button className="iconbtn" title="Up" onClick={() => move(s.id, -1)}>↑</button>
            <button className="iconbtn" title="Down" onClick={() => move(s.id, 1)}>↓</button>
            <button className="iconbtn" title="Remove" onClick={() => remove(s.id)}>✕</button>
          </div>
        </div>
      ))}
      <button className="addrow" onClick={add}>+ Add specification</button>
    </div>
  );
}
