import * as React from "react";
import { cn } from "@/lib/utils";

// A small set of shadcn-style primitives kept in one file for the foundation.

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-neutral-200 bg-white shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-neutral-100 p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-sm font-medium text-neutral-700", className)} {...props} />;
}

const ROLE_STYLES: Record<string, string> = {
  OWNER: "bg-brand-light text-brand-dark",
  ADMIN: "bg-blue-50 text-blue-700",
  MANAGER: "bg-amber-50 text-amber-700",
  MEMBER: "bg-neutral-100 text-neutral-600",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ROLE_STYLES[role] ?? ROLE_STYLES.MEMBER)}>
      {role}
    </span>
  );
}

const RFQ_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600",
  OPEN: "bg-green-50 text-green-700",
  CLOSED: "bg-blue-50 text-blue-700",
  CANCELLED: "bg-red-50 text-red-700",
};

export function RfqStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        RFQ_STATUS_STYLES[status] ?? RFQ_STATUS_STYLES.DRAFT,
      )}
    >
      {status}
    </span>
  );
}

const PRODUCT_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600",
  ACTIVE: "bg-green-50 text-green-700",
  ARCHIVED: "bg-amber-50 text-amber-700",
};

export function ProductStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        PRODUCT_STATUS_STYLES[status] ?? PRODUCT_STATUS_STYLES.DRAFT,
      )}
    >
      {status}
    </span>
  );
}

const VERIFICATION_STYLES: Record<string, string> = {
  UNVERIFIED: "bg-neutral-100 text-neutral-600",
  PENDING: "bg-amber-50 text-amber-700",
  VERIFIED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-700",
};

const VERIFICATION_LABELS: Record<string, string> = {
  UNVERIFIED: "Unverified",
  PENDING: "Pending review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export function VerificationBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        VERIFICATION_STYLES[status] ?? VERIFICATION_STYLES.UNVERIFIED,
      )}
    >
      {VERIFICATION_LABELS[status] ?? status}
    </span>
  );
}
