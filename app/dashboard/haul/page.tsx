// app/dashboard/haul/page.tsx — Buyer's haul jobs list (Server Component)
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getUserByClerkId, getHaulJobsByBuyer } from '@/lib/db'
import Link from 'next/link'
import type { Metadata } from 'next'

interface HaulListingSummary {
  year: number
  make: string
  model: string
}

export const metadata: Metadata = { title: 'My Haul Jobs | IRONBID' }
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

export default async function HaulJobsPage() {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/onboarding')

  const jobs = await getHaulJobsByBuyer(user.id)

  return (
    <div className="haul-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Haul <span>Jobs</span></h1>
          <p className="page-sub">{jobs.length} job{jobs.length !== 1 ? 's' : ''} total</p>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <div className="es-icon">🚛</div>
          <div className="es-title">No haul jobs yet</div>
          <p>After winning an auction and paying, you can post a haul job to get carrier bids for transport.</p>
        </div>
      ) : (
        <div className="haul-jobs-list">
          {jobs.map(job => {
            const st  = STATUS_LABELS[job.status] ?? { label: job.status, color: 'fog' }
            const bids = job.haulBids ?? []
            const lowest = bids.length > 0
              ? Math.min(...bids.map(b => Number(b.amount)))
              : null
            const equipment = job.listing as HaulListingSummary | undefined

            return (
              <Link key={job.id} href={`/dashboard/haul/${job.id}`} className="haul-job-card">
                <div className="hjc-left">
                  <div className="hjc-name">
                    {equipment
                      ? `${equipment.year} ${equipment.make} ${equipment.model}`
                      : 'Equipment'}
                  </div>
                  <div className="hjc-route">
                    📍 {job.pickupAddress} → {job.deliveryAddress}
                    {job.distanceMiles && ` · ${Number(job.distanceMiles).toFixed(0)} miles`}
                  </div>
                  <div className="hjc-meta">
                    {job.trailerType !== 'any' && <span>{job.trailerType.toUpperCase()}</span>}
                    {job.deliveryDeadline && <span>Due: {new Date(job.deliveryDeadline).toLocaleDateString()}</span>}
                  </div>
                </div>

                <div className="hjc-center">
                  <div className="hjc-bids">{bids.length} bid{bids.length !== 1 ? 's' : ''}</div>
                  {lowest !== null && (
                    <div className="hjc-lowest">
                      Lowest: <strong>${lowest.toLocaleString()}</strong>
                    </div>
                  )}
                  {job.bidCloseTime && job.status === 'bidding' && (
                    <div className="hjc-close">
                      Closes: {new Date(job.bidCloseTime).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="hjc-right">
                  <span className={`status-pill sp-${st.color}`}>{st.label}</span>
                  <span className="hjc-arrow">→</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
