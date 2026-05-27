import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { db, getUserByClerkId } from '@/lib/db'
import * as schema from '@/lib/schema'
import { getDevMockState, isMockMode } from '@/lib/dev-mock'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (isMockMode) {
    const state = getDevMockState()
    const job = state.haulJobs.find((j) => j.id === params.id)
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      ...job,
      listing: state.listings.find((listing) => listing.id === job.listingId),
      haulBids: state.haulBids.filter((bid) => bid.haulJobId === job.id),
      tracking: [],
      mocked: true,
    })
  }

  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const job = await db.query.haulJobs.findFirst({
    where: eq(schema.haulJobs.id, params.id),
    with: {
      listing: true,
      haulBids: {
        with: {
          carrier: true,
        },
      },
      tracking: true,
    },
  })

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isBuyer = job.buyerId === user.id
  const isAwardedCarrier = job.awardedCarrierId === user.id
  const isBiddingCarrier =
    user.role === 'carrier' && !user.disabledAt && job.status === 'bidding'

  if (!isBuyer && !isAwardedCarrier && !isBiddingCarrier) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Carriers shopping for a bid see job details but not competitors' bids
  // or tracking history. Only the buyer and the awarded carrier get the full view.
  if (isBiddingCarrier && !isAwardedCarrier) {
    const ownBid = job.haulBids.find((b) => b.carrierId === user.id) ?? null
    return NextResponse.json({
      ...job,
      haulBids: ownBid ? [ownBid] : [],
      tracking: [],
    })
  }

  return NextResponse.json(job)
}
