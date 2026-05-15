// app/api/carriers/stripe-onboard/route.ts — Redirect carrier to Stripe Connect
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserByClerkId, getCarrierProfile } from '@/lib/db'
import { createCarrierConnectAccount, createCarrierOnboardingLink } from '@/lib/stripe'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/schema'

export async function GET(req: NextRequest) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.redirect(new URL('/auth/sign-in', req.url))

  const user    = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.redirect(new URL('/onboarding', req.url))

  const profile = await getCarrierProfile(user.id)
  if (!profile) return NextResponse.redirect(new URL('/carrier/register', req.url))

  const origin = req.nextUrl.origin

  // Create Stripe Connect account if not yet created
  let stripeAccountId = profile.stripeAccountId
  if (!stripeAccountId) {
    const account = await createCarrierConnectAccount({
      email:       user.email,
      companyName: profile.companyName,
      carrierId:   user.id,
    })
    stripeAccountId = account.id
    await db.update(schema.carrierProfiles)
      .set({ stripeAccountId: account.id })
      .where(eq(schema.carrierProfiles.userId, user.id))
  }

  // Generate onboarding link
  const link = await createCarrierOnboardingLink(stripeAccountId, origin)
  return NextResponse.redirect(link.url)
}
