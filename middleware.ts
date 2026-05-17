// middleware.ts — Clerk auth middleware
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/auctions(.*)',
  '/api/auctions(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/auth/sign-in(.*)',
  '/auth/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/ably-token(.*)',
])

export default clerkMiddleware((auth, req) => {
  if (req.nextUrl.hostname === 'ironbid-auction.vercel.app') {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.hostname = 'app.ironbidequipmentauctions.com'
    redirectUrl.protocol = 'https:'
    return NextResponse.redirect(redirectUrl, 308)
  }

  // DEV_AUTH_BYPASS disables all auth — only ever honored outside production,
  // so a leaked env var cannot expose a deployed environment.
  if (process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production') return
  if (!isPublicRoute(req)) auth().protect()
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
