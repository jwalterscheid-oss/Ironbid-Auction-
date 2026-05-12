// app/api/haul-jobs/[id]/confirm-delivery/route.ts — Release escrow to carrier
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, getUserByClerkId } from '@/lib/db'
import { stripe, toDollars } from '@/lib/stripe'
import { publishToChannel } from '@/lib/ably'
import { notifyHaulDelivered } from '@/lib/slack'
import { eq, and } from 'drizzle-orm'
import * as schema from '@/lib/schema'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

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
  if (!['in_transit', 'picked_up'].includes(job.status)) {
    return NextResponse.json({ error: 'Cannot confirm delivery at this stage' }, { status: 422 })
  }
  if (!job.stripePaymentIntent) {
    return NextResponse.json({ error: 'No payment intent found' }, { status: 500 })
  }

  // Capture the held payment (releases to carrier)
  const pi = await stripe.paymentIntents.capture(job.stripePaymentIntent)

  // Update job status
  await (await import('drizzle-orm')).db?.update(schema.haulJobs)
    .set({ status: 'delivered' })
    .where(eq(schema.haulJobs.id, params.id))

  // Log tracking event
  await (await import('drizzle-orm')).db?.insert(schema.haulTracking).values({
    haulJobId:  params.id,
    eventType:  'delivered',
    notes:      'Confirmed by buyer',
    recordedAt: new Date(),
  })

  const payoutAmount = toDollars(pi.amount) * 0.92 // after 8% platform fee
  const carrierProfile = (job.awardedCarrier as any)?.carrierProfile

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
