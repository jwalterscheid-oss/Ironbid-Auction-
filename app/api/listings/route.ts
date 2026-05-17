// app/api/listings/route.ts — Create and list equipment listings
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db, getUserByClerkId } from '@/lib/db'
import * as schema from '@/lib/schema'
import { notifyError } from '@/lib/slack'
import { eq, desc, sql } from 'drizzle-orm'
import { getDevMockState, isMockMode, mockUserIdForRole, nextMockLotNumber } from '@/lib/dev-mock'

const CreateListingSchema = z.object({
  category:       z.enum(['excavator','bulldozer','crane','loader','truck','aerial','compactor','skid_steer']),
  make:           z.string().min(1).max(100),
  model:          z.string().min(1).max(100),
  year:           z.number().int().min(1970).max(new Date().getFullYear() + 1),
  serialNumber:   z.string().max(100).optional(),
  hours:          z.number().int().min(0).optional(),
  weightKg:       z.number().positive().optional(),
  conditionGrade: z.enum(['A+','A','B','C','D']).optional(),
  description:    z.string().max(5000).optional(),
  locationCity:   z.string().max(100).optional(),
  locationState:  z.string().length(2).optional(),
  inspectionData: z.record(z.enum(['pass','fair','fail'])).optional(),
})

// GET — seller's own listings
export async function GET() {
  if (isMockMode) {
    const state = getDevMockState()
    const sellerId = mockUserIdForRole('seller')
    const listings = state.listings
      .filter((l) => l.sellerId === sellerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return NextResponse.json(listings)
  }

  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const listings = await db
    .select()
    .from(schema.listings)
    .where(eq(schema.listings.sellerId, user.id))
    .orderBy(desc(schema.listings.createdAt))

  return NextResponse.json(listings)
}

// POST — create new listing
export async function POST(req: Request) {
  if (isMockMode) {
    const body = CreateListingSchema.safeParse(await req.json())
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 422 })

    const state = getDevMockState()
    const listing = {
      id: crypto.randomUUID(),
      sellerId: mockUserIdForRole('seller'),
      lotNumber: nextMockLotNumber(),
      status: 'draft' as const,
      category: body.data.category,
      make: body.data.make,
      model: body.data.model,
      year: body.data.year,
      serialNumber: body.data.serialNumber,
      hours: body.data.hours,
      weightKg: body.data.weightKg,
      conditionGrade: body.data.conditionGrade,
      description: body.data.description,
      locationCity: body.data.locationCity,
      locationState: body.data.locationState,
      inspectionData: body.data.inspectionData,
      createdAt: new Date().toISOString(),
    }
    state.listings.unshift(listing)
    return NextResponse.json(listing, { status: 201 })
  }

  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = CreateListingSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 422 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.disabledAt) return NextResponse.json({ error: 'Account disabled' }, { status: 403 })
  if (!['seller','dealer','admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Seller account required' }, { status: 403 })
  }
  if (user.kycStatus !== 'verified') {
    return NextResponse.json(
      { error: 'identity_verification_required', message: 'Verify your identity before creating a listing' },
      { status: 403 }
    )
  }

  // Generate lot number from a DB sequence — race-free under concurrent creates.
  const lotSeq = await db.execute<{ seq: string }>(sql`SELECT nextval('listing_lot_seq') AS seq`)
  const seq = Number(lotSeq.rows[0]?.seq ?? Date.now())
  const lotNumber = `IB-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`

  try {
    const [listing] = await db
      .insert(schema.listings)
      .values({
        sellerId: user.id,
        lotNumber,
        status: 'draft',
        category: body.data.category,
        make: body.data.make,
        model: body.data.model,
        year: body.data.year,
        serialNumber: body.data.serialNumber,
        hours: body.data.hours,
        weightKg: body.data.weightKg?.toString(),
        conditionGrade: body.data.conditionGrade,
        description: body.data.description,
        locationCity: body.data.locationCity,
        locationState: body.data.locationState,
        inspectionData: body.data.inspectionData,
      })
      .returning()

    return NextResponse.json(listing, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create listing'
    await notifyError({ context: 'Create listing', error: message, severity: 'medium' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
