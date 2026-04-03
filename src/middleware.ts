import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/onboarding(.*)",
  "/profile(.*)",
]);

const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);
const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const isApiRoute = createRouteMatcher(["/api(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Protect routes that require auth
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Skip redirect logic for API routes
  if (isApiRoute(req)) return;

  // If signed in, redirect away from auth pages
  if (userId && isAuthRoute(req)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // If signed in but not on onboarding, check if they need onboarding
  if (userId && !isOnboardingRoute(req)) {
    try {
      const baseUrl = req.nextUrl.origin;
      const res = await fetch(`${baseUrl}/api/profile/check?clerkId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.needsOnboarding) {
          return NextResponse.redirect(new URL("/onboarding", req.url));
        }
      }
    } catch {
      // If check fails, don't block — let them through
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
