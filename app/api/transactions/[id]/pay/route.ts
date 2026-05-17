// app/api/transactions/[id]/pay/route.ts — Buyer pays for a won auction
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db, getUserByClerkId, getTransactionById } from '@/lib/db'
import * as schema from '@/lib/schema'
import { createAuctionCheckoutSession, toCents } from '@/lib/stripe'
import { notifyError } from '@/lib/slack'
import { isMockMode } from '@/lib/dev-mock'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (isMockMode) {
    return NextResponse.json({ url: '/dashboard/invoices?status=mock', mocked: true })
  }

  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const tx = await getTransactionById(params.id)
  if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  if (tx.buyerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (tx.paymentStatus === 'paid') {
    return NextResponse.json({ error: 'Transaction already paid' }, { status: 409 })
  }
  if (tx.paymentStatus === 'refunded') {
    return NextResponse.json({ error: 'Transaction refunded' }, { status: 409 })
  }

  const listing = tx.auction?.listing
  const equipmentName = listing
    ? `${listing.year} ${listing.make} ${listing.model}`
    : 'Equipment'
  const lotNumber = listing?.lotNumber ?? tx.auctionId.slice(0, 8)
  const origin = req.nextUrl.origin

  try {
    const session = await createAuctionCheckoutSession({
      amountCents: toCents(Number(tx.totalDue)),
      buyerId: user.id,
      auctionId: tx.auctionId,
      transactionId: tx.id,
      lotNumber,
      equipmentName,
      customerEmail: user.email,
      successUrl: `${origin}/dashboard/invoices?status=success&tx=${tx.id}`,
      cancelUrl: `${origin}/dashboard/invoices?status=cancelled`,
    })

    await db
      .update(schema.transactions)
      .set({ stripeCheckoutSession: session.id })
      .where(eq(schema.transactions.id, tx.id))

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to start payment'
    await notifyError({ context: 'Auction payment checkout', error: message, severity: 'high', data: { transactionId: tx.id } })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
