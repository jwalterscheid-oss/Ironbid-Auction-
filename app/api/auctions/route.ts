// app/api/auctions/route.ts — List auctions with filters
import { NextRequest, NextResponse } from 'next/server'
import { getActiveAuctions } from '@/lib/db'
import type { AuctionFilters, AuctionStatus, AuctionType, Category } from '@/types'

const SORT_VALUES: NonNullable<AuctionFilters['sort']>[] = ['ending_soon', 'price_asc', 'price_desc', 'newest', 'most_bids', 'year_desc']
const AUCTION_STATUS_VALUES: AuctionStatus[] = ['scheduled', 'active', 'extended', 'closed', 'cancelled']
const AUCTION_TYPE_VALUES: AuctionType[] = ['timed', 'live', 'buy_now']
const CATEGORY_VALUES: Category[] = ['excavator', 'bulldozer', 'crane', 'loader', 'truck', 'aerial', 'compactor', 'skid_steer']

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

  const result = await getActiveAuctions(filters)
  return NextResponse.json(result)
}
