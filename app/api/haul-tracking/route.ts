// app/api/haul-tracking/route.ts — Carrier logs a GPS or status update
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db, getUserByClerkId } from '@/lib/db'
import { publishToChannel } from '@/lib/ably'
import { eq, and } from 'drizzle-orm'
import * as schema from '@/lib/schema'
import { getDevMockState, isMockMode, mockUserIdForRole } from '@/lib/dev-mock'

type TrackingEvent = (typeof schema.trackingEventEnum.enumValues)[number]
type HaulJobStatus = (typeof schema.haulJobStatusEnum.enumValues)[number]

// 'delivered' is intentionally NOT carrier-loggable — only the buyer can
// confirm delivery (via /api/haul-jobs/[id]/confirm-delivery), which is what
// releases the escrowed payment. Letting a carrier self-confirm would both
// bypass payment capture and deadlock the buyer's confirmation.
const TrackingSchema = z.object({
  haulJobId:      z.string().uuid(),
  eventType:      z.enum(['bol_signed', 'picked_up', 'gps_update', 'near_destination']),
  addressApprox:  z.string().optional(),
  milesRemaining: z.number().optional(),
  notes:          z.string().optional(),
  documentUrl:    z.string().url().optional(),
})

const STATUS_MAP: Partial<Record<TrackingEvent, HaulJobStatus>> = {
  picked_up:        'picked_up',
  gps_update:       'in_transit',
  near_destination: 'in_transit',
}

// Forward-only status ranking — a tracking event may advance the job status
// but never regress it.
const STATUS_RANK: Record<HaulJobStatus, number> = {
  open: 0, bidding: 1, awarded: 2, picked_up: 3, in_transit: 4, delivered: 5, cancelled: -1,
}

type TrackingEventInput = z.infer<typeof TrackingSchema>['eventType']

// Which job statuses each event may be logged from. Prevents a carrier from
// skipping the state machine — e.g. jumping awarded → in_transit (via a
// gps_update) without ever logging the pickup.
const VALID_FROM: Record<TrackingEventInput, HaulJobStatus[]> = {
  bol_signed:       ['awarded', 'picked_up'],
  picked_up:        ['awarded'],
  gps_update:       ['picked_up', 'in_transit'],
  near_destination: ['picked_up', 'in_transit'],
}

export async function POST(req: NextRequest) {
  if (isMockMode) {
    const body = TrackingSchema.safeParse(await req.json())
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 422 })

    const state = getDevMockState()
    const carrierId = mockUserIdForRole('carrier')
    const job = state.haulJobs.find(
      (j) => j.id === body.data.haulJobId && j.awardedCarrierId === carrierId
    )
    if (!job) return NextResponse.json({ error: 'Job not found or not assigned to you' }, { status: 404 })

    if (!VALID_FROM[body.data.eventType].includes(job.status as HaulJobStatus)) {
      return NextResponse.json(
        { error: 'invalid_status_transition', message: `Cannot log ${body.data.eventType} while job is ${job.status}` },
        { status: 422 }
      )
    }

    const newStatus = STATUS_MAP[body.data.eventType]
    if (newStatus) job.status = newStatus as typeof job.status

    return NextResponse.json({
      id: crypto.randomUUID(),
      haulJobId: body.data.haulJobId,
      eventType: body.data.eventType,
      addressApprox: body.data.addressApprox ?? null,
      milesRemaining: body.data.milesRemaining ?? null,
      notes: body.data.notes ?? null,
      recordedAt: new Date().toISOString(),
      newJobStatus: newStatus ?? job.status,
      mocked: true,
    })
  }

  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = TrackingSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 422 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.disabledAt) return NextResponse.json({ error: 'Account disabled' }, { status: 403 })

  // Verify carrier owns this job
  const job = await db.query.haulJobs.findFirst({
    where: and(
      eq(schema.haulJobs.id, body.data.haulJobId),
      eq(schema.haulJobs.awardedCarrierId, user.id),
    ),
  })
  if (!job) return NextResponse.json({ error: 'Job not found or not assigned to you' }, { status: 404 })

  if (!VALID_FROM[body.data.eventType].includes(job.status)) {
    return NextResponse.json(
      { error: 'invalid_status_transition', message: `Cannot log ${body.data.eventType} while job is ${job.status}` },
      { status: 422 }
    )
  }

  const newStatus = STATUS_MAP[body.data.eventType]
  const eta = body.data.milesRemaining
    ? new Date(Date.now() + (body.data.milesRemaining / 60) * 3600000).toISOString()
    : undefined

  // Insert tracking event + update job status
  const [event] = await db
    .insert(schema.haulTracking)
    .values({
      haulJobId: body.data.haulJobId,
      eventType: body.data.eventType,
      addressApprox: body.data.addressApprox,
      milesRemaining: body.data.milesRemaining?.toString(),
      notes: body.data.notes,
      documentUrl: body.data.documentUrl,
      etaUpdated: eta ? new Date(eta) : undefined,
      recordedAt: new Date(),
    })
    .returning()

  const shouldAdvance =
    !!newStatus &&
    newStatus !== job.status &&
    STATUS_RANK[newStatus] > STATUS_RANK[job.status]

  if (shouldAdvance) {
    await db.update(schema.haulJobs)
      .set({ status: newStatus })
      .where(eq(schema.haulJobs.id, body.data.haulJobId))
  }

  // Broadcast to buyer
  const eventName = `haul_${body.data.eventType}`
  await publishToChannel(`haul:${body.data.haulJobId}`, eventName, {
    ...event,
    newStatus: shouldAdvance ? newStatus : job.status,
    etaUpdated: eta,
  })

  return NextResponse.json(event, { status: 201 })
}
