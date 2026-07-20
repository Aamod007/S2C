import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Public routes: auth pages, landing page, and webhook endpoints
// (webhooks are signed by their providers and can't authenticate via Clerk).
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/dashboard(.*)',
  '/api/billing/webhook(.*)',
  '/api/inngest(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Clerk auto-proxy
    '/__clerk/:path*',
  ],
}
