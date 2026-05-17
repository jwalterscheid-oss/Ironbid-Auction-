// app/dashboard/earnings/page.tsx — Seller earnings summary (Server Component)
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserByClerkId, getTransactionsBySeller } from '@/lib/db'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Earnings | IRONBID' }
export const dynamic = 'force-dynamic'

const PAYMENT_PILL: Record<string, string> = {
  pending:  'sp-amber',
  paid:     'sp-green',
  overdue:  'sp-red',
  refunded: 'sp-fog',
}

function formatMoney(value: number) {
  return `$${Math.round(value).toLocaleString()}`
}

export default async function EarningsPage() {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/auth/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/onboarding')

  const transactions = await getTransactionsBySeller(user.id)

  const paid = transactions.filter((t) => t.paymentStatus === 'paid')
  const pendingCount = transactions.filter((t) => t.paymentStatus === 'pending').length

  const totalGross = paid.reduce((s, t) => s + Number(t.hammerPrice), 0)
  const totalFees = paid.reduce((s, t) => s + Number(t.platformFee ?? 0), 0)
  const totalNet = paid.reduce((s, t) => s + Number(t.sellerProceeds ?? 0), 0)

  const recentSales = paid.slice(0, 8)

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Seller <span>Earnings</span></h1>
          <p className="page-sub">Revenue, fees, and net proceeds</p>
        </div>
        <Link href="/dashboard/payouts" className="btn-ghost">View Payouts</Link>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Gross Sales</div>
          <div className="kpi-val">{formatMoney(totalGross)}</div>
          <div className="kpi-ghost">$</div>
        </div>
        <div className="kpi kpi-amber">
          <div className="kpi-label">Platform Fees</div>
          <div className="kpi-val">{formatMoney(totalFees)}</div>
          <div className="kpi-ghost">FEE</div>
        </div>
        <div className="kpi kpi-green">
          <div className="kpi-label">Net Proceeds</div>
          <div className="kpi-val">{formatMoney(totalNet)}</div>
          <div className="kpi-ghost">NET</div>
        </div>
        <div className="kpi kpi-blue">
          <div className="kpi-label">Completed Sales</div>
          <div className="kpi-val">{paid.length}</div>
          <div className="kpi-change">{pendingCount} pending</div>
          <div className="kpi-ghost">SOLD</div>
        </div>
      </div>

      {/* Recent sales */}
      <section className="section-card">
        <div className="sc-head"><span className="sc-title">Recent Sales</span></div>
        {recentSales.length === 0 ? (
          <div className="empty-state">
            <div className="es-icon">📈</div>
            <div className="es-title">No completed sales yet</div>
            <p style={{ color: 'var(--sand)', fontSize: '14px', marginBottom: '14px' }}>
              Once buyers pay for your won auctions, your earnings appear here.
            </p>
            <Link href="/dashboard/listings/new" className="btn-primary">+ NEW LISTING</Link>
          </div>
        ) : (
          <table className="payout-table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Hammer Price</th>
                <th>Platform Fee</th>
                <th>Net Proceeds</th>
                <th>Status</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((tx) => {
                const listing = tx.auction?.listing
                return (
                  <tr key={tx.id}>
                    <td>
                      <span className="bt-name">
                        {listing
                          ? `${listing.year} ${listing.make} ${listing.model}`
                          : 'Equipment'}
                      </span>
                      {listing?.lotNumber && (
                        <div className="bt-route">Lot #{listing.lotNumber}</div>
                      )}
                    </td>
                    <td>${Number(tx.hammerPrice).toLocaleString()}</td>
                    <td>${Number(tx.platformFee ?? 0).toLocaleString()}</td>
                    <td className="pt-amount">
                      ${Number(tx.sellerProceeds ?? 0).toLocaleString()}
                    </td>
                    <td>
                      <span className={`status-pill ${PAYMENT_PILL[tx.paymentStatus] ?? 'sp-fog'}`}>
                        {tx.paymentStatus}
                      </span>
                    </td>
                    <td>
                      {tx.closedAt
                        ? new Date(tx.closedAt).toLocaleDateString()
                        : tx.paidAt
                        ? new Date(tx.paidAt).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
