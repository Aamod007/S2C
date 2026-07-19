import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth/signin",
  "/auth/signup",
]);

const isAuthRoute = createRouteMatcher([
  "/auth/signin",
  "/auth/signup",
]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isAuthenticated = await convexAuth.isAuthenticated();

  // If authenticated user visits auth pages, redirect to dashboard
  if (isAuthenticated && isAuthRoute(request)) {
    return nextjsMiddlewareRedirect(request, "/dashboard");
  }

  // If unauthenticated user visits protected routes, redirect to signin
  if (!isAuthenticated && !isPublicRoute(request)) {
    return nextjsMiddlewareRedirect(request, "/auth/signin");
  }
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
