// app/api/haul-bids/route.ts — Carrier submits a haul bid
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db, getUserByClerkId } from '@/lib/db'
import { publishToChannel } from '@/lib/ably'
import { eq, and, gt } from 'drizzle-orm'
import * as schema from '@/lib/schema'

const HaulBidSchema = z.object({
  haulJobId:             z.string().uuid(),
  amount:                z.number().positive(),
  includesPermits:       z.boolean().default(false),
  includesPilotCar:      z.boolean().default(false),
  trailerType:           z.enum(['rgn','lowboy','step_deck','flatbed','extendable','any']).optional(),
  estimatedPickupDate:   z.string().optional(),
  estimatedDeliveryDate: z.string().optional(),
  carrierNotes:          z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = HaulBidSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 422 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.role !== 'carrier') return NextResponse.json({ error: 'Carrier account required' }, { status: 403 })

  // Check carrier is verified
  const profile = await db.query.carrierProfiles.findFirst({
    where: eq(schema.carrierProfiles.userId, user.id),
  })
  if (!profile) return NextResponse.json({ error: 'Carrier profile not found' }, { status: 404 })
  if (!profile.verifiedAt) return NextResponse.json({ error: 'Carrier not yet verified' }, { status: 403 })

  // Check job is open for bidding and not expired
  const job = await db.query.haulJobs.findFirst({
    where: and(
      eq(schema.haulJobs.id, body.data.haulJobId),
      eq(schema.haulJobs.status, 'bidding'),
      gt(schema.haulJobs.bidCloseTime, new Date()),
    ),
    with: { listing: true },
  })
  if (!job) return NextResponse.json({ error: 'Job not found, closed, or expired' }, { status: 404 })

  // Check carrier doesn't already have active bid on this job
  const existing = await db.query.haulBids.findFirst({
    where: and(
      eq(schema.haulBids.haulJobId, body.data.haulJobId),
      eq(schema.haulBids.carrierId, user.id),
      eq(schema.haulBids.status, 'active'),
    ),
  })
  if (existing) {
    // Update existing bid amount
    const [updated] = await db
      .update(schema.haulBids)
      .set({ amount: body.data.amount.toString(), ...body.data })
      .where(eq(schema.haulBids.id, existing.id))
      .returning()
    return NextResponse.json(updated)
  }

  const [bid] = await db
    .insert(schema.haulBids)
    .values({
      ...body.data,
      carrierId:  user.id,
      status:     'active',
      placedAt:   new Date(),
    })
    .returning()

  // Notify buyer in real-time
  await publishToChannel(`haul:${body.data.haulJobId}`, 'haul_bid_received', {
    bidId:                bid.id,
    amount:               body.data.amount,
    carrierName:          profile.companyName,
    carrierRating:        profile.avgRating,
    completedHauls:       profile.completedHauls,
    trailerType:          body.data.trailerType,
    estimatedDeliveryDate: body.data.estimatedDeliveryDate,
    includesPermits:      body.data.includesPermits,
  })

  return NextResponse.json(bid, { status: 201 })
}
