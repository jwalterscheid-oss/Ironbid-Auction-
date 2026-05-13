// app/carrier/active-loads/page.tsx — Carrier active loads with tracking actions
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getUserByClerkId, getActiveLoadsForCarrier, getHaulTrackingByJob } from '@/lib/db'
import { LogTrackingButton } from '@/components/carrier/LogTrackingButton'
import type { Metadata } from 'next'

interface LoadListingSummary {
  year: number
  make: string
  model: string
}

export const metadata: Metadata = { title: 'Active Loads | IRONBID Carrier' }
export const dynamic = 'force-dynamic'

const TRACK_STEPS = ['awarded', 'picked_up', 'in_transit', 'delivered']
const STEP_LABELS  = ['Booked', 'BOL Signed', 'Picked Up', 'In Transit', 'Near Dest.', 'Delivered']

export default async function ActiveLoadsPage() {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/sign-in')

  const loads = await getActiveLoadsForCarrier(user.id)

  return (
    <div className="active-loads-page">
      <div className="page-header">
        <h1 className="page-title">Active <span>Loads</span></h1>
        <p className="page-sub">{loads.length} in progress · Log updates to release payment faster</p>
      </div>

      {loads.length === 0 ? (
        <div className="empty-state">
          <div className="es-icon">🚛</div>
          <div className="es-title">No active loads</div>
          <p>When you win a haul job, it will appear here for you to manage.</p>
        </div>
      ) : (
        <div className="loads-list">
          {loads.map(async ({ job, listing }) => {
            const tracking = await getHaulTrackingByJob(job.id)
            const latestEvent = tracking[0]
            const stepIdx = TRACK_STEPS.indexOf(job.status)
            const equipment = listing as LoadListingSummary

            return (
              <div key={job.id} className="load-card">
                <div className="lc-header">
                  <div>
                    <div className="lc-name">
                      {equipment.year} {equipment.make} {equipment.model}
                    </div>
                    <div className="lc-lot">Job #{job.id.slice(0, 8).toUpperCase()}</div>
                  </div>
                  <span className={`status-pill sp-${job.status.replace('_', '-')}`}>
                    {job.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {/* Progress track */}
                <div className="track-bar">
                  {STEP_LABELS.map((label, i) => (
                    <div
                      key={i}
                      className={`track-step ${i <= stepIdx + 1 ? 'done' : ''} ${i === stepIdx + 1 ? 'current' : ''}`}
                    >
                      <div className="ts-icon">{i <= stepIdx ? '✅' : ['📋','📋','🔧','🚛','📍','🏁'][i]}</div>
                      <div className="ts-label">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Details */}
                <div className="lc-detail-grid">
                  <div><div className="lcd-label">From</div><div className="lcd-val">{job.pickupAddress}</div></div>
                  <div><div className="lcd-label">To</div><div className="lcd-val">{job.deliveryAddress}</div></div>
                  <div>
                    <div className="lcd-label">Last Update</div>
                    <div className="lcd-val">
                      {latestEvent
                        ? `${latestEvent.addressApprox ?? latestEvent.eventType} · ${new Date(latestEvent.recordedAt).toLocaleString()}`
                        : 'No updates yet'}
                    </div>
                  </div>
                  <div>
                    <div className="lcd-label">Deliver By</div>
                    <div className="lcd-val" style={{ color: 'var(--amber)' }}>
                      {job.deliveryDeadline ? new Date(job.deliveryDeadline).toLocaleDateString() : 'Flexible'}
                    </div>
                  </div>
                </div>

                {/* Action buttons (client component for interactivity) */}
                <LogTrackingButton jobId={job.id} currentStatus={job.status} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
