// app/api/carriers/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createCarrierConnectAccount, createCarrierOnboardingLink } from '@/lib/stripe'
import { notifyCarrierVerified, notifyNewUserRegistered, notifyError } from '@/lib/slack'
import { z } from 'zod'
import { getDevMockState, isMockMode, mockUserIdForRole } from '@/lib/dev-mock'

const CarrierRegisterSchema = z.object({
  company_name:      z.string().min(2),
  mc_number:         z.string().regex(/^\d{6,8}$/, 'MC number must be 6–8 digits'),
  dot_number:        z.string().regex(/^\d{7}$/, 'DOT number must be 7 digits').optional(),
  trailer_types:     z.array(z.enum(['rgn','lowboy','step_deck','flatbed','extendable'])).min(1),
  max_load_tons:     z.number().min(1).max(200),
  base_state:        z.string().length(2),
  service_states:    z.array(z.string().length(2)).min(1),
  insurance_amount:  z.number().min(1_000_000),
  insurance_expires: z.string(), // ISO date
  bio:               z.string().optional(),
})

export async function POST(req: NextRequest) {
  if (isMockMode) {
    const body = CarrierRegisterSchema.safeParse(await req.json())
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 422 })

    const carrierId = mockUserIdForRole('carrier')
    return NextResponse.json({
      ok: true,
      carrierId,
      companyName: body.data.company_name,
      mcNumber: body.data.mc_number,
      stripeOnboardingUrl: 'https://connect.stripe.com/mock/onboard',
      fmcsaStatus: 'active',
      mocked: true,
    })
  }

  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = CarrierRegisterSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 422 })

  // Get or ensure user record
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, company_name')
    .eq('clerk_id', userId)
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // ── Step 1: Verify MC number with FMCSA ──
  let fmcsaStatus: 'active' | 'inactive' | 'revoked' = 'active'
  try {
    const fmcsaRes = await fetch(
      `https://mobile.fmcsa.dot.gov/qc/services/carriers/${body.data.mc_number}?webKey=${process.env.FMCSA_API_KEY}`
    )
    if (fmcsaRes.ok) {
      const fmcsaData = await fmcsaRes.json()
      const status = fmcsaData?.content?.carrier?.allowedToOperate
      if (status === 'N') fmcsaStatus = 'inactive'
    }
  } catch {
    // FMCSA API can be unreliable — log but don't block registration
    console.warn('[FMCSA] Verification failed, proceeding with manual review')
  }

  // ── Step 2: Update user role to carrier ──
  await supabaseAdmin
    .from('users')
    .update({ role: 'carrier', company_name: body.data.company_name })
    .eq('id', user.id)

  // ── Step 3: Create carrier profile ──
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('carrier_profiles')
    .upsert({
      user_id:           user.id,
      company_name:      body.data.company_name,
      mc_number:         body.data.mc_number,
      dot_number:        body.data.dot_number,
      fmcsa_status:      fmcsaStatus,
      trailer_types:     body.data.trailer_types,
      max_load_tons:     body.data.max_load_tons,
      base_state:        body.data.base_state,
      service_states:    body.data.service_states,
      insurance_amount:  body.data.insurance_amount,
      insurance_expires: body.data.insurance_expires,
      bio:               body.data.bio,
      verified_at:       fmcsaStatus === 'active' ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (profileError) {
    await notifyError({ context: 'Carrier registration', error: profileError.message, severity: 'high' })
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // ── Step 4: Create Stripe Connect account ──
  let stripeOnboardingUrl: string | undefined
  try {
    const stripeAccount = await createCarrierConnectAccount({
      email: user.email,
      companyName: body.data.company_name,
      carrierId: user.id,
    })

    await supabaseAdmin
      .from('carrier_profiles')
      .update({ stripe_account_id: stripeAccount.id })
      .eq('user_id', user.id)

    const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL!
    const link = await createCarrierOnboardingLink(stripeAccount.id, origin)
    stripeOnboardingUrl = link.url
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Stripe Connect carrier setup failed'
    await notifyError({ context: 'Stripe Connect carrier setup', error: message, severity: 'medium' })
  }

  // ── Step 5: Slack notifications ──
  await notifyNewUserRegistered({
    name: body.data.company_name,
    email: user.email,
    role: 'carrier',
    company: body.data.company_name,
  })

  if (fmcsaStatus === 'active') {
    await notifyCarrierVerified({
      carrierName: body.data.company_name,
      mcNumber: body.data.mc_number,
      email: user.email,
    })
  }

  return NextResponse.json({
    profile,
    fmcsa_status: fmcsaStatus,
    stripe_onboarding_url: stripeOnboardingUrl,
  }, { status: 201 })
}
