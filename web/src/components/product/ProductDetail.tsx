"use client";

import { useEffect, useState } from "react";
import type { Product, MediaType } from "./types";
import ProductGallery from "./ProductGallery";
import BuyPanel from "./BuyPanel";
import SpecTable from "./SpecTable";
import DescriptionBlocks from "./DescriptionBlocks";
import { FaqAccordion, InquiryForm } from "./FaqAndInquiry";
import "./product-detail.css";

interface Props {
  product: Product;
  editable?: boolean;
  onUploadMedia?: (type: MediaType) => void;
  onAddDescBlock?: () => void;
  onSpecsChange?: (specs: Product["specs"]) => void;
}

const TABS = [
  { id: "specs", label: "Specifications" },
  { id: "packaging", label: "Packaging" },
  { id: "desc", label: "Description" },
  { id: "faq", label: "FAQ" },
  { id: "inquiry", label: "Contact supplier" },
];

export default function ProductDetail({
  product, editable, onUploadMedia, onAddDescBlock, onSpecsChange,
}: Props) {
  const [activeTab, setActiveTab] = useState("specs");
  const s = product.supplier;

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => e.isIntersecting && setActiveTab((e.target as HTMLElement).id)),
      { rootMargin: "-20% 0px -70% 0px" }
    );
    TABS.forEach((t) => {
      const el = document.getElementById(t.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const go = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const pk = product.packaging;
  const pkRows = [
    ["Package size", pk.packageSize],
    ["Gross weight", pk.grossWeight],
    ["Port", pk.port],
    ["Lead time", pk.leadTime],
  ].filter(([, v]) => v);

  return (
    <div className="ff">
      <div className="wrap">
        <div className="hero">
          <ProductGallery media={product.media} editable={editable} onUpload={onUploadMedia} />
          <BuyPanel product={product} />
        </div>

        <div className="supplier">
          <div className="avatar">{s.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="sname">{s.name}</div>
            <div className="smeta">{s.kind} · {s.location}</div>
          </div>
          <div className="spacer" />
          {s.verified && <span className="badge verified">✓ Verified supplier</span>}
          {s.audited && <span className="badge audited">Audited factory</span>}
          {s.memberSince && <span className="badge member">Member since {s.memberSince}</span>}
        </div>

        <nav className="tabs">
          {TABS.map((t) => (
            <a key={t.id} className={activeTab === t.id ? "active" : ""} onClick={() => go(t.id)}>
              {t.label}
            </a>
          ))}
        </nav>

        <section className="block" id="specs">
          <h2>Basic information</h2>
          <SpecTable specs={product.specs} editable={editable} onChange={onSpecsChange} />
        </section>

        {pkRows.length > 0 && (
          <section className="block" id="packaging">
            <h2>Packaging &amp; delivery</h2>
            <div className="spectable">
              {pkRows.map(([k, v]) => (
                <div className="srow" key={k as string}>
                  <div className="k">{k}</div>
                  <div className="v">{v}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="block" id="desc">
          <h2>Product description</h2>
          <DescriptionBlocks blocks={product.descriptionBlocks} editable={editable} onAddBlock={onAddDescBlock} />
        </section>

        {product.faqs.length > 0 && (
          <section className="block" id="faq">
            <h2>Frequently asked questions</h2>
            <FaqAccordion faqs={product.faqs} />
          </section>
        )}

        <section className="block" id="inquiry">
          <h2>Send your message to this supplier</h2>
          <InquiryForm
            onSubmit={async (v) => {
              const res = await fetch(`/api/products/${product.id}/inquiry`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(v),
              });
              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Failed to send inquiry.");
              }
            }}
          />
        </section>
      </div>
    </div>
  );
}
