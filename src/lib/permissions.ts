/**
 * Route permission matchers for Next.js middleware.
 * Used by Convex Auth middleware to determine access control.
 */

/** Routes that bypass auth checks entirely (static assets, API routes, etc.) */
const bypassRoutes = [
  "/api/",
  "/_next/",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

/** Routes accessible without authentication — authenticated users get redirected to dashboard */
const publicRoutes = [
  "/",
  "/auth/signin",
  "/auth/signup",
];

/** Routes that require authentication — unauthenticated users get redirected to signin */
const protectedRoutes = [
  "/dashboard",
];

export function isBypassRoute(pathname: string): boolean {
  return bypassRoutes.some((route) => pathname.startsWith(route));
}

export function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => pathname === route);
}

export function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some((route) => pathname.startsWith(route));
}
