// app/carrier/earnings/page.tsx — Carrier earnings & payout history
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getUserByClerkId, getCarrierEarnings, getCarrierProfile } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import type { Metadata } from 'next'

interface EarningsListingSummary {
  make?: string
  model?: string
}

export const metadata: Metadata = { title: 'Earnings | IRONBID Carrier' }
export const dynamic = 'force-dynamic'

export default async function CarrierEarningsPage() {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/sign-in')

  const [profile, earnings] = await Promise.all([
    getCarrierProfile(user.id),
    getCarrierEarnings(user.id),
  ])

  // Get Stripe balance if onboarded
  let pendingBalance = 0
  if (profile?.stripeAccountId && profile.stripeOnboarded) {
    const balance = await stripe.balance.retrieve({ stripeAccount: profile.stripeAccountId })
    pendingBalance = balance.pending.reduce((s, b) => s + b.amount, 0) / 100
  }

  // Monthly grouping
  const byMonth: Record<string, number> = {}
  for (const { job, bid } of earnings.completed) {
    const month = new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    byMonth[month] = (byMonth[month] ?? 0) + Number(bid.amount) * 0.92
  }

  return (
    <div className="earnings-page">
      <div className="page-header">
        <h1 className="page-title">Earnings & <span>Payouts</span></h1>
        <p className="page-sub">Stripe Connect · {profile?.companyName}</p>
      </div>

      {/* Stripe Connect status */}
      {profile?.stripeAccountId ? (
        <div className="stripe-banner connected">
          <div className="sb-left">
            <span className="sb-icon">💳</span>
            <div>
              <div className="sb-title">Stripe Connect — {profile.stripeOnboarded ? 'Verified ✓' : 'Setup Incomplete'}</div>
              <div className="sb-desc">Payouts sent within 1 business day of delivery confirmation</div>
            </div>
          </div>
          <a href="/api/carriers/stripe-onboard" className="stripe-btn">Manage Payout Settings →</a>
        </div>
      ) : (
        <div className="stripe-banner warning">
          <div className="sb-left">
            <span className="sb-icon">⚠️</span>
            <div>
              <div className="sb-title">Set Up Payouts to Receive Earnings</div>
              <div className="sb-desc">Connect your bank account via Stripe to receive haul payments</div>
            </div>
          </div>
          <a href="/api/carriers/stripe-onboard" className="stripe-btn setup">Set Up Payouts →</a>
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi kpi-teal">
          <div className="kpi-label">Total Earned (All Time)</div>
          <div className="kpi-val">${earnings.totalNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="kpi-change up">Net after 8% platform fee</div>
        </div>
        <div className="kpi kpi-amber">
          <div className="kpi-label">Pending Payout</div>
          <div className="kpi-val">${pendingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="kpi-change">In transit or awaiting delivery</div>
        </div>
        <div className="kpi kpi-green">
          <div className="kpi-label">Platform Fee (8%)</div>
          <div className="kpi-val">${earnings.platformFee.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="kpi-change">Total fees paid to IRONBID</div>
        </div>
        <div className="kpi kpi-blue">
          <div className="kpi-label">Completed Hauls</div>
          <div className="kpi-val">{earnings.completed.length}</div>
          <div className="kpi-change up">All time</div>
        </div>
      </div>

      {/* Monthly breakdown */}
      {Object.keys(byMonth).length > 0 && (
        <div className="section-card">
          <div className="sc-head"><span className="sc-title">Monthly Revenue</span></div>
          <div className="monthly-table-wrap">
            <table className="payout-table">
              <thead><tr><th>Month</th><th>Net Revenue</th><th>Hauls</th></tr></thead>
              <tbody>
                {Object.entries(byMonth).reverse().map(([month, net]) => (
                  <tr key={month}>
                    <td>{month}</td>
                    <td className="pt-amount">${net.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td>{earnings.completed.filter(r =>
                      new Date(r.job.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) === month
                    ).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Individual payout history */}
      <div className="section-card">
        <div className="sc-head"><span className="sc-title">Payout History</span></div>
        {earnings.completed.length === 0 ? (
          <div className="empty-inline">No completed hauls yet</div>
        ) : (
          <table className="payout-table">
            <thead><tr><th>Equipment</th><th>Route</th><th>Gross</th><th>Net (92%)</th><th>Date</th></tr></thead>
            <tbody>
              {earnings.completed.map(({ job, bid }) => (
                <tr key={job.id}>
                  <td style={{ fontFamily: 'inherit', fontSize: 12 }}>
                    {((job as unknown as { listing?: EarningsListingSummary }).listing?.make ?? 'Equipment')} {((job as unknown as { listing?: EarningsListingSummary }).listing?.model ?? '')}
                  </td>
                  <td style={{ fontFamily: 'inherit', fontSize: 11, color: 'var(--fog)' }}>
                    {job.pickupState} → {job.deliveryState}
                  </td>
                  <td>${Number(bid.amount).toLocaleString()}</td>
                  <td className="pt-amount">${(Number(bid.amount) * 0.92).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td>{new Date(job.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
