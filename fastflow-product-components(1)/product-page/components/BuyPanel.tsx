"use client";

import { useState } from "react";
import type { Product } from "./types";

interface Props {
  product: Product;
  onInquiry?: (selection: Record<string, string>, qty: number) => void;
  onStartOrder?: () => void;
  onChat?: () => void;
}

export default function BuyPanel({ product, onInquiry, onStartOrder, onChat }: Props) {
  // default each variant to its first option
  const [selection, setSelection] = useState<Record<string, string>>(
    Object.fromEntries(product.variants.map((v) => [v.name, v.options[0]]))
  );
  const [qty, setQty] = useState(product.moq);

  const priceLabel =
    product.priceMax && product.priceMax !== product.priceMin
      ? `US$${product.priceMin}–${product.priceMax}`
      : `US$${product.priceMin}`;

  return (
    <div className="buy">
      {product.hot && <div className="hot">🔥 Hot item</div>}
      <h1 className="ptitle">{product.title}</h1>

      <div className="pricebox">
        <div className="price">
          {priceLabel}
          <small> / {product.priceUnit}</small>
        </div>
        <div className="moq">
          <b>{product.moq} {product.moqUnit}</b>
          Min. order (MOQ)
        </div>
      </div>

      {product.priceTiers.length > 0 && (
        <div className="tiers">
          {product.priceTiers.map((t) => (
            <span key={t.id}>
              {t.minQty}
              {t.maxQty ? `–${t.maxQty}` : "+"} {product.moqUnit} · ${t.price}
              {"   "}
            </span>
          ))}
        </div>
      )}

      {product.variants.map((v) => (
        <div className="optrow" key={v.id}>
          <div className="optlabel">{v.name}</div>
          <div className="chips">
            {v.options.map((opt) => (
              <div
                key={opt}
                className="chip"
                role="button"
                aria-pressed={selection[v.name] === opt}
                onClick={() => setSelection((s) => ({ ...s, [v.name]: opt }))}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="optrow">
        <div className="optlabel">Quantity ({product.moqUnit})</div>
        <div className="qty">
          <button onClick={() => setQty((q) => Math.max(product.moq, q - 10))}>−</button>
          <input
            value={qty}
            inputMode="numeric"
            onChange={(e) => setQty(Math.max(product.moq, parseInt(e.target.value) || product.moq))}
          />
          <button onClick={() => setQty((q) => q + 10)}>+</button>
        </div>
      </div>

      <button className="cta primary" onClick={() => onInquiry?.(selection, qty)}>Send inquiry</button>
      <button className="cta ghost" onClick={onStartOrder}>Start order (escrow)</button>
      <button className="cta ghost" onClick={onChat}>Chat with supplier</button>

      <div className="trust">
        <div><span className="tick">✓</span> Escrow — funds released only after you confirm delivery</div>
        <div><span className="tick">✓</span> Pre-shipment inspection available</div>
        <div><span className="tick">✓</span> Platform logistics &amp; tracking</div>
        <div><span className="tick">✓</span> Dispute resolution &amp; refund support on eligible orders</div>
      </div>
    </div>
  );
}
