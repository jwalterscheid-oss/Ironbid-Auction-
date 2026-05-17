// app/api/webhooks/stripe/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyPaymentReceived, notifyHaulDelivered, notifyError } from '@/lib/slack'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event
  try {
    event = constructWebhookEvent(rawBody, sig)
  } catch (err: unknown) {
    console.error('[Stripe Webhook] Invalid signature:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {

      // ── Auction payment succeeded ──
      case 'payment_intent.succeeded': {
        const pi = event.data.object as any
        if (pi.metadata?.type === 'auction_win') {
          await supabaseAdmin
            .from('transactions')
            .update({
              payment_status: 'paid',
              stripe_payment_intent: pi.id,
              paid_at: new Date().toISOString(),
            })
            .eq('auction_id', pi.metadata.auction_id)

          await supabaseAdmin
            .from('auctions')
            .update({ status: 'closed' })
            .eq('id', pi.metadata.auction_id)

          await notifyPaymentReceived({
            lotNumber: pi.metadata.lot_number,
            buyerName: pi.metadata.buyer_id,
            amount: pi.amount / 100,
            method: 'Stripe',
          })
        }

        // ── Haul booking payment ──
        if (pi.metadata?.type === 'haul_booking') {
          await supabaseAdmin
            .from('haul_jobs')
            .update({
              status: 'awarded',
              stripe_payment_intent: pi.id,
            })
            .eq('id', pi.metadata.haul_job_id)
        }
        break
      }

      // ── Stripe Connect: carrier finished onboarding ──
      case 'account.updated': {
        const account = event.data.object as any
        if (account.details_submitted && account.charges_enabled) {
          await supabaseAdmin
            .from('carrier_profiles')
            .update({ stripe_onboarded: true })
            .eq('stripe_account_id', account.id)
        }
        break
      }

      // ── Transfer to carrier succeeded (delivery payout) ──
      case 'transfer.created': {
        const transfer = event.data.object as any
        if (transfer.metadata?.haul_job_id) {
          await supabaseAdmin
            .from('haul_jobs')
            .update({ status: 'delivered' })
            .eq('id', transfer.metadata.haul_job_id)

          await notifyHaulDelivered({
            jobId: transfer.metadata.haul_job_id,
            lotNumber: transfer.metadata.lot_number ?? '—',
            carrierName: transfer.metadata.carrier_name ?? '—',
            payoutAmount: transfer.amount / 100,
          })
        }
        break
      }

      // ── Identity verification passed → mark user KYC verified ──
      case 'identity.verification_session.verified': {
        const session = event.data.object as any
        const userId = session.metadata?.user_id
        if (userId) {
          await supabaseAdmin
            .from('users')
            .update({ kyc_status: 'verified', updated_at: new Date().toISOString() })
            .eq('id', userId)
        }
        break
      }

      // ── Identity verification needs another attempt ──
      case 'identity.verification_session.requires_input': {
        // The document/selfie could not be verified (e.g. unreadable image).
        // Leave kyc_status as 'pending' so the user can retry from /dashboard/verify.
        break
      }

      default:
        // Unhandled event — no-op
        break
    }
  } catch (err: unknown) {
    await notifyError({
      context: `Stripe webhook: ${event.type}`,
      error: err instanceof Error ? err.message : 'Handler error',
      severity: 'high',
      data: { eventId: event.id },
    })
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
