import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Public routes: portal landing, auth screens, the auth API, and the public
// read/lead API bridge consumed by the Flask buyer site. Everything else (the
// dashboard + server actions) requires a session.
const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/api/auth", "/api/webhooks", "/api/public"];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  if (isPublic(req.nextUrl.pathname)) return NextResponse.next();

  // Optimistic cookie check only (no DB hit at the edge). The session is fully
  // re-validated server-side in getCurrentUser; this just gates navigation and
  // bounces signed-out users to sign-in with a return path.
  const sessionCookie = getSessionCookie(req);
  if (!sessionCookie) {
    const signIn = new URL("/sign-in", req.url);
    signIn.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on everything except static assets and Next internals.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ico|webp|woff2?|ttf)).*)",
    "/(api|trpc)(.*)",
  ],
};
