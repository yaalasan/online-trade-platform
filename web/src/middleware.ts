import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes: portal landing, auth screens, the Clerk webhook, and the public
// read/lead API bridge consumed by the Flask buyer site. Everything else (the
// dashboard + server actions) requires auth.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/public(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    // Everything under /dashboard, /onboarding, server actions, etc. requires auth.
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on everything except static assets and Next internals.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ico|webp|woff2?|ttf)).*)",
    "/(api|trpc)(.*)",
  ],
};
