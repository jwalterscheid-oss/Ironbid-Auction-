// app/api/bids/route.ts — Place bid endpoint
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { redis, AUCTION_KEY } from '@/lib/redis'
import { getUserByClerkId } from '@/lib/db'
import { bidQueue, queueEvents } from '@/workers/bid-processor'
import { getMinIncrement } from '@/lib/auction/bid-processor'

const PlaceBidSchema = z.object({
  auctionId: z.string().uuid(),
  amount:    z.number().positive().int(),
  maxBid:    z.number().positive().int().optional(),
})

export async function POST(req: NextRequest) {
  // ── Auth ──
  const { userId: clerkId } = auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse + validate input ──
  const body = PlaceBidSchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 422 })
  }

  const { auctionId, amount, maxBid } = body.data

  // ── Get user ──
  const user = await getUserByClerkId(clerkId)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (user.kycStatus !== 'verified') {
    return NextResponse.json(
      { error: 'identity_verification_required', message: 'Complete KYC before bidding' },
      { status: 403 }
    )
  }

  // ── Fast pre-check from Redis (cheap, no DB hit) ──
  const state = await redis.hgetall(AUCTION_KEY(auctionId))

  if (state.status && state.status !== 'active') {
    return NextResponse.json({ error: 'auction_not_active' }, { status: 422 })
  }

  const currentBid  = Number(state.current_bid ?? 0)
  const minRequired = currentBid + getMinIncrement(currentBid)

  if (amount < minRequired) {
    return NextResponse.json(
      { error: 'bid_too_low', minRequired, currentBid },
      { status: 422 }
    )
  }

  // ── Enqueue bid job (serialized per auction) ──
  const job = await bidQueue.add(
    'process_bid',
    {
      auctionId,
      userId:    user.id,
      amount,
      maxBid,
      ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown',
    },
    {
      jobId:   `bid:${auctionId}:${user.id}:${Date.now()}`,
      timeout: 5000,
    }
  )

  try {
    // Wait for the job to finish (max 5s)
    const result = await job.waitUntilFinished(queueEvents, 5000)
    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    // Job timed out or failed — surface the error
    const failedJob = await bidQueue.getJob(job.id!)
    const reason    = failedJob?.failedReason ?? err.message ?? 'bid_failed'

    return NextResponse.json(
      { error: reason },
      { status: reason.includes('too_low') || reason.includes('not_active') ? 422 : 500 }
    )
  }
}
