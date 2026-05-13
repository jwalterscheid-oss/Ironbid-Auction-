// app/api/auctions/route.ts — List auctions with filters
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, getActiveAuctions, getListingById, getUserByClerkId } from '@/lib/db'
import * as schema from '@/lib/schema'
import { getDevMockState, isMockMode, mockUserIdForRole } from '@/lib/dev-mock'
import type { AuctionFilters, AuctionStatus, AuctionType, Category } from '@/types'

const SORT_VALUES: NonNullable<AuctionFilters['sort']>[] = ['ending_soon', 'price_asc', 'price_desc', 'newest', 'most_bids', 'year_desc']
const AUCTION_STATUS_VALUES: AuctionStatus[] = ['scheduled', 'active', 'extended', 'closed', 'cancelled']
const AUCTION_TYPE_VALUES: AuctionType[] = ['timed', 'live', 'buy_now']
const CATEGORY_VALUES: Category[] = ['excavator', 'bulldozer', 'crane', 'loader', 'truck', 'aerial', 'compactor', 'skid_steer']

const CreateAuctionSchema = z.object({
  listingId: z.string().uuid(),
  type: z.enum(['timed', 'live', 'buy_now']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  startingBid: z.number().positive(),
  reservePrice: z.number().positive().optional(),
  buyNowPrice: z.number().positive().optional(),
  minIncrement: z.number().positive().default(500),
  buyersPremiumPct: z.number().min(0).max(50).default(12),
})

function parseEnum<T extends string>(value: string | null, values: readonly T[]): T | undefined {
  return value && values.includes(value as T) ? (value as T) : undefined
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams

  const filters: AuctionFilters = {
    category:      parseEnum(p.get('category'), CATEGORY_VALUES),
    make:          p.get('make') ?? undefined,
    status:        parseEnum(p.get('status'), AUCTION_STATUS_VALUES) ?? 'active',
    minPrice:      p.get('minPrice') ? Number(p.get('minPrice')) : undefined,
    maxPrice:      p.get('maxPrice') ? Number(p.get('maxPrice')) : undefined,
    minYear:       p.get('minYear') ? Number(p.get('minYear')) : undefined,
    maxYear:       p.get('maxYear') ? Number(p.get('maxYear')) : undefined,
    maxHours:      p.get('maxHours') ? Number(p.get('maxHours')) : undefined,
    locationState: p.get('state') ?? undefined,
    auctionType:   parseEnum(p.get('type'), AUCTION_TYPE_VALUES),
    page:          p.get('page') ? Number(p.get('page')) : 1,
    pageSize:      p.get('pageSize') ? Number(p.get('pageSize')) : 24,
    sort:          parseEnum(p.get('sort'), SORT_VALUES) ?? 'ending_soon',
  }

  if (isMockMode) {
    const state = getDevMockState()
    const rows = state.auctions
      .filter((a) => !filters.status || a.status === filters.status)
      .map((auction) => ({
        auction,
        listing: state.listings.find((listing) => listing.id === auction.listingId),
      }))
      .filter((row) => Boolean(row.listing))

    const page = filters.page ?? 1
    const pageSize = filters.pageSize ?? 24
    const paged = rows.slice((page - 1) * pageSize, page * pageSize)

    return NextResponse.json({
      data: paged,
      total: rows.length,
      page,
      pageSize,
      totalPages: Math.ceil(rows.length / pageSize),
      mocked: true,
    })
  }

  try {
    const result = await getActiveAuctions(filters)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({
      data: [],
      total: 0,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 24,
      totalPages: 0,
      degraded: true,
    })
  }
}

export async function POST(req: NextRequest) {
  const body = CreateAuctionSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 422 })

  if (isMockMode) {
    const state = getDevMockState()
    const sellerId = mockUserIdForRole('seller')
    const listing = state.listings.find((l) => l.id === body.data.listingId)
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    if (listing.sellerId !== sellerId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const auction = {
      id: crypto.randomUUID(),
      listingId: body.data.listingId,
      type: body.data.type,
      status: 'active' as const,
      startTime: body.data.startTime,
      endTime: body.data.endTime,
      startingBid: body.data.startingBid,
      reservePrice: body.data.reservePrice,
      buyNowPrice: body.data.buyNowPrice,
      minIncrement: body.data.minIncrement,
      buyersPremiumPct: body.data.buyersPremiumPct,
      currentBid: body.data.startingBid,
      bidCount: 0,
      reserveMet: !body.data.reservePrice,
      watchCount: 0,
      viewCount: 0,
      createdAt: new Date().toISOString(),
    }

    listing.status = 'active'
    state.auctions.unshift(auction)
    return NextResponse.json(auction, { status: 201 })
  }

  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const listing = await getListingById(body.data.listingId)
  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  if (listing.sellerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [auction] = await db
    .insert(schema.auctions)
    .values({
      listingId: body.data.listingId,
      type: body.data.type,
      status: 'active',
      startTime: new Date(body.data.startTime),
      endTime: new Date(body.data.endTime),
      startingBid: body.data.startingBid.toString(),
      reservePrice: body.data.reservePrice ? body.data.reservePrice.toString() : undefined,
      buyNowPrice: body.data.buyNowPrice ? body.data.buyNowPrice.toString() : undefined,
      minIncrement: body.data.minIncrement.toString(),
      buyersPremiumPct: body.data.buyersPremiumPct.toString(),
      bidCount: 0,
      reserveMet: !body.data.reservePrice,
      watchCount: 0,
      viewCount: 0,
    })
    .returning()

  await db
    .update(schema.listings)
    .set({ status: 'active' })
    .where(eq(schema.listings.id, body.data.listingId))

  return NextResponse.json(auction, { status: 201 })
}
