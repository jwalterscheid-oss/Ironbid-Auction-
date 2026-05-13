import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
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
  return NextResponse.json(job)
}
