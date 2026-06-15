import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        SinoSource <span className="text-brand">B2B Sourcing</span>
      </h1>
      <p className="max-w-xl text-neutral-600">
        Connect Chinese manufacturers with international buyers. Create your company, invite your
        team, and manage everything from one workspace.
      </p>
      <div className="flex gap-3">
        <Link href="/sign-up" className={buttonVariants()}>
          Get started
        </Link>
        <Link href="/sign-in" className={buttonVariants({ variant: "outline" })}>
          Sign in
        </Link>
      </div>
    </main>
  );
}
