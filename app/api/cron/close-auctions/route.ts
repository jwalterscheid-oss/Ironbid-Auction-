// app/api/cron/close-auctions/route.ts — Vercel cron: runs every minute
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auctionCloseQueue } from '@/workers/bid-processor'
import { lt, eq, and } from 'drizzle-orm'
import * as schema from '@/lib/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent public access
  const cronSecret = req.headers.get('authorization')
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Find auctions that should be closed
  const expiredAuctions = await db
    .select({ id: schema.auctions.id })
    .from(schema.auctions)
    .where(
      and(
        eq(schema.auctions.status, 'active'),
        lt(schema.auctions.endTime, now),
      )
    )
    .limit(50)

  if (expiredAuctions.length === 0) {
    return NextResponse.json({ closed: 0 })
  }

  // Enqueue close jobs for each expired auction
  await Promise.all(
    expiredAuctions.map(a =>
      auctionCloseQueue.add(
        'close_auction',
        { auctionId: a.id },
        { jobId: `close:${a.id}`, removeOnComplete: true }
      )
    )
  )

  return NextResponse.json({ closed: expiredAuctions.length })
}
