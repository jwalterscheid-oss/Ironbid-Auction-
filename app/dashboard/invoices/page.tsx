// app/dashboard/invoices/page.tsx — Buyer invoices (Server Component)
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserByClerkId, getTransactionsByBuyer } from '@/lib/db'
import { PayNowButton } from '@/components/dashboard/PayNowButton'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Invoices | IRONBID' }
export const dynamic = 'force-dynamic'

const PAYMENT_PILL: Record<string, string> = {
  pending:  'sp-amber',
  paid:     'sp-green',
  overdue:  'sp-red',
  refunded: 'sp-fog',
}

interface Props {
  searchParams: { status?: string }
}

export default async function InvoicesPage({ searchParams }: Props) {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/auth/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/onboarding')

  const transactions = await getTransactionsByBuyer(user.id)
  const status = searchParams.status

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing <span>Invoices</span></h1>
          <p className="page-sub">
            {transactions.length} {transactions.length === 1 ? 'invoice' : 'invoices'} · Auction purchase records
          </p>
        </div>
        <Link href="/dashboard" className="btn-ghost">← Back to Dashboard</Link>
      </div>

      {(status === 'success' || status === 'mock') && (
        <div className="kyc-banner" style={{
          borderColor: 'rgba(34,197,94,.38)', background: 'rgba(34,197,94,.1)',
        }}>
          <span style={{ color: 'var(--green)' }}>
            {status === 'mock'
              ? 'Mock payment recorded — your invoice has been marked paid.'
              : 'Payment received. Thank you — your invoice has been marked paid.'}
          </span>
        </div>
      )}
      {status === 'cancelled' && (
        <div className="stripe-warning">
          <span>Payment was cancelled. Your invoice is still outstanding.</span>
        </div>
      )}

      <section className="section-card">
        {transactions.length === 0 ? (
          <div className="empty-state">
            <div className="es-icon">🧾</div>
            <div className="es-title">No invoices yet</div>
            <p style={{ color: 'var(--sand)', fontSize: '14px', marginBottom: '14px' }}>
              Win an auction and your purchase invoices will appear here.
            </p>
            <Link href="/auctions" className="btn-primary">Browse Auctions</Link>
          </div>
        ) : (
          <table className="payout-table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Hammer Price</th>
                <th>Buyer&apos;s Premium</th>
                <th>Total Due</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
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
                    <td>${Number(tx.buyersPremium).toLocaleString()}</td>
                    <td className="pt-amount">${Number(tx.totalDue).toLocaleString()}</td>
                    <td>
                      <span className={`status-pill ${PAYMENT_PILL[tx.paymentStatus] ?? 'sp-fog'}`}>
                        {tx.paymentStatus}
                      </span>
                    </td>
                    <td>
                      {tx.dueDate ? new Date(tx.dueDate).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      {tx.paymentStatus === 'pending'
                        ? <PayNowButton transactionId={tx.id} />
                        : <span style={{ color: 'var(--fog)' }}>—</span>}
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
