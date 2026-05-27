// app/api/cron/close-haul-bid-windows/route.ts — Vercel cron
//
// Once bid_close_time passes, the haul_bids trigger (see migration 0003)
// already rejects new bids. This cron just cleans up jobs whose window
// expired with no active bids — they'd otherwise sit visible to carriers
// forever as a no-bid zombie. Jobs that did receive bids are left alone
// so the buyer can still award from the collected pool.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { and, eq, lt, sql } from 'drizzle-orm'
import * as schema from '@/lib/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('authorization')
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  const cancelled = await db
    .update(schema.haulJobs)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(schema.haulJobs.status, 'bidding'),
        lt(schema.haulJobs.bidCloseTime, now),
        sql`NOT EXISTS (
          SELECT 1 FROM haul_bids
          WHERE haul_bids.haul_job_id = ${schema.haulJobs.id}
            AND haul_bids.status = 'active'
        )`,
      )
    )
    .returning({ id: schema.haulJobs.id })

  return NextResponse.json({ cancelled: cancelled.length })
}
