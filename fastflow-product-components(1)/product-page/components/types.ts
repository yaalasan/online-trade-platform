// types.ts — Fastflow product data model
// Everything per-product is a list you control. No hardcoded spec fields:
// a carport and a fabric roll share zero attributes, so the page renders
// whatever rows exist for THIS product.

export type MediaType = "image" | "video" | "360";

export interface Media {
  id: string;
  type: MediaType;
  url: string;        // full-res / video source (R2)
  thumbUrl: string;   // small thumbnail for the rail
  sortOrder: number;
}

export interface Spec {
  id: string;
  label: string;      // e.g. "Frame material"
  value: string;      // e.g. "Aluminum alloy"
  sortOrder: number;
}

export interface Variant {
  id: string;
  name: string;       // e.g. "Color"
  options: string[];  // e.g. ["Blue", "Yellow", "Red"]
}

export interface PriceTier {
  id: string;
  minQty: number;
  maxQty: number | null; // null = "and above"
  price: number;
}

export interface Packaging {
  packageSize?: string | null;   // "300 × 30 × 50 cm"
  grossWeight?: string | null;   // "500 kg"
  port?: string | null;
  leadTime?: string | null;      // "15–25 days after deposit"
}

export type DescriptionBlock =
  | { id: string; type: "text"; sortOrder: number; content: { text: string } }
  | { id: string; type: "banner"; sortOrder: number; content: { url: string; alt?: string } }
  | { id: string; type: "image_grid"; sortOrder: number; content: { images: { url: string; alt?: string }[] } }
  | { id: string; type: "video"; sortOrder: number; content: { url: string; poster?: string } };

export interface Faq {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface Supplier {
  id: string;
  name: string;
  kind: string;        // "Manufacturer / Trading Co."
  location: string;    // "Guangdong, China"
  verified: boolean;
  audited: boolean;
  memberSince?: string;
}

export interface Product {
  id: string;
  title: string;
  hot?: boolean;
  priceMin: number;
  priceMax?: number | null;
  priceUnit: string;   // "m²", "piece"
  moq: number;
  moqUnit: string;
  modelNo?: string;
  brand?: string;
  origin?: string;
  hsCode?: string;
  supplier: Supplier;

  media: Media[];
  specs: Spec[];
  variants: Variant[];
  priceTiers: PriceTier[];
  packaging: Packaging;
  descriptionBlocks: DescriptionBlock[];
  faqs: Faq[];
}

// Sort helper — always render lists in the order the supplier arranged them.
export const bySort = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;
