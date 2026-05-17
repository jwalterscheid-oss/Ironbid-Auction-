// app/dashboard/payouts/page.tsx — Seller payouts (Server Component)
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserByClerkId, getTransactionsBySeller } from '@/lib/db'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Payouts | IRONBID' }
export const dynamic = 'force-dynamic'

const PAYMENT_PILL: Record<string, string> = {
  pending:  'sp-amber',
  paid:     'sp-green',
  overdue:  'sp-red',
  refunded: 'sp-fog',
}

interface Props {
  searchParams: { stripe?: string }
}

export default async function PayoutsPage({ searchParams }: Props) {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/auth/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/onboarding')

  const transactions = await getTransactionsBySeller(user.id)
  const onboarded = user.stripeConnectOnboarded === true
  const stripe = searchParams.stripe

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payout <span>Center</span></h1>
          <p className="page-sub">
            {transactions.length} {transactions.length === 1 ? 'sale' : 'sales'} · Disbursement tracking
          </p>
        </div>
        <Link href="/dashboard/earnings" className="btn-ghost">View Earnings</Link>
      </div>

      {stripe === 'return' && (
        <div className="kyc-banner" style={{
          borderColor: 'rgba(34,197,94,.38)', background: 'rgba(34,197,94,.1)',
        }}>
          <span style={{ color: 'var(--green)' }}>
            Returned from Stripe. Your payout account details have been updated.
          </span>
        </div>
      )}
      {stripe === 'refresh' && (
        <div className="stripe-warning">
          <span>Your Stripe onboarding session expired. Please restart payout setup.</span>
          <a href="/api/sellers/stripe-onboard">Restart Setup</a>
        </div>
      )}

      {/* Stripe Connect status */}
      <section className="section-card" style={{ padding: '18px' }}>
        <div className="sc-title" style={{ marginBottom: '8px' }}>Payout Account</div>
        {onboarded ? (
          <div className="status-bar winning">
            <span className="sb-dot" />
            Payouts enabled
          </div>
        ) : (
          <div className="stripe-warning">
            <span>
              Set up your Stripe payout account to receive proceeds from completed sales.
            </span>
            <a href="/api/sellers/stripe-onboard">Set up payouts</a>
          </div>
        )}
      </section>

      <section className="section-card">
        {transactions.length === 0 ? (
          <div className="empty-state">
            <div className="es-icon">💵</div>
            <div className="es-title">No payouts yet</div>
            <p style={{ color: 'var(--sand)', fontSize: '14px', marginBottom: '14px' }}>
              When your auctions sell, seller proceeds and payout status appear here.
            </p>
            <Link href="/dashboard/listings/new" className="btn-primary">+ NEW LISTING</Link>
          </div>
        ) : (
          <table className="payout-table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Seller Proceeds</th>
                <th>Payment Status</th>
                <th>Payout Status</th>
                <th>Paid Out</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const listing = tx.auction?.listing
                const paidOut = !!tx.sellerPayoutId
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
                    <td className="pt-amount">
                      ${Number(tx.sellerProceeds ?? 0).toLocaleString()}
                    </td>
                    <td>
                      <span className={`status-pill ${PAYMENT_PILL[tx.paymentStatus] ?? 'sp-fog'}`}>
                        {tx.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${paidOut ? 'sp-green' : 'sp-amber'}`}>
                        {paidOut ? 'Paid out' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      {tx.sellerPaidAt
                        ? new Date(tx.sellerPaidAt).toLocaleDateString()
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
