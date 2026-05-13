// app/api/auctions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuctionById, getBidsByAuction } from '@/lib/db'
import { redis, AUCTION_KEY } from '@/lib/redis'
import { getDevMockState, isMockMode } from '@/lib/dev-mock'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (isMockMode) {
    const state = getDevMockState()
    const auction = state.auctions.find((a) => a.id === params.id)
    if (!auction) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const listing = state.listings.find((l) => l.id === auction.listingId)
    const recentBids = state.bids
      .filter((b) => b.auctionId === params.id)
      .slice(0, 20)
      .map((b) => ({
        id: b.id,
        amount: b.amount,
        bidderMasked: b.bidderId.slice(0, 2).toUpperCase() + '***',
        placedAt: b.placedAt,
        isWinning: b.isWinning,
      }))

    return NextResponse.json({
      ...auction,
      listing,
      endTime: auction.endTime,
      recentBids,
      mocked: true,
    })
  }

  const auction = await getAuctionById(params.id)
  if (!auction) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Merge Redis live state (may be fresher than DB)
  const liveState = await redis.hgetall(AUCTION_KEY(params.id))

  const recentBids = await getBidsByAuction(params.id, 20)

  return NextResponse.json({
    ...auction,
    // Override with live Redis values if present
    currentBid:  liveState.current_bid ? Number(liveState.current_bid) : auction.currentBid,
    bidCount:    liveState.bid_count   ? Number(liveState.bid_count)   : auction.bidCount,
    watchCount:  liveState.watch_count ? Number(liveState.watch_count) : auction.watchCount,
    endTime:     liveState.end_time
      ? new Date(Number(liveState.end_time)).toISOString()
      : auction.endTime,
    recentBids: recentBids.map(r => ({
      id:           r.bid.id,
      amount:       r.bid.amount,
      bidderMasked: r.bid.bidderId.slice(0, 2).toUpperCase() + '***',
      placedAt:     r.bid.placedAt,
      isWinning:    r.bid.isWinning,
    })),
  })
}
