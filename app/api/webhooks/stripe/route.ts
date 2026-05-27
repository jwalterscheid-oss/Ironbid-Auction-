// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import * as schema from '@/lib/schema'
import { constructWebhookEvent } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { settleSellerPayout, retrySellerPayouts } from '@/lib/payouts'
import { notifyPaymentReceived, notifyHaulDelivered, notifyError } from '@/lib/slack'

export const runtime = 'nodejs'

type CheckoutMetadata = {
  type?: string
  transaction_id?: string
  lot_number?: string
  buyer_id?: string
}

type TransferMetadata = {
  haul_job_id?: string
  lot_number?: string
  carrier_name?: string
}

type IdentityMetadata = {
  user_id?: string
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = constructWebhookEvent(rawBody, sig)
  } catch (err: unknown) {
    console.error('[Stripe Webhook] Invalid signature:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency: claim this event.id before doing any side-effectful work. Stripe
  // retries on 5xx and may also redeliver events out of order; without this guard
  // `transfer.created` would re-flip haul state, Slack would double-fire, etc.
  const claimed = await db
    .insert(schema.stripeWebhookEvents)
    .values({ eventId: event.id, type: event.type })
    .onConflictDoNothing({ target: schema.stripeWebhookEvents.eventId })
    .returning({ eventId: schema.stripeWebhookEvents.eventId })

  if (claimed.length === 0) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {

      // ── Auction settlement paid (hosted Checkout completed) ──
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const meta = (session.metadata ?? {}) as CheckoutMetadata
        if (meta.type === 'auction_win' && session.payment_status === 'paid' && meta.transaction_id) {
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
            .where(eq(schema.transactions.id, meta.transaction_id))
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
              lotNumber: meta.lot_number ?? tx.auctionId.slice(0, 8),
              buyerName: session.customer_email ?? meta.buyer_id ?? 'Buyer',
              amount: (session.amount_total ?? 0) / 100,
              method: 'Stripe Checkout',
            }).catch(() => {})
          }
        }
        break
      }

      // Note: haul-booking PaymentIntents use manual capture, so
      // payment_intent.succeeded fires at delivery-capture time, not at award.
      // The award route sets haul_jobs.status via the award_haul_job RPC, and
      // confirm-delivery sets it to 'delivered' — handling the event here would
      // regress 'delivered' back to 'awarded', so it is intentionally omitted.

      // ── Stripe Connect: carrier or seller finished onboarding ──
      case 'account.updated': {
        const account = event.data.object as Stripe.Account
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
        } else {
          // Payouts disabled (onboarding incomplete or account restricted) —
          // clear the flag so settleSellerPayout won't transfer to it.
          await db
            .update(schema.users)
            .set({ stripeConnectOnboarded: false, updatedAt: new Date() })
            .where(eq(schema.users.stripeConnectAccountId, account.id))
        }
        break
      }

      // ── Transfer to carrier succeeded (delivery payout) ──
      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer
        const meta = (transfer.metadata ?? {}) as TransferMetadata
        if (meta.haul_job_id) {
          await supabaseAdmin
            .from('haul_jobs')
            .update({ status: 'delivered' })
            .eq('id', meta.haul_job_id)

          await notifyHaulDelivered({
            jobId: meta.haul_job_id,
            lotNumber: meta.lot_number ?? '—',
            carrierName: meta.carrier_name ?? '—',
            payoutAmount: transfer.amount / 100,
          }).catch(() => {})
        }
        break
      }

      // ── Identity verification passed → mark user KYC verified ──
      case 'identity.verification_session.verified': {
        const session = event.data.object as Stripe.Identity.VerificationSession
        const meta = (session.metadata ?? {}) as IdentityMetadata
        if (meta.user_id) {
          await supabaseAdmin
            .from('users')
            .update({ kyc_status: 'verified', updated_at: new Date().toISOString() })
            .eq('id', meta.user_id)
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
    // Release the dedupe row so Stripe's retry can reprocess this event.
    await db
      .delete(schema.stripeWebhookEvents)
      .where(eq(schema.stripeWebhookEvents.eventId, event.id))
      .catch(() => {})

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
