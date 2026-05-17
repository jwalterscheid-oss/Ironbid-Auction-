// app/dashboard/haul/[id]/page.tsx — Haul job detail (Server Component)
import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import { getUserByClerkId, getHaulJobById, getHaulTrackingByJob } from '@/lib/db'
import { AwardBidButton } from '@/components/haul/AwardBidButton'
import { ConfirmDeliveryButton } from '@/components/haul/ConfirmDeliveryButton'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Haul Job | IRONBID' }
export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open:        { label: 'Open',        color: 'fog' },
  bidding:     { label: 'Bids Open',   color: 'teal' },
  awarded:     { label: 'Awarded',     color: 'blue' },
  picked_up:   { label: 'Picked Up',   color: 'amber' },
  in_transit:  { label: 'In Transit',  color: 'amber' },
  delivered:   { label: 'Delivered',   color: 'green' },
  cancelled:   { label: 'Cancelled',   color: 'red' },
}

const EVENT_LABELS: Record<string, string> = {
  awarded:          'Job Awarded',
  bol_signed:       'BOL Signed',
  picked_up:        'Picked Up',
  gps_update:       'GPS Update',
  in_transit:       'In Transit',
  near_destination: 'Near Destination',
  delivered:        'Delivered',
}

export default async function HaulJobDetailPage({ params }: { params: { id: string } }) {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/auth/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/onboarding')

  const job = await getHaulJobById(params.id)
  if (!job || job.buyerId !== user.id) notFound()

  const tracking = await getHaulTrackingByJob(job.id)

  const st       = STATUS_LABELS[job.status] ?? { label: job.status, color: 'fog' }
  const listing  = job.listing
  const bids     = job.haulBids ?? []
  const activeBids = bids.filter(b => b.status === 'active')
  const lowestAmount = bids.length > 0
    ? Math.min(...bids.map(b => Number(b.amount)))
    : null
  const canAward   = job.status === 'bidding'
  const canConfirm = job.status === 'picked_up' || job.status === 'in_transit'

  return (
    <div className="haul-page" style={{ display: 'grid', gap: '16px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Haul <span>Job</span>
          </h1>
          <p className="page-sub">
            Job #{job.id.slice(0, 8).toUpperCase()}
            {listing && ` · ${listing.year} ${listing.make} ${listing.model}`}
          </p>
        </div>
        <span className={`status-pill sp-${st.color}`}>{st.label}</span>
      </div>

      {/* Equipment + route */}
      <section className="section-card" style={{ padding: '18px' }}>
        <div className="form-section-title" style={{ marginBottom: '12px' }}>Equipment</div>
        <div className="review-grid">
          <div className="review-section">
            <div className="rs-label">Equipment</div>
            <div className="rs-value">
              {listing ? `${listing.year} ${listing.make} ${listing.model}` : 'Equipment'}
            </div>
          </div>
          <div className="review-section">
            <div className="rs-label">Lot Number</div>
            <div className="rs-value">{listing?.lotNumber ?? '—'}</div>
          </div>
          <div className="review-section">
            <div className="rs-label">Pickup Address</div>
            <div className="rs-value">{job.pickupAddress}</div>
          </div>
          <div className="review-section">
            <div className="rs-label">Delivery Address</div>
            <div className="rs-value">{job.deliveryAddress}</div>
          </div>
          <div className="review-section">
            <div className="rs-label">Trailer Type</div>
            <div className="rs-value">{(job.trailerType ?? 'any').toUpperCase()}</div>
          </div>
          <div className="review-section">
            <div className="rs-label">Status</div>
            <div className="rs-value">{st.label}</div>
          </div>
          <div className="review-section">
            <div className="rs-label">Bid Window</div>
            <div className="rs-value">{job.bidWindowHrs ?? 24} hrs</div>
            {job.bidCloseTime && (
              <div className="rs-meta">Closes {new Date(job.bidCloseTime).toLocaleString()}</div>
            )}
          </div>
          <div className="review-section">
            <div className="rs-label">Delivery Deadline</div>
            <div className="rs-value">
              {job.deliveryDeadline ? new Date(job.deliveryDeadline).toLocaleDateString() : 'Flexible'}
            </div>
          </div>
        </div>
        {job.notes && (
          <div className="review-section" style={{ marginTop: '8px' }}>
            <div className="rs-label">Notes</div>
            <div className="rs-meta">{job.notes}</div>
          </div>
        )}
        {job.specialRequirements && job.specialRequirements.length > 0 && (
          <div className="review-section" style={{ marginTop: '8px' }}>
            <div className="rs-label">Special Requirements</div>
            <div className="rs-meta">{job.specialRequirements.join(', ')}</div>
          </div>
        )}
      </section>

      {/* Confirm delivery */}
      {canConfirm && (
        <section className="section-card" style={{ padding: '18px' }}>
          <div className="form-section-title" style={{ marginBottom: '12px' }}>Delivery</div>
          <p style={{ color: 'var(--sand)', fontSize: '13px', marginBottom: '12px' }}>
            Confirm the equipment has arrived to release the held payment to the carrier.
          </p>
          <ConfirmDeliveryButton jobId={job.id} />
        </section>
      )}

      {/* Carrier bids */}
      <section className="section-card">
        <div className="sc-head">
          <div className="sc-title">Carrier Bids</div>
          <span className="bh-count">{bids.length} bid{bids.length !== 1 ? 's' : ''}</span>
        </div>
        {bids.length === 0 ? (
          <div className="empty-inline">No carrier bids yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: '2px', padding: '2px' }}>
            {bids.map(bid => {
              const amount = Number(bid.amount)
              const isLowest = lowestAmount !== null && amount === lowestAmount
              const carrier = bid.carrier
              const carrierName = carrier
                ? (carrier.companyName ?? (`${carrier.firstName ?? ''} ${carrier.lastName ?? ''}`.trim() || 'Carrier'))
                : 'Carrier'
              return (
                <div
                  key={bid.id}
                  className="bh-item"
                  style={{
                    gridTemplateColumns: '1fr auto',
                    borderColor: isLowest ? 'rgba(34,197,94,.3)' : undefined,
                  }}
                >
                  <div className="bh-info">
                    <div className="bh-name">
                      {carrierName}
                      {isLowest && <span className="you-tag" style={{ color: 'var(--green)' }}>LOWEST</span>}
                      {bid.status !== 'active' && (
                        <span className="you-tag">{bid.status.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="bh-time">
                      {bid.includesPermits && 'Permits included · '}
                      {bid.includesPilotCar && 'Pilot car included · '}
                      {bid.estimatedDeliveryDate
                        ? `ETA ${new Date(bid.estimatedDeliveryDate).toLocaleDateString()}`
                        : 'ETA not provided'}
                    </div>
                    {bid.carrierNotes && (
                      <div className="rs-meta" style={{ marginTop: '4px' }}>{bid.carrierNotes}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <div className={`bh-amount${isLowest ? ' winning' : ''}`}>
                      ${amount.toLocaleString()}
                    </div>
                    {canAward && bid.status === 'active' && (
                      <AwardBidButton jobId={job.id} bidId={bid.id} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {canAward && activeBids.length > 0 && (
          <p className="form-hint" style={{ padding: '0 14px 14px' }}>
            Awarding a bid holds payment in escrow and notifies the carrier.
          </p>
        )}
      </section>

      {/* Tracking timeline */}
      <section className="section-card">
        <div className="sc-head">
          <div className="sc-title">Tracking</div>
          <span className="bh-count">{tracking.length} update{tracking.length !== 1 ? 's' : ''}</span>
        </div>
        {tracking.length === 0 ? (
          <div className="empty-inline">No tracking updates yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: '2px', padding: '2px' }}>
            {tracking.map(event => (
              <div key={event.id} className="bh-item" style={{ gridTemplateColumns: '1fr auto' }}>
                <div className="bh-info">
                  <div className="bh-name">
                    {EVENT_LABELS[event.eventType] ?? event.eventType}
                  </div>
                  <div className="bh-time">
                    {event.addressApprox ?? 'Location not provided'}
                  </div>
                  {event.notes && (
                    <div className="rs-meta" style={{ marginTop: '4px' }}>{event.notes}</div>
                  )}
                </div>
                <div className="bh-time">
                  {new Date(event.recordedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
