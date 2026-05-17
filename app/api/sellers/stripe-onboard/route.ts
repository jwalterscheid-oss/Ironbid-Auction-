// app/api/sellers/stripe-onboard/route.ts — Redirect seller to Stripe Connect onboarding
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db, getUserByClerkId } from '@/lib/db'
import * as schema from '@/lib/schema'
import { createSellerConnectAccount, createSellerOnboardingLink } from '@/lib/stripe'

export async function GET(req: NextRequest) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.redirect(new URL('/auth/sign-in', req.url))

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.redirect(new URL('/onboarding', req.url))
  if (!['seller', 'dealer', 'admin'].includes(user.role)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const origin = req.nextUrl.origin

  // Create the seller's Connect account on first visit.
  let accountId = user.stripeConnectAccountId
  if (!accountId) {
    const account = await createSellerConnectAccount({
      email: user.email,
      sellerId: user.id,
      companyName: user.companyName ?? undefined,
    })
    accountId = account.id
    await db
      .update(schema.users)
      .set({ stripeConnectAccountId: account.id, updatedAt: new Date() })
      .where(eq(schema.users.id, user.id))
  }

  const link = await createSellerOnboardingLink(accountId, origin)
  return NextResponse.redirect(link.url)
}
