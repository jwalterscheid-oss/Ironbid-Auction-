// app/api/haul-bids/[id]/withdraw/route.ts — Carrier withdraws a haul bid
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, getUserByClerkId } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import * as schema from '@/lib/schema'
import { getDevMockState, isMockMode, mockUserIdForRole } from '@/lib/dev-mock'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (isMockMode) {
    const state = getDevMockState()
    const carrierId = mockUserIdForRole('carrier')
    const bid = state.haulBids.find((b) => b.id === params.id && b.carrierId === carrierId)
    if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 })
    bid.status = 'withdrawn'
    return NextResponse.json({ ok: true })
  }

  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const bid = await db.query.haulBids.findFirst({
    where: and(
      eq(schema.haulBids.id, params.id),
      eq(schema.haulBids.carrierId, user.id),
      eq(schema.haulBids.status, 'active'),
    ),
  })
  if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 })

  await db.update(schema.haulBids)
    .set({ status: 'withdrawn' })
    .where(eq(schema.haulBids.id, params.id))

  return NextResponse.json({ ok: true })
}
