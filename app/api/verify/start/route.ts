// app/api/verify/start/route.ts — Launch Stripe Identity verification
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserByClerkId } from '@/lib/db'
import { createIdentityVerificationSession } from '@/lib/stripe'
import { isMockMode } from '@/lib/dev-mock'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin

  if (isMockMode) {
    // No real Stripe call in mock mode — bounce back with a mock marker.
    return NextResponse.redirect(new URL('/dashboard/verify?status=mock', origin))
  }

  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.redirect(new URL('/auth/sign-in', origin))

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.redirect(new URL('/onboarding', origin))
  if (user.kycStatus === 'verified') {
    return NextResponse.redirect(new URL('/dashboard', origin))
  }

  try {
    const session = await createIdentityVerificationSession({
      userId: user.id,
      email: user.email,
      returnUrl: `${origin}/dashboard/verify?status=submitted`,
    })

    if (!session.url) {
      throw new Error('Stripe did not return a verification URL')
    }
    return NextResponse.redirect(session.url)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'verification_unavailable'
    return NextResponse.redirect(
      new URL(`/dashboard/verify?error=${encodeURIComponent(message)}`, origin)
    )
  }
}
