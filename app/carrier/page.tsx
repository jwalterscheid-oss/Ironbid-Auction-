// app/carrier/page.tsx — Carrier overview dashboard
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getUserByClerkId, getCarrierProfile, getActiveLoadsForCarrier,
         getHaulBidsByCarrier, getCarrierEarnings } from '@/lib/db'
import Link from 'next/link'
import type { Metadata } from 'next'

interface CarrierListingSummary {
  year: number
  make: string
  model: string
}

export const metadata: Metadata = { title: 'Carrier Dashboard | IRONBID' }
export const dynamic = 'force-dynamic'

export default async function CarrierOverviewPage() {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/onboarding')

  const [profile, activeLoads, myBids, earnings] = await Promise.all([
    getCarrierProfile(user.id),
    getActiveLoadsForCarrier(user.id),
    getHaulBidsByCarrier(user.id),
    getCarrierEarnings(user.id),
  ])

  const openBids     = myBids.filter(r => r.bid.status === 'active').length
  const mtdRevenue   = earnings.completed
    .filter(r => new Date(r.job.createdAt) > new Date(Date.now() - 30 * 86400000))
    .reduce((s, r) => s + Number(r.bid.amount) * 0.92, 0)

  return (
    <div className="carrier-overview">
      <div className="page-header">
        <div>
          <h1 className="page-title">Carrier <span>Overview</span></h1>
          <p className="page-sub">
            {profile?.companyName} · MC# {profile?.mcNumber} · Last sync: just now
          </p>
        </div>
        <Link href="/carrier" className="btn-teal">BROWSE JOBS →</Link>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi kpi-teal">
          <div className="kpi-label">Revenue (MTD)</div>
          <div className="kpi-val">${mtdRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="kpi-change up">Net after 8% fee</div>
        </div>
        <div className="kpi kpi-amber">
          <div className="kpi-label">Active Loads</div>
          <div className="kpi-val">{activeLoads.length}</div>
          <div className="kpi-change">In progress now</div>
        </div>
        <div className="kpi kpi-green">
          <div className="kpi-label">Open Bids</div>
          <div className="kpi-val">{openBids}</div>
          <div className="kpi-change">Awaiting selection</div>
        </div>
        <div className="kpi kpi-blue">
          <div className="kpi-label">Total Hauls</div>
          <div className="kpi-val">{profile?.completedHauls ?? 0}</div>
          <div className="kpi-change up">All time</div>
        </div>
      </div>

      {/* Active loads summary */}
      {activeLoads.length > 0 && (
        <div className="section-card">
          <div className="sc-head">
            <span className="sc-title">Active Loads</span>
            <Link href="/carrier/active-loads" className="sc-action">View All →</Link>
          </div>
          {activeLoads.slice(0, 2).map(({ job, listing }) => (
            <div key={job.id} className="load-summary">
              <div className="ls-name">{(listing as CarrierListingSummary).year} {(listing as CarrierListingSummary).make} {(listing as CarrierListingSummary).model}</div>
              <div className="ls-route">{job.pickupAddress} → {job.deliveryAddress}</div>
              <span className={`status-pill sp-${job.status.replace('_', '-')}`}>{job.status.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stripe Connect warning */}
      {!profile?.stripeOnboarded && (
        <div className="stripe-warning">
          <span>⚠ Complete your Stripe Connect setup to receive payouts.</span>
          <a href="/api/carriers/stripe-onboard" className="btn-sm">Set Up Payouts →</a>
        </div>
      )}
    </div>
  )
}
