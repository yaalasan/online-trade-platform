import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Page-based pagination. `makeHref` builds the URL for a given page while
 * preserving the caller's other query params. Server component (no client JS).
 */
export function Pagination({
  page,
  totalPages,
  makeHref,
}: {
  page: number;
  totalPages: number;
  makeHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex items-center justify-between">
      <Link
        aria-disabled={prevDisabled}
        tabIndex={prevDisabled ? -1 : undefined}
        href={makeHref(Math.max(1, page - 1))}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), prevDisabled && "pointer-events-none opacity-50")}
      >
        Previous
      </Link>
      <span className="text-sm text-neutral-500">
        Page {page} of {totalPages}
      </span>
      <Link
        aria-disabled={nextDisabled}
        tabIndex={nextDisabled ? -1 : undefined}
        href={makeHref(Math.min(totalPages, page + 1))}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), nextDisabled && "pointer-events-none opacity-50")}
      >
        Next
      </Link>
    </div>
  );
}
