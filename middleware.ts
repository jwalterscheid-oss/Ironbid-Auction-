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

  if (process.env.DEV_AUTH_BYPASS === 'true') return
  if (!isPublicRoute(req)) auth().protect()
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
