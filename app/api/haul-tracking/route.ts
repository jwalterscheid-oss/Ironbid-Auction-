// app/api/haul-tracking/route.ts — Carrier logs a GPS or status update
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db, getUserByClerkId } from '@/lib/db'
import { publishToChannel } from '@/lib/ably'
import { eq, and } from 'drizzle-orm'
import * as schema from '@/lib/schema'

const TrackingSchema = z.object({
  haulJobId:      z.string().uuid(),
  eventType:      z.enum(['bol_signed', 'picked_up', 'gps_update', 'near_destination', 'delivered']),
  addressApprox:  z.string().optional(),
  milesRemaining: z.number().optional(),
  notes:          z.string().optional(),
  documentUrl:    z.string().url().optional(),
})

const STATUS_MAP: Record<string, string> = {
  bol_signed:       'awarded',
  picked_up:        'picked_up',
  gps_update:       'in_transit',
  near_destination: 'in_transit',
  delivered:        'delivered',
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = TrackingSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 422 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Verify carrier owns this job
  const job = await db.query.haulJobs.findFirst({
    where: and(
      eq(schema.haulJobs.id, body.data.haulJobId),
      eq(schema.haulJobs.awardedCarrierId, user.id),
    ),
  })
  if (!job) return NextResponse.json({ error: 'Job not found or not assigned to you' }, { status: 404 })

  const newStatus = STATUS_MAP[body.data.eventType]
  const eta = body.data.milesRemaining
    ? new Date(Date.now() + (body.data.milesRemaining / 60) * 3600000).toISOString()
    : undefined

  // Insert tracking event + update job status
  const [event] = await db
    .insert(schema.haulTracking)
    .values({
      ...body.data,
      etaUpdated:  eta ? new Date(eta) : undefined,
      recordedAt:  new Date(),
    })
    .returning()

  if (newStatus && newStatus !== job.status) {
    await db.update(schema.haulJobs)
      .set({ status: newStatus as any })
      .where(eq(schema.haulJobs.id, body.data.haulJobId))
  }

  // Broadcast to buyer
  const eventName = `haul_${body.data.eventType}` as any
  await publishToChannel(`haul:${body.data.haulJobId}`, eventName, {
    ...event,
    newStatus,
    etaUpdated: eta,
  })

  return NextResponse.json(event, { status: 201 })
}
