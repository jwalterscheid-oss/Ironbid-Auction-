// lib/db.ts — Drizzle ORM client + typed query helpers
import { drizzle } from 'drizzle-orm/neon-serverless'
import { neon } from '@neondatabase/serverless'
import { eq, and, gt, lt, desc, asc, sql, inArray, ilike, or } from 'drizzle-orm'
import * as schema from './schema'
import type { AuctionFilters } from '@/types'

// ─── CLIENT ──────────────────────────────────────────────────────────────────

const client = neon(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })

// ─── USER QUERIES ─────────────────────────────────────────────────────────────

export async function getUserByClerkId(clerkId: string) {
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkId, clerkId))
    .limit(1)
  return rows[0] ?? null
}

export async function getUserById(id: string) {
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function upsertUserFromClerk(data: {
  clerkId: string
  email: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
}) {
  const existing = await getUserByClerkId(data.clerkId)
  if (existing) {
    const [updated] = await db
      .update(schema.users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.users.clerkId, data.clerkId))
      .returning()
    return updated
  }
  const [created] = await db
    .insert(schema.users)
    .values({ ...data, role: 'buyer', kycStatus: 'pending' })
    .returning()
  return created
}

// ─── LISTING QUERIES ──────────────────────────────────────────────────────────

export async function getListingById(id: string) {
  const rows = await db
    .select()
    .from(schema.listings)
    .where(eq(schema.listings.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function getListingsBySeller(sellerId: string) {
  return db
    .select()
    .from(schema.listings)
    .where(eq(schema.listings.sellerId, sellerId))
    .orderBy(desc(schema.listings.createdAt))
}

// ─── AUCTION QUERIES ──────────────────────────────────────────────────────────

export async function getAuctionById(id: string) {
  const rows = await db.query.auctions.findFirst({
    where: eq(schema.auctions.id, id),
    with: {
      listing: { with: { seller: true } },
      currentWinner: true,
    },
  })
  return rows ?? null
}

export async function getAuctionByListingId(listingId: string) {
  const rows = await db
    .select()
    .from(schema.auctions)
    .where(eq(schema.auctions.listingId, listingId))
    .limit(1)
  return rows[0] ?? null
}

export async function getActiveAuctions(filters: AuctionFilters = {}) {
  const {
    category, make, status = 'active', minPrice, maxPrice,
    minYear, maxYear, maxHours, locationState, auctionType,
    page = 1, pageSize = 24, sort = 'ending_soon',
  } = filters

  const conditions = [eq(schema.auctions.status, status as any)]
  
  const orderBy = {
    ending_soon: asc(schema.auctions.endTime),
    price_asc:   asc(schema.auctions.currentBid),
    price_desc:  desc(schema.auctions.currentBid),
    newest:      desc(schema.auctions.createdAt),
    most_bids:   desc(schema.auctions.bidCount),
    year_desc:   desc(schema.listings.year),
  }[sort]

  const rows = await db
    .select({ auction: schema.auctions, listing: schema.listings })
    .from(schema.auctions)
    .innerJoin(schema.listings, eq(schema.auctions.listingId, schema.listings.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.auctions)
    .where(and(...conditions))

  return {
    data: rows,
    total: Number(count),
    page,
    pageSize,
    totalPages: Math.ceil(Number(count) / pageSize),
  }
}

export async function getLiveAuctions() {
  return db
    .select({ auction: schema.auctions, listing: schema.listings })
    .from(schema.auctions)
    .innerJoin(schema.listings, eq(schema.auctions.listingId, schema.listings.id))
    .where(eq(schema.auctions.status, 'active'))
    .orderBy(asc(schema.auctions.endTime))
    .limit(6)
}

// ─── BID QUERIES ──────────────────────────────────────────────────────────────

export async function getBidsByAuction(auctionId: string, limit = 50) {
  return db
    .select({ bid: schema.bids, bidder: schema.users })
    .from(schema.bids)
    .innerJoin(schema.users, eq(schema.bids.bidderId, schema.users.id))
    .where(eq(schema.bids.auctionId, auctionId))
    .orderBy(desc(schema.bids.placedAt))
    .limit(limit)
}

export async function getWinningBid(auctionId: string) {
  const rows = await db
    .select()
    .from(schema.bids)
    .where(and(
      eq(schema.bids.auctionId, auctionId),
      eq(schema.bids.isWinning, true),
    ))
    .limit(1)
  return rows[0] ?? null
}

export async function getUserBids(userId: string) {
  return db
    .select({ bid: schema.bids, auction: schema.auctions, listing: schema.listings })
    .from(schema.bids)
    .innerJoin(schema.auctions, eq(schema.bids.auctionId, schema.auctions.id))
    .innerJoin(schema.listings, eq(schema.auctions.listingId, schema.listings.id))
    .where(eq(schema.bids.bidderId, userId))
    .orderBy(desc(schema.bids.placedAt))
    .limit(100)
}

// ─── TRANSACTION QUERIES ──────────────────────────────────────────────────────

export async function getTransactionByAuction(auctionId: string) {
  const rows = await db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.auctionId, auctionId))
    .limit(1)
  return rows[0] ?? null
}

export async function getPendingTransactions() {
  return db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.paymentStatus, 'pending'))
    .orderBy(asc(schema.transactions.dueDate))
}

export async function getOverdueTransactions() {
  return db
    .select()
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.paymentStatus, 'pending'),
      lt(schema.transactions.dueDate, new Date()),
    ))
}

// ─── HAUL JOB QUERIES ─────────────────────────────────────────────────────────

export async function getHaulJobById(id: string) {
  return db.query.haulJobs.findFirst({
    where: eq(schema.haulJobs.id, id),
    with: {
      listing: true,
      haulBids: {
        with: { carrier: true },
        orderBy: asc(schema.haulBids.amount),
      },
    },
  })
}

export async function getHaulJobsByBuyer(buyerId: string) {
  return db.query.haulJobs.findMany({
    where: eq(schema.haulJobs.buyerId, buyerId),
    with: {
      listing: true,
      haulBids: true,
    },
    orderBy: desc(schema.haulJobs.createdAt),
  })
}

export async function getAvailableHaulJobs(carrierProfile: {
  trailerTypes: string[]
  serviceStates: string[]
}) {
  return db
    .select({ job: schema.haulJobs, listing: schema.listings })
    .from(schema.haulJobs)
    .innerJoin(schema.listings, eq(schema.haulJobs.listingId, schema.listings.id))
    .where(and(
      eq(schema.haulJobs.status, 'bidding'),
      gt(schema.haulJobs.bidCloseTime, new Date()),
    ))
    .orderBy(asc(schema.haulJobs.bidCloseTime))
}

export async function getHaulBidsByCarrier(carrierId: string) {
  return db
    .select({ bid: schema.haulBids, job: schema.haulJobs, listing: schema.listings })
    .from(schema.haulBids)
    .innerJoin(schema.haulJobs, eq(schema.haulBids.haulJobId, schema.haulJobs.id))
    .innerJoin(schema.listings, eq(schema.haulJobs.listingId, schema.listings.id))
    .where(eq(schema.haulBids.carrierId, carrierId))
    .orderBy(desc(schema.haulBids.placedAt))
}

export async function getActiveLoadsForCarrier(carrierId: string) {
  return db
    .select({ job: schema.haulJobs, listing: schema.listings })
    .from(schema.haulJobs)
    .innerJoin(schema.listings, eq(schema.haulJobs.listingId, schema.listings.id))
    .where(and(
      eq(schema.haulJobs.awardedCarrierId, carrierId),
      inArray(schema.haulJobs.status, ['awarded', 'picked_up', 'in_transit']),
    ))
    .orderBy(asc(schema.haulJobs.deliveryDeadline))
}

export async function getHaulTrackingByJob(haulJobId: string) {
  return db
    .select()
    .from(schema.haulTracking)
    .where(eq(schema.haulTracking.haulJobId, haulJobId))
    .orderBy(desc(schema.haulTracking.recordedAt))
}

// ─── CARRIER PROFILE QUERIES ──────────────────────────────────────────────────

export async function getCarrierProfile(userId: string) {
  const rows = await db
    .select()
    .from(schema.carrierProfiles)
    .where(eq(schema.carrierProfiles.userId, userId))
    .limit(1)
  return rows[0] ?? null
}

export async function getCarrierEarnings(carrierId: string) {
  const completed = await db
    .select({ job: schema.haulJobs, bid: schema.haulBids })
    .from(schema.haulJobs)
    .innerJoin(schema.haulBids, eq(schema.haulJobs.awardedBidId, schema.haulBids.id))
    .where(and(
      eq(schema.haulJobs.awardedCarrierId, carrierId),
      eq(schema.haulJobs.status, 'delivered'),
    ))
    .orderBy(desc(schema.haulJobs.createdAt))

  const totalGross  = completed.reduce((s, r) => s + Number(r.bid.amount), 0)
  const platformFee = totalGross * 0.08
  const totalNet    = totalGross - platformFee

  return { completed, totalGross, platformFee, totalNet }
}

// ─── WATCHLIST ────────────────────────────────────────────────────────────────

export async function toggleWatchlist(userId: string, auctionId: string) {
  const existing = await db
    .select()
    .from(schema.watchlist)
    .where(and(
      eq(schema.watchlist.userId, userId),
      eq(schema.watchlist.auctionId, auctionId),
    ))
    .limit(1)

  if (existing.length > 0) {
    await db
      .delete(schema.watchlist)
      .where(and(
        eq(schema.watchlist.userId, userId),
        eq(schema.watchlist.auctionId, auctionId),
      ))
    return { watching: false }
  }

  await db.insert(schema.watchlist).values({ userId, auctionId })
  return { watching: true }
}

export async function getUserWatchlist(userId: string) {
  return db
    .select({ auction: schema.auctions, listing: schema.listings })
    .from(schema.watchlist)
    .innerJoin(schema.auctions, eq(schema.watchlist.auctionId, schema.auctions.id))
    .innerJoin(schema.listings, eq(schema.auctions.listingId, schema.listings.id))
    .where(eq(schema.watchlist.userId, userId))
    .orderBy(asc(schema.auctions.endTime))
}
