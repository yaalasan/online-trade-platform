import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ensureUserSynced, getActiveContext } from "@/lib/auth/session";
import { CompanySwitcher } from "@/components/company-switcher";
import { RoleBadge } from "@/components/ui/primitives";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/suppliers", label: "Suppliers" },
  { href: "/dashboard/catalog", label: "Catalog" },
  { href: "/dashboard/rfqs", label: "RFQs" },
  { href: "/dashboard/inquiries", label: "Inquiries" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/verification", label: "Verification" },
  { href: "/dashboard/members", label: "Members" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await ensureUserSynced();
  const ctx = await getActiveContext();
  if (!ctx) redirect("/onboarding"); // signed in but no company yet

  const options = ctx.user.memberships.map((m) => ({
    companyId: m.companyId,
    name: m.company.name,
    role: m.role,
  }));

  // SinoSource staff get the broker queue; ADMINs additionally get the KYB review
  // queue. Ordinary users never see either.
  const staffNav = [
    ...(ctx.user.platformRole !== "NONE" ? [{ href: "/dashboard/broker", label: "Broker" }] : []),
    ...(ctx.user.platformRole === "ADMIN" ? [{ href: "/dashboard/kyb", label: "KYB" }] : []),
  ];
  const nav = [...NAV, ...staffNav];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="font-semibold">
              Sino<span className="text-brand">Source</span>
            </Link>
            <CompanySwitcher options={options} activeCompanyId={ctx.company.id} />
            <RoleBadge role={ctx.role} />
          </div>
          <UserButton />
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-5">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-b-2 border-transparent px-3 py-2 text-sm text-neutral-600 hover:border-brand hover:text-brand"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
