import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureUserSynced, getActiveContext } from "@/lib/auth/session";
import { CompanySwitcher } from "@/components/company-switcher";
import { UserMenu } from "@/components/user-menu";
import { RoleBadge } from "@/components/ui/primitives";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/lib/i18n/server";

const NAV = [
  { href: "/dashboard", key: "nav.overview" },
  { href: "/dashboard/suppliers", key: "nav.suppliers" },
  { href: "/dashboard/catalog", key: "nav.catalog" },
  { href: "/dashboard/rfqs", key: "nav.rfqs" },
  { href: "/dashboard/inquiries", key: "nav.inquiries" },
  { href: "/dashboard/products", key: "nav.products" },
  { href: "/dashboard/profile", key: "nav.profile" },
  { href: "/dashboard/verification", key: "nav.verification" },
  { href: "/dashboard/members", key: "nav.members" },
  { href: "/dashboard/settings", key: "nav.settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await ensureUserSynced();
  const ctx = await getActiveContext();
  if (!ctx) redirect("/onboarding"); // signed in but no company yet
  const t = await getT();

  const options = ctx.user.memberships.map((m) => ({
    companyId: m.companyId,
    name: m.company.name,
    role: m.role,
  }));

  // Fastflow staff get the broker queue; ADMINs additionally get the KYB review
  // queue. Ordinary users never see either.
  const staffNav = [
    ...(ctx.user.platformRole !== "NONE" ? [{ href: "/dashboard/broker", key: "nav.broker" }] : []),
    ...(ctx.user.platformRole === "ADMIN" ? [{ href: "/dashboard/kyb", key: "nav.kyb" }] : []),
  ];
  const nav = [...NAV, ...staffNav];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="font-semibold">
              Fast<span className="text-brand">flow</span>
            </Link>
            <CompanySwitcher options={options} activeCompanyId={ctx.company.id} />
            <Link
              href="/dashboard/companies/new"
              className="whitespace-nowrap rounded-md border border-neutral-200 px-2 py-1 text-sm text-neutral-600 hover:border-brand hover:text-brand"
            >
              {t("nav.newCompany")}
            </Link>
            <RoleBadge role={ctx.role} />
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <UserMenu
              label={
                `${ctx.user.firstName ?? ""} ${ctx.user.lastName ?? ""}`.trim() || ctx.user.email
              }
            />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-5">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-b-2 border-transparent px-3 py-2 text-sm text-neutral-600 hover:border-brand hover:text-brand"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
