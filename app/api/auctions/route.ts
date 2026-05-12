// app/api/auctions/route.ts — List auctions with filters
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getActiveAuctions } from '@/lib/db'
import type { AuctionFilters } from '@/types'

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams

  const filters: AuctionFilters = {
    category:      p.get('category') as any ?? undefined,
    make:          p.get('make') ?? undefined,
    status:        (p.get('status') as any) ?? 'active',
    minPrice:      p.get('minPrice') ? Number(p.get('minPrice')) : undefined,
    maxPrice:      p.get('maxPrice') ? Number(p.get('maxPrice')) : undefined,
    minYear:       p.get('minYear') ? Number(p.get('minYear')) : undefined,
    maxYear:       p.get('maxYear') ? Number(p.get('maxYear')) : undefined,
    maxHours:      p.get('maxHours') ? Number(p.get('maxHours')) : undefined,
    locationState: p.get('state') ?? undefined,
    auctionType:   p.get('type') as any ?? undefined,
    page:          p.get('page') ? Number(p.get('page')) : 1,
    pageSize:      p.get('pageSize') ? Number(p.get('pageSize')) : 24,
    sort:          p.get('sort') as any ?? 'ending_soon',
  }

  const result = await getActiveAuctions(filters)
  return NextResponse.json(result)
}
