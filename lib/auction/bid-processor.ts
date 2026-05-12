// lib/auction/bid-processor.ts — Core bid processing logic
import { db } from '@/lib/db'
import { redis, AUCTION_KEY, AUTOBID_KEY } from '@/lib/redis'
import { publishToChannel } from '@/lib/ably'
import { notifyNewBid, notifyAuctionClosed, notifyError } from '@/lib/slack'
import { supabaseAdmin } from '@/lib/supabase'
import { eq, and } from 'drizzle-orm'
import * as schema from '@/lib/schema'
import type { PlaceBidInput, PlaceBidResult } from '@/types'

const EXTENSION_MINUTES = 3
const MIN_INCREMENTS: [number, number][] = [
  [500_000,  5_000],
  [200_000,  2_500],
  [50_000,   1_000],
  [0,          500],
]

export function getMinIncrement(currentBid: number): number {
  for (const [threshold, increment] of MIN_INCREMENTS) {
    if (currentBid >= threshold) return increment
  }
  return 500
}

// ─── VALIDATE BID ─────────────────────────────────────────────────────────────

export async function validateBid(params: {
  auctionId: string
  userId: string
  amount: number
}): Promise<{ valid: true } | { valid: false; error: string }> {
  const { auctionId, userId, amount } = params

  // Fast check against Redis cache
  const state = await redis.hgetall(AUCTION_KEY(auctionId))

  if (state.status && state.status !== 'active') {
    return { valid: false, error: 'auction_not_active' }
  }

  const currentBid = Number(state.current_bid ?? 0)
  const minIncrement = getMinIncrement(currentBid)

  if (amount < currentBid + minIncrement) {
    return {
      valid: false,
      error: `bid_too_low — minimum bid is $${(currentBid + minIncrement).toLocaleString()}`,
    }
  }

  // Check user bid limit
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  })

  if (!user) return { valid: false, error: 'user_not_found' }
  if (user.kycStatus !== 'verified') return { valid: false, error: 'kyc_required' }
  if (user.bidLimit && amount > Number(user.bidLimit)) {
    return { valid: false, error: 'bid_exceeds_credit_limit' }
  }

  return { valid: true }
}

// ─── PROCESS BID (called inside serialized BullMQ job) ───────────────────────

export async function processBid(params: {
  auctionId: string
  userId: string
  amount: number
  maxBid?: number
  ipAddress?: string
}): Promise<PlaceBidResult> {
  const { auctionId, userId, amount, maxBid, ipAddress } = params

  // Use Supabase for the serializable transaction
  const { data, error } = await supabaseAdmin.rpc('place_bid', {
    p_auction_id:  auctionId,
    p_bidder_id:   userId,
    p_amount:      amount,
    p_max_bid:     maxBid ?? null,
    p_ip_address:  ipAddress ?? null,
  })

  if (error) throw new Error(error.message)

  const result = data as {
    bid_id: string
    new_current_bid: number
    new_bid_count: number
    reserve_met: boolean
    new_end_time: string
    was_extended: boolean
    previous_winner_id: string | null
  }

  // ── Update Redis cache ──
  await redis.hset(AUCTION_KEY(auctionId), {
    current_bid:       result.new_current_bid.toString(),
    bid_count:         result.new_bid_count.toString(),
    current_winner:    userId,
    reserve_met:       result.reserve_met ? '1' : '0',
    end_time:          new Date(result.new_end_time).getTime().toString(),
    status:            'active',
    last_bid_at:       Date.now().toString(),
  })

  // ── Broadcast via Ably ──
  await publishToChannel(`auction:${auctionId}`, 'bid_placed', {
    amount:          result.new_current_bid,
    bidderMasked:    maskBidder(userId),
    bidCount:        result.new_bid_count,
    reserveMet:      result.reserve_met,
    at:              Date.now(),
  })

  if (result.was_extended) {
    await publishToChannel(`auction:${auctionId}`, 'auction_extended', {
      newEndTime: result.new_end_time,
    })
  }

  // ── Notify outbid user ──
  if (result.previous_winner_id && result.previous_winner_id !== userId) {
    await publishToChannel(`private:${result.previous_winner_id}`, 'outbid_alert', {
      auctionId,
      yourBid:       amount - getMinIncrement(amount),
      currentBid:    result.new_current_bid,
      minNextBid:    result.new_current_bid + getMinIncrement(result.new_current_bid),
    })
  }

  // ── Slack notification ──
  const auction = await db.query.auctions.findFirst({
    where: eq(schema.auctions.id, auctionId),
    with: { listing: true },
  })

  if (auction?.listing) {
    await notifyNewBid({
      lotNumber:     auction.listing.lotNumber ?? auctionId.slice(0, 8),
      equipmentName: `${auction.listing.year} ${auction.listing.make} ${auction.listing.model}`,
      amount:        result.new_current_bid,
      bidderMasked:  maskBidder(userId),
      totalBids:     result.new_bid_count,
      auctionId,
    }).catch(() => {}) // non-blocking
  }

  // ── Run autobid engine ──
  await runAutobidEngine(auctionId, result.new_current_bid, userId)

  return {
    bid: {
      id:        result.bid_id,
      auctionId,
      bidderId:  userId,
      amount:    result.new_current_bid,
      bidType:   'manual',
      isWinning: true,
      placedAt:  new Date().toISOString(),
    },
    auction: {
      id:          auctionId,
      currentBid:  result.new_current_bid,
      bidCount:    result.new_bid_count,
      reserveMet:  result.reserve_met,
      endTime:     result.new_end_time,
    },
    isWinning:   true,
    wasExtended: result.was_extended,
  }
}

// ─── AUTOBID ENGINE ───────────────────────────────────────────────────────────

async function runAutobidEngine(auctionId: string, newBidAmount: number, manualBidderId: string) {
  const autobidders = await redis.hgetall(AUTOBID_KEY(auctionId))
  if (!autobidders || Object.keys(autobidders).length === 0) return

  const auction = await db.query.auctions.findFirst({
    where: eq(schema.auctions.id, auctionId),
  })
  if (!auction) return

  const minIncrement = getMinIncrement(newBidAmount)

  // Sort autobidders by max bid descending — highest max bid goes first
  const sorted = Object.entries(autobidders)
    .map(([userId, encMax]) => ({ userId, maxBid: Number(encMax) }))
    .filter(a => a.userId !== manualBidderId && a.maxBid > newBidAmount)
    .sort((a, b) => b.maxBid - a.maxBid)

  if (sorted.length === 0) return

  const topAutobidder = sorted[0]
  const autobidAmount = Math.min(
    topAutobidder.maxBid,
    newBidAmount + minIncrement
  )

  if (autobidAmount <= newBidAmount) return

  // Place autobid
  try {
    await processBid({
      auctionId,
      userId:  topAutobidder.userId,
      amount:  autobidAmount,
    })
  } catch (err: any) {
    // Autobid failure is non-critical — log but don't throw
    console.warn('[AutobidEngine] Failed:', err.message)
  }
}

// ─── CLOSE AUCTION ────────────────────────────────────────────────────────────

export async function closeAuction(auctionId: string) {
  const auction = await db.query.auctions.findFirst({
    where: eq(schema.auctions.id, auctionId),
    with: { listing: true },
  })

  if (!auction) throw new Error('Auction not found')
  if (auction.status === 'closed') return // already closed

  const winningBid = await db.query.bids.findFirst({
    where: and(
      eq(schema.bids.auctionId, auctionId),
      eq(schema.bids.isWinning, true),
    ),
  })

  if (!winningBid || !auction.reserveMet) {
    // No winning bid or reserve not met — cancel
    await db.update(schema.auctions)
      .set({ status: 'cancelled' })
      .where(eq(schema.auctions.id, auctionId))

    await publishToChannel(`auction:${auctionId}`, 'auction_closed', {
      finalPrice: null,
      reserveMet: false,
    })
    return
  }

  // Calculate fees
  const hammerPrice    = Number(winningBid.amount)
  const buyersPremium  = Math.round(hammerPrice * (Number(auction.buyersPremiumPct) / 100))
  const totalDue       = hammerPrice + buyersPremium
  const platformFee    = Math.round(hammerPrice * 0.02) // 2% seller fee
  const sellerProceeds = hammerPrice - platformFee
  const dueDate        = new Date(Date.now() + 48 * 3600 * 1000)

  // Close auction + create transaction in one DB call
  await supabaseAdmin.rpc('close_auction', {
    p_auction_id:      auctionId,
    p_winner_id:       winningBid.bidderId,
    p_final_price:     hammerPrice,
    p_buyers_premium:  buyersPremium,
    p_total_due:       totalDue,
    p_platform_fee:    platformFee,
    p_seller_proceeds: sellerProceeds,
    p_due_date:        dueDate.toISOString(),
  })

  // Notify winner via private channel
  await publishToChannel(`private:${winningBid.bidderId}`, 'you_won', {
    auctionId,
    finalPrice:      hammerPrice,
    buyersPremium,
    totalDue,
    paymentDeadline: dueDate.toISOString(),
  })

  // Broadcast close to all watchers
  await publishToChannel(`auction:${auctionId}`, 'auction_closed', {
    finalPrice:    hammerPrice,
    winnerMasked:  maskBidder(winningBid.bidderId),
    reserveMet:    true,
  })

  // Slack
  await notifyAuctionClosed({
    lotNumber:     auction.listing?.lotNumber ?? auctionId.slice(0, 8),
    equipmentName: auction.listing ? `${auction.listing.year} ${auction.listing.make} ${auction.listing.model}` : 'Unknown',
    finalPrice:    hammerPrice,
    winnerMasked:  maskBidder(winningBid.bidderId),
    totalBids:     auction.bidCount,
    reserveMet:    true,
  }).catch(() => {})

  // Clean up Redis
  await redis.del(AUCTION_KEY(auctionId))
  await redis.del(AUTOBID_KEY(auctionId))
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function maskBidder(userId: string): string {
  return userId.slice(0, 2).toUpperCase() + '***'
}

export function calcBuyersPremium(hammerPrice: number, pct = 12): number {
  return Math.round(hammerPrice * (pct / 100))
}

export function calcTotalDue(hammerPrice: number, pct = 12): number {
  return hammerPrice + calcBuyersPremium(hammerPrice, pct)
}
