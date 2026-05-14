// lib/stripe.ts — Stripe server helpers
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
  typescript: true,
})

// ── Auction win payment intent ──
export async function createAuctionPaymentIntent(params: {
  amountCents: number
  buyerId: string
  auctionId: string
  lotNumber: string
}) {
  return stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: 'usd',
    metadata: {
      type: 'auction_win',
      auction_id: params.auctionId,
      buyer_id: params.buyerId,
      lot_number: params.lotNumber,
    },
    automatic_payment_methods: { enabled: true },
  })
}

// ── Haul booking payment intent (Stripe Connect transfer) ──
export async function createHaulPaymentIntent(params: {
  amountCents: number
  buyerId: string
  haulJobId: string
  carrierStripeAccountId: string
}) {
  const platformFeePct = Number(process.env.STRIPE_CARRIER_PLATFORM_FEE_PCT ?? 8)
  const applicationFeeAmount = Math.round(params.amountCents * (platformFeePct / 100))

  return stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: 'usd',
    application_fee_amount: applicationFeeAmount,
    transfer_data: { destination: params.carrierStripeAccountId },
    metadata: {
      type: 'haul_booking',
      haul_job_id: params.haulJobId,
      buyer_id: params.buyerId,
    },
  })
}

// ── Release haul escrow to carrier on delivery ──
export async function releaseHaulEscrow(paymentIntentId: string) {
  // Capture previously uncaptured PI
  return stripe.paymentIntents.capture(paymentIntentId)
}

// ── Create Stripe Connect express account for carriers ──
export async function createCarrierConnectAccount(params: {
  email: string
  companyName: string
  carrierId: string
}) {
  return stripe.accounts.create({
    type: 'express',
    email: params.email,
    business_type: 'company',
    company: { name: params.companyName },
    metadata: { carrier_id: params.carrierId },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  })
}

// ── Generate carrier Stripe Connect onboarding link ──
export async function createCarrierOnboardingLink(
  stripeAccountId: string,
  origin: string
) {
  return stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${origin}/carrier/register/stripe-refresh`,
    return_url: `${origin}/carrier/register/stripe-return`,
    type: 'account_onboarding',
  })
}

// ── Get carrier payout balance ──
export async function getCarrierBalance(stripeAccountId: string) {
  return stripe.balance.retrieve({ stripeAccount: stripeAccountId })
}

// ── Verify Stripe webhook signature ──
export function constructWebhookEvent(rawBody: string, sig: string) {
  return stripe.webhooks.constructEvent(
    rawBody,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}

// ── Cents ↔ dollar helpers ──
export const toCents = (dollars: number) => Math.round(dollars * 100)
export const toDollars = (cents: number) => cents / 100
