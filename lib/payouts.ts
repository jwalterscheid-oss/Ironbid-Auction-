// lib/payouts.ts — Seller payout settlement (Stripe Connect transfers)
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import * as schema from '@/lib/schema'
import { transferToSeller, toCents } from '@/lib/stripe'
import { notifyError } from '@/lib/slack'

// Transfers a paid transaction's seller proceeds to the seller's Connect
// account. Idempotent: no-ops if already paid out, not yet paid, or the
// seller has not finished Connect onboarding.
export async function settleSellerPayout(
  transactionId: string
): Promise<{ status: string; transferId?: string }> {
  const tx = await db.query.transactions.findFirst({
    where: eq(schema.transactions.id, transactionId),
    with: { seller: true },
  })

  if (!tx) return { status: 'transaction_not_found' }
  if (tx.paymentStatus !== 'paid') return { status: 'not_paid' }
  if (tx.sellerPayoutId) return { status: 'already_paid_out', transferId: tx.sellerPayoutId }
  if (!tx.sellerProceeds || Number(tx.sellerProceeds) <= 0) return { status: 'no_proceeds' }

  const seller = tx.seller
  if (!seller?.stripeConnectAccountId || !seller.stripeConnectOnboarded) {
    // Seller must finish Connect onboarding; retried on account.updated.
    return { status: 'seller_not_onboarded' }
  }

  const transfer = await transferToSeller({
    amountCents: toCents(Number(tx.sellerProceeds)),
    sellerStripeAccountId: seller.stripeConnectAccountId,
    transactionId: tx.id,
    auctionId: tx.auctionId,
  })

  await db
    .update(schema.transactions)
    .set({ sellerPayoutId: transfer.id, sellerPaidAt: new Date() })
    .where(eq(schema.transactions.id, tx.id))

  return { status: 'paid_out', transferId: transfer.id }
}

// Settles every paid-but-unpaid-out transaction for a seller. Called once the
// seller finishes Connect onboarding (Stripe account.updated webhook).
export async function retrySellerPayouts(sellerUserId: string): Promise<number> {
  const pending = await db
    .select({ id: schema.transactions.id })
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.sellerId, sellerUserId),
      eq(schema.transactions.paymentStatus, 'paid'),
      isNull(schema.transactions.sellerPayoutId),
    ))

  let settled = 0
  for (const t of pending) {
    try {
      const r = await settleSellerPayout(t.id)
      if (r.status === 'paid_out') settled++
    } catch (err) {
      await notifyError({
        context: 'Seller payout retry',
        error: err instanceof Error ? err.message : 'failed',
        severity: 'high',
        data: { transactionId: t.id },
      }).catch(() => {})
    }
  }
  return settled
}
