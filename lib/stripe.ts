// lib/stripe.ts — Stripe server helpers
import Stripe from 'stripe'

// Resolved at import time. We intentionally do NOT throw on a missing/placeholder
// key: this module is imported unconditionally by routes that short-circuit in
// mock/dev mode (DEV_MOCK_MODE) before any real Stripe call is made. Throwing
// here would crash those routes at import time, before the mock check runs.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
  console.warn('STRIPE_SECRET_KEY is missing; Stripe verification/payment calls will fail until it is set.')
} else if (!/^sk_(test|live)_/.test(stripeSecretKey)) {
  console.warn('STRIPE_SECRET_KEY does not look like a real Stripe secret key; verification/payment calls may fail until it is replaced with sk_test_ or sk_live_.')
}

export const stripe = new Stripe(stripeSecretKey ?? '', {
  apiVersion: '2023-10-16',
  typescript: true,
})

// ── Auction win payment (hosted Stripe Checkout) ──
// Collects the buyer's payment for a won auction into the platform balance.
// The seller is paid separately via transferToSeller() once funds settle, so
// the seller does not need a Connect account before the buyer can pay.
export async function createAuctionCheckoutSession(params: {
  amountCents: number
  buyerId: string
  auctionId: string
  transactionId: string
  lotNumber: string
  equipmentName: string
  customerEmail: string
  successUrl: string
  cancelUrl: string
}) {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: params.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: params.amountCents,
          product_data: {
            name: `Lot ${params.lotNumber} — ${params.equipmentName}`,
            description: 'IronBid auction settlement (hammer price + buyer’s premium)',
          },
        },
      },
    ],
    metadata: {
      type: 'auction_win',
      auction_id: params.auctionId,
      buyer_id: params.buyerId,
      transaction_id: params.transactionId,
      lot_number: params.lotNumber,
    },
    payment_intent_data: {
      metadata: {
        type: 'auction_win',
        auction_id: params.auctionId,
        transaction_id: params.transactionId,
      },
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  })
}

// ── Seller payout (Stripe transfer to the seller's Connect account) ──
export async function transferToSeller(params: {
  amountCents: number
  sellerStripeAccountId: string
  transactionId: string
  auctionId: string
}) {
  return stripe.transfers.create({
    amount: params.amountCents,
    currency: 'usd',
    destination: params.sellerStripeAccountId,
    metadata: {
      type: 'seller_payout',
      transaction_id: params.transactionId,
      auction_id: params.auctionId,
    },
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

// ── Create Stripe Connect express account for sellers ──
export async function createSellerConnectAccount(params: {
  email: string
  sellerId: string
  companyName?: string
}) {
  return stripe.accounts.create({
    type: 'express',
    email: params.email,
    metadata: { seller_id: params.sellerId },
    business_profile: params.companyName ? { name: params.companyName } : undefined,
    capabilities: { transfers: { requested: true } },
  })
}

// ── Generate seller Stripe Connect onboarding link ──
export async function createSellerOnboardingLink(
  stripeAccountId: string,
  origin: string
) {
  return stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${origin}/dashboard/payouts?stripe=refresh`,
    return_url: `${origin}/dashboard/payouts?stripe=return`,
    type: 'account_onboarding',
  })
}

// ── Identity verification (KYC) ──
// Creates a hosted Stripe Identity verification session. The returned
// session.url is the hosted flow the user is redirected to; on completion
// Stripe fires `identity.verification_session.verified`, handled in the
// Stripe webhook to flip the user's kyc_status to 'verified'.
export async function createIdentityVerificationSession(params: {
  userId: string
  email: string
  returnUrl: string
}) {
  return stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: {
      type: 'identity_kyc',
      user_id: params.userId,
    },
    options: {
      document: { require_matching_selfie: true },
    },
    provided_details: { email: params.email },
    return_url: params.returnUrl,
  })
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
