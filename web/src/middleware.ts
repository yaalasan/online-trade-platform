import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes: marketing, auth screens, and the Clerk webhook.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
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
