// app/api/haul-jobs/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { publishToChannel } from '@/lib/ably'
import { notifyHaulJobPosted, notifyError } from '@/lib/slack'
import { z } from 'zod'
import { getDevMockState, isMockMode, mockUserIdForRole } from '@/lib/dev-mock'

interface AuctionListingSnapshot {
  listing?: {
    lot_number?: string
    year?: number
    make?: string
    model?: string
  } | null
}

const CreateHaulJobSchema = z.object({
  transaction_id:       z.string().uuid(),
  pickup_address:       z.string().min(5),
  delivery_address:     z.string().min(5),
  trailer_type:         z.enum(['rgn','lowboy','step_deck','flatbed','extendable','any']).default('any'),
  special_requirements: z.array(z.string()).default([]),
  notes:                z.string().optional(),
  desired_pickup_date:  z.string().optional(),
  delivery_deadline:    z.string().optional(),
  max_budget:           z.number().optional(),
  bid_window_hrs:       z.enum(['6', '24', '48', '72']).default('24'),
})

// GET — list buyer's haul jobs
export async function GET() {
  if (isMockMode) {
    const state = getDevMockState()
    const buyerId = mockUserIdForRole('buyer')
    const jobs = state.haulJobs
      .filter((job) => job.buyerId === buyerId)
      .map((job) => ({
        ...job,
        listing: state.listings.find((listing) => listing.id === job.listingId),
        haulBids: state.haulBids.filter((bid) => bid.haulJobId === job.id),
      }))
    return NextResponse.json(jobs)
  }

  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: user } = await supabaseAdmin
    .from('users').select('id').eq('clerk_id', userId).single()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('haul_jobs')
    .select(`
      *,
      listing:listings(make, model, year, location_city, location_state, photos),
      haul_bids(id, amount, status, carrier_id, estimated_delivery_date),
      awarded_carrier:carrier_profiles!awarded_carrier_id(company_name, avg_rating)
    `)
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — create a new haul job
export async function POST(req: Request) {
  if (isMockMode) {
    const body = CreateHaulJobSchema.safeParse(await req.json())
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 422 })

    const state = getDevMockState()
    const buyerId = mockUserIdForRole('buyer')
    const listing = state.listings[0]
    if (!listing) return NextResponse.json({ error: 'No listing available' }, { status: 404 })

    const job = {
      id: crypto.randomUUID(),
      transactionId: body.data.transaction_id,
      buyerId,
      listingId: listing.id,
      status: 'bidding' as const,
      pickupAddress: body.data.pickup_address,
      deliveryAddress: body.data.delivery_address,
      trailerType: body.data.trailer_type,
      specialRequirements: body.data.special_requirements,
      notes: body.data.notes,
      deliveryDeadline: body.data.delivery_deadline,
      bidWindowHrs: Number(body.data.bid_window_hrs),
      bidCloseTime: new Date(Date.now() + Number(body.data.bid_window_hrs) * 3600 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    }

    state.haulJobs.unshift(job)
    return NextResponse.json(job, { status: 201 })
  }

  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = CreateHaulJobSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 422 })

  const { data: user } = await supabaseAdmin
    .from('users').select('id').eq('clerk_id', userId).single()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Verify buyer paid for this transaction
  const { data: tx } = await supabaseAdmin
    .from('transactions')
    .select('id, listing_id, buyer_id, payment_status, auction:auctions(listing:listings(*))')
    .eq('id', body.data.transaction_id)
    .eq('buyer_id', user.id)
    .single()

  if (!tx || tx.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Transaction not eligible' }, { status: 403 })
  }

  // Calculate bid close time
  const bidCloseTime = new Date(Date.now() + parseInt(body.data.bid_window_hrs) * 3600 * 1000)

  const { data: job, error } = await supabaseAdmin
    .from('haul_jobs')
    .insert({
      transaction_id:       body.data.transaction_id,
      buyer_id:             user.id,
      listing_id:           tx.listing_id,
      status:               'bidding',
      pickup_address:       body.data.pickup_address,
      delivery_address:     body.data.delivery_address,
      trailer_type:         body.data.trailer_type,
      special_requirements: body.data.special_requirements,
      notes:                body.data.notes ?? null,
      desired_pickup_date:  body.data.desired_pickup_date ?? null,
      delivery_deadline:    body.data.delivery_deadline ?? null,
      max_budget:           body.data.max_budget ?? null,
      bid_window_hrs:       Number(body.data.bid_window_hrs),
      bid_close_time:       bidCloseTime.toISOString(),
    })
    .select()
    .single()

  if (error) {
    await notifyError({ context: 'Create haul job', error: error.message, severity: 'medium' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const auctionSnapshot = tx.auction as AuctionListingSnapshot | null | undefined
  const listingSnapshot = auctionSnapshot?.listing

  // Notify matched carriers via Ably
  await publishToChannel('haul-jobs:available', 'haul_job_posted', {
    job_id: job.id,
    lot_number: listingSnapshot?.lot_number,
    equipment: `${listingSnapshot?.year ?? ''} ${listingSnapshot?.make ?? ''} ${listingSnapshot?.model ?? ''}`.trim(),
    route: `${body.data.pickup_address} → ${body.data.delivery_address}`,
    deadline: body.data.delivery_deadline,
  })

  await notifyHaulJobPosted({
    jobId: job.id,
    lotNumber: listingSnapshot?.lot_number ?? '—',
    equipment: `${listingSnapshot?.make ?? ''} ${listingSnapshot?.model ?? ''}`.trim(),
    route: `${body.data.pickup_address} → ${body.data.delivery_address}`,
    distanceMiles: 0, // calculated async by background job
    matchedCarriers: 0,
  })

  return NextResponse.json(job, { status: 201 })
}
