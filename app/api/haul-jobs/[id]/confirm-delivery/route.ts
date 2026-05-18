// app/api/haul-jobs/[id]/confirm-delivery/route.ts — Release escrow to carrier
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, getUserByClerkId } from '@/lib/db'
import { stripe, toDollars } from '@/lib/stripe'
import { publishToChannel } from '@/lib/ably'
import { notifyHaulDelivered, notifyError } from '@/lib/slack'
import { eq, and, sql, inArray } from 'drizzle-orm'
import * as schema from '@/lib/schema'
import { getDevMockState, isMockMode, mockUserIdForRole } from '@/lib/dev-mock'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (isMockMode) {
    const state = getDevMockState()
    const buyerId = mockUserIdForRole('buyer')
    const job = state.haulJobs.find((j) => j.id === params.id && j.buyerId === buyerId)
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (!['in_transit', 'picked_up'].includes(job.status)) {
      return NextResponse.json({ error: 'Cannot confirm delivery at this stage' }, { status: 422 })
    }

    job.status = 'delivered'
    return NextResponse.json({ success: true, payoutAmount: 1200, mocked: true })
  }

  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.disabledAt) return NextResponse.json({ error: 'Account disabled' }, { status: 403 })

  const job = await db.query.haulJobs.findFirst({
    where: and(
      eq(schema.haulJobs.id, params.id),
      eq(schema.haulJobs.buyerId, user.id),
    ),
    with: {
      listing: true,
      awardedCarrier: { with: { carrierProfile: true } },
    },
  })

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!job.stripePaymentIntent) {
    return NextResponse.json({ error: 'No payment intent found' }, { status: 500 })
  }

  // Atomically claim the job: only one request can move it out of an
  // in-transit/picked-up state. This prevents a duplicate or concurrent
  // confirmation from capturing the escrowed payment twice.
  const [claimed] = await db.update(schema.haulJobs)
    .set({ status: 'delivered' })
    .where(and(
      eq(schema.haulJobs.id, params.id),
      inArray(schema.haulJobs.status, ['in_transit', 'picked_up']),
    ))
    .returning({ id: schema.haulJobs.id })

  if (!claimed) {
    return NextResponse.json({ error: 'Cannot confirm delivery at this stage' }, { status: 422 })
  }

  // Release the escrowed payment to the carrier.
  let pi
  try {
    pi = await stripe.paymentIntents.capture(job.stripePaymentIntent)
  } catch (err: unknown) {
    // Capture failed — roll the status back so the buyer can retry.
    await db.update(schema.haulJobs)
      .set({ status: job.status })
      .where(eq(schema.haulJobs.id, params.id))
    const message = err instanceof Error ? err.message : 'Payment capture failed'
    await notifyError({
      context: 'Haul delivery capture', error: message, severity: 'critical',
      data: { jobId: params.id },
    }).catch(() => {})
    return NextResponse.json({ error: 'Payment capture failed' }, { status: 502 })
  }

  // Payment is released and the job is 'delivered'. The remaining writes are
  // best-effort — a failure here must not revert the delivery or re-capture.
  try {
    // Close the sale: the equipment is delivered.
    await db.update(schema.transactions)
      .set({ closedAt: new Date(), titleStatus: 'transferred' })
      .where(eq(schema.transactions.id, job.transactionId))

    // Credit the carrier's completed-haul count for their reputation.
    if (job.awardedCarrierId) {
      await db.update(schema.carrierProfiles)
        .set({ completedHauls: sql`coalesce(${schema.carrierProfiles.completedHauls}, 0) + 1` })
        .where(eq(schema.carrierProfiles.userId, job.awardedCarrierId))
    }

    // Log tracking event
    await db.insert(schema.haulTracking).values({
      haulJobId:  params.id,
      eventType:  'delivered',
      notes:      'Confirmed by buyer',
      recordedAt: new Date(),
    })
  } catch (err: unknown) {
    await notifyError({
      context: 'Haul delivery post-capture writes',
      error: err instanceof Error ? err.message : 'failed',
      severity: 'high',
      data: { jobId: params.id },
    }).catch(() => {})
  }

  const payoutAmount = toDollars(pi.amount) * 0.92 // after 8% platform fee
  const carrierProfile = job.awardedCarrier?.carrierProfile

  // Notify carrier
  if (job.awardedCarrierId) {
    await publishToChannel(`carrier:${job.awardedCarrierId}:jobs`, 'haul_delivered', {
      jobId:         params.id,
      payoutAmount,
      deliveredAt:   new Date().toISOString(),
    })
  }

  await notifyHaulDelivered({
    jobId:         params.id,
    lotNumber:     job.listing?.lotNumber ?? params.id.slice(0, 8),
    carrierName:   carrierProfile?.companyName ?? 'Unknown Carrier',
    payoutAmount,
  }).catch(() => {})

  return NextResponse.json({ success: true, payoutAmount })
}
