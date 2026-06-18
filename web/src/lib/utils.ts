import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner (shadcn/ui convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Human-readable indicative price range from stringified Decimal values. */
export function formatPriceRange(
  min: string | null,
  max: string | null,
  currency: string | null,
): string {
  if (!min && !max) return "On request";
  const cur = currency ? ` ${currency}` : "";
  if (min && max && min !== max) return `${min} – ${max}${cur}`;
  return `${min ?? max}${cur}`;
}

/** URL-safe slug from a company name. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
