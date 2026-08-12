// app/api/cron/close-auctions/route.ts — Vercel cron: runs every minute
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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

  // Close each expired auction directly. Previously this enqueued BullMQ jobs,
  // but (a) the job IDs contained ':' which BullMQ rejects, so every run 500'd,
  // and (b) no long-running worker exists on Vercel to consume the queue, so
  // even valid jobs would never have been processed. closeAuction() is
  // idempotent (it no-ops unless the auction is still active), so running it
  // inline here is safe even if another runner races us.
  const { closeAuction } = await import('@/lib/auction/bid-processor')
  const results = await Promise.allSettled(
    expiredAuctions.map(a => closeAuction(a.id))
  )

  const closed = results.filter(r => r.status === 'fulfilled').length
  const failures = results
    .map((r, i) => (r.status === 'rejected'
      ? { auctionId: expiredAuctions[i].id, error: r.reason instanceof Error ? r.reason.message : String(r.reason) }
      : null))
    .filter(Boolean)

  if (failures.length > 0) {
    console.error('[close-auctions] failed to close:', JSON.stringify(failures))
  }

  return NextResponse.json({ closed, failed: failures.length })
}
