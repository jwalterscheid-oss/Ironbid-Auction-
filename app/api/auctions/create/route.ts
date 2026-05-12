// app/api/auctions/route.ts (POST — create auction, extends existing GET)
// Append this to the existing GET handler in app/api/auctions/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db, getUserByClerkId, getListingById } from '@/lib/db'
import { redis, AUCTION_KEY } from '@/lib/redis'
import { auctionCloseQueue } from '@/workers/bid-processor'
import * as schema from '@/lib/schema'

const CreateAuctionSchema = z.object({
  listingId:        z.string().uuid(),
  type:             z.enum(['timed','live','buy_now']),
  startTime:        z.string().datetime(),
  endTime:          z.string().datetime(),
  startingBid:      z.number().positive(),
  reservePrice:     z.number().positive().optional(),
  buyNowPrice:      z.number().positive().optional(),
  minIncrement:     z.number().positive().default(500),
  buyersPremiumPct: z.number().min(0).max(50).default(12),
})

export async function POST(req: NextRequest) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = CreateAuctionSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 422 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Verify seller owns this listing
  const listing = await getListingById(body.data.listingId)
  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  if (listing.sellerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [auction] = await db
    .insert(schema.auctions)
    .values({
      ...body.data,
      status:     'active',
      bidCount:   0,
      reserveMet: !body.data.reservePrice,
      watchCount: 0,
      viewCount:  0,
    })
    .returning()

  // Update listing status
  await db.update(schema.listings)
    .set({ status: 'active' })
    .where((schema.listings.id as any).equals(body.data.listingId))

  // Seed Redis auction state
  await redis.hset(AUCTION_KEY(auction.id), {
    current_bid:    body.data.startingBid.toString(),
    bid_count:      '0',
    status:         'active',
    end_time:       new Date(body.data.endTime).getTime().toString(),
    reserve_met:    (!body.data.reservePrice ? '1' : '0'),
  })

  // Schedule auction close job
  const delay = new Date(body.data.endTime).getTime() - Date.now()
  if (delay > 0) {
    await auctionCloseQueue.add(
      'close_auction',
      { auctionId: auction.id },
      { delay, jobId: `close:${auction.id}` }
    )
  }

  return NextResponse.json(auction, { status: 201 })
}
