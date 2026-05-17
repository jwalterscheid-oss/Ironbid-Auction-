// app/api/webhooks/stripe/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import * as schema from '@/lib/schema'
import { constructWebhookEvent } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { settleSellerPayout, retrySellerPayouts } from '@/lib/payouts'
import { notifyPaymentReceived, notifyHaulDelivered, notifyError } from '@/lib/slack'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event
  try {
    event = constructWebhookEvent(rawBody, sig)
  } catch (err: unknown) {
    console.error('[Stripe Webhook] Invalid signature:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {

      // ── Auction settlement paid (hosted Checkout completed) ──
      case 'checkout.session.completed': {
        const session = event.data.object as any
        if (session.metadata?.type === 'auction_win' && session.payment_status === 'paid') {
          const transactionId = session.metadata.transaction_id as string

          const [tx] = await db
            .update(schema.transactions)
            .set({
              paymentStatus: 'paid',
              stripeCheckoutSession: session.id,
              stripePaymentIntent:
                typeof session.payment_intent === 'string' ? session.payment_intent : null,
              paymentMethod: 'stripe',
              paidAt: new Date(),
            })
            .where(eq(schema.transactions.id, transactionId))
            .returning()

          if (tx) {
            // Pay the seller (no-op if they have not finished Connect onboarding).
            const payout = await settleSellerPayout(tx.id)
            if (payout.status === 'seller_not_onboarded') {
              await notifyError({
                context: 'Seller payout deferred',
                error: 'Seller has not completed Stripe Connect onboarding; payout will retry on onboarding.',
                severity: 'medium',
                data: { transactionId: tx.id },
              }).catch(() => {})
            }

            await notifyPaymentReceived({
              lotNumber: session.metadata.lot_number ?? tx.auctionId.slice(0, 8),
              buyerName: session.customer_email ?? session.metadata.buyer_id ?? 'Buyer',
              amount: (session.amount_total ?? 0) / 100,
              method: 'Stripe Checkout',
            }).catch(() => {})
          }
        }
        break
      }

      // ── Haul booking payment authorized (manual-capture hold) ──
      case 'payment_intent.succeeded': {
        const pi = event.data.object as any
        if (pi.metadata?.type === 'haul_booking') {
          await supabaseAdmin
            .from('haul_jobs')
            .update({ status: 'awarded', stripe_payment_intent: pi.id })
            .eq('id', pi.metadata.haul_job_id)
        }
        break
      }

      // ── Stripe Connect: carrier or seller finished onboarding ──
      case 'account.updated': {
        const account = event.data.object as any
        if (account.details_submitted && account.charges_enabled) {
          await supabaseAdmin
            .from('carrier_profiles')
            .update({ stripe_onboarded: true })
            .eq('stripe_account_id', account.id)
        }
        if (account.details_submitted && account.payouts_enabled) {
          const [seller] = await db
            .update(schema.users)
            .set({ stripeConnectOnboarded: true, updatedAt: new Date() })
            .where(eq(schema.users.stripeConnectAccountId, account.id))
            .returning()
          if (seller) await retrySellerPayouts(seller.id)
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
          }).catch(() => {})
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

      // ── Identity verification needs another attempt → leave 'pending' ──
      case 'identity.verification_session.requires_input': {
        break
      }

      default:
        break
    }
  } catch (err: unknown) {
    await notifyError({
      context: `Stripe webhook: ${event.type}`,
      error: err instanceof Error ? err.message : 'Handler error',
      severity: 'high',
      data: { eventId: event.id },
    }).catch(() => {})
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
