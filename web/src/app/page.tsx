import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

/**
 * Portal landing. This app is the supplier/manufacturer + staff workspace — buyers
 * use the public Flask site. Signed-in users go straight to the dashboard.
 */
export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  const mainSite = process.env.NEXT_PUBLIC_MAIN_SITE_URL || "http://localhost:5000";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        SinoSource <span className="text-brand">Supplier Portal</span>
      </h1>
      <p className="max-w-xl text-neutral-600">
        For manufacturers and suppliers: create your company, add products, photos and
        certifications, and get verified. Everything you publish appears on the SinoSource
        marketplace for buyers automatically.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/sign-up" className={buttonVariants()}>
          List your company
        </Link>
        <Link href="/sign-in" className={buttonVariants({ variant: "outline" })}>
          Sign in
        </Link>
        <a href={mainSite} className={buttonVariants({ variant: "outline" })}>
          ← Back to main site
        </a>
      </div>
    </main>
  );
}
