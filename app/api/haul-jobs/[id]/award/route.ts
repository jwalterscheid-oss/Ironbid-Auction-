// app/api/haul-jobs/[id]/award/route.ts — Buyer accepts a haul bid
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db, getUserByClerkId } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'
import { stripe, toCents } from '@/lib/stripe'
import { publishToChannel } from '@/lib/ably'
import { notifyHaulAwarded } from '@/lib/slack'
import { eq, and } from 'drizzle-orm'
import * as schema from '@/lib/schema'
import { getDevMockState, isMockMode, mockUserIdForRole } from '@/lib/dev-mock'

const AwardSchema = z.object({ bidId: z.string().uuid() })

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (isMockMode) {
    const body = AwardSchema.safeParse(await req.json())
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 422 })

    const state = getDevMockState()
    const buyerId = mockUserIdForRole('buyer')
    const job = state.haulJobs.find((j) => j.id === params.id && j.buyerId === buyerId)
    if (!job) return NextResponse.json({ error: 'Job not found or not eligible' }, { status: 404 })

    const bid = state.haulBids.find((b) => b.id === body.data.bidId && b.haulJobId === params.id && b.status === 'active')
    if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 })

    for (const hb of state.haulBids) {
      if (hb.haulJobId === params.id && hb.status === 'active') hb.status = 'expired'
    }

    bid.status = 'accepted'
    job.status = 'awarded'
    job.awardedBidId = bid.id
    job.awardedCarrierId = bid.carrierId

    return NextResponse.json({
      ...job,
      haulBids: state.haulBids.filter((hb) => hb.haulJobId === job.id),
      mocked: true,
    })
  }

  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = AwardSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 422 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Verify job ownership
  const job = await db.query.haulJobs.findFirst({
    where: and(
      eq(schema.haulJobs.id, params.id),
      eq(schema.haulJobs.buyerId, user.id),
      eq(schema.haulJobs.status, 'bidding'),
    ),
    with: { listing: true },
  })
  if (!job) return NextResponse.json({ error: 'Job not found or not eligible' }, { status: 404 })

  // Get the winning bid
  const bid = await db.query.haulBids.findFirst({
    where: and(
      eq(schema.haulBids.id, body.data.bidId),
      eq(schema.haulBids.haulJobId, params.id),
      eq(schema.haulBids.status, 'active'),
    ),
    with: { carrier: { with: { carrierProfile: true } } },
  })
  if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 })

  // Check carrier has Stripe Connect account
  const carrierProfile = await db.query.carrierProfiles.findFirst({
    where: eq(schema.carrierProfiles.userId, bid.carrierId),
  })
  if (!carrierProfile?.stripeAccountId || !carrierProfile.stripeOnboarded) {
    return NextResponse.json({ error: 'Carrier payment account not set up' }, { status: 422 })
  }

  // Create Stripe payment intent (holds funds in escrow)
  const pi = await stripe.paymentIntents.create({
    amount:                 toCents(Number(bid.amount)),
    currency:               'usd',
    application_fee_amount: toCents(Number(bid.amount) * 0.08),
    transfer_data:          { destination: carrierProfile.stripeAccountId },
    capture_method:         'manual', // hold, capture on delivery
    metadata: {
      type:        'haul_booking',
      haul_job_id: params.id,
      haul_bid_id: bid.id,
      buyer_id:    user.id,
      carrier_id:  bid.carrierId,
    },
  })

  // Update DB atomically. If this fails, void the payment authorization so we
  // never leave funds held on the buyer with no awarded job.
  const { error: awardError } = await supabaseAdmin.rpc('award_haul_job', {
    p_job_id:             params.id,
    p_bid_id:             bid.id,
    p_carrier_id:         bid.carrierId,
    p_payment_intent_id:  pi.id,
  })
  if (awardError) {
    await stripe.paymentIntents.cancel(pi.id).catch(() => {})
    return NextResponse.json({ error: 'Failed to award job — payment voided' }, { status: 500 })
  }

  // Notify carrier via Ably
  await publishToChannel(`carrier:${bid.carrierId}:jobs`, 'haul_job_awarded', {
    jobId:          params.id,
    lotNumber:      job.listing?.lotNumber,
    pickupAddress:  job.pickupAddress,
    deliveryAddress: job.deliveryAddress,
    amount:         Number(bid.amount),
  })

  // Slack
  await notifyHaulAwarded({
    jobId:       params.id,
    lotNumber:   job.listing?.lotNumber ?? params.id.slice(0, 8),
    carrierName: carrierProfile.companyName,
    amount:      Number(bid.amount),
    etaDays:     bid.estimatedDeliveryDate
      ? Math.ceil((new Date(bid.estimatedDeliveryDate).getTime() - Date.now()) / 86400000)
      : 0,
  }).catch(() => {})

  const updated = await db.query.haulJobs.findFirst({
    where: eq(schema.haulJobs.id, params.id),
    with: { haulBids: true, listing: true },
  })

  return NextResponse.json(updated)
}
