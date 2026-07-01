export type MediaType = "image" | "video" | "360";

export interface Media {
  id: string;
  type: MediaType;
  url: string;
  thumbUrl: string;
  sortOrder: number;
}

export interface Spec {
  id: string;
  label: string;
  value: string;
  sortOrder: number;
}

export interface Variant {
  id: string;
  name: string;
  options: string[];
}

export interface PriceTier {
  id: string;
  minQty: number;
  maxQty: number | null;
  price: number;
}

export interface Packaging {
  packageSize?: string | null;
  grossWeight?: string | null;
  port?: string | null;
  leadTime?: string | null;
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
  kind: string;
  location: string;
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
  priceUnit: string;
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

export const bySort = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;
