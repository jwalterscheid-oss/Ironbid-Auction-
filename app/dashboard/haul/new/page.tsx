// app/dashboard/haul/new/page.tsx — "Request a Haul" creation page (Server Component)
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getUserByClerkId, getTransactionsByBuyer, getHaulJobsByBuyer } from '@/lib/db'
import { RequestHaulForm, type EligibleTransaction } from '@/components/haul/RequestHaulForm'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Request a Haul | IRONBID' }
export const dynamic = 'force-dynamic'

export default async function RequestHaulPage() {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/auth/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/onboarding')

  const [transactions, jobs] = await Promise.all([
    getTransactionsByBuyer(user.id),
    getHaulJobsByBuyer(user.id),
  ])

  // Transactions that already have a haul job posted against them.
  const usedTransactionIds = new Set(jobs.map(j => j.transactionId))

  const eligible: EligibleTransaction[] = transactions
    .filter(tx => tx.paymentStatus === 'paid' && !usedTransactionIds.has(tx.id))
    .map(tx => {
      const listing = tx.auction?.listing
      const label = listing
        ? `${listing.year} ${listing.make} ${listing.model}${listing.lotNumber ? ` · Lot ${listing.lotNumber}` : ''}`
        : `Transaction ${tx.id.slice(0, 8).toUpperCase()}`
      return { id: tx.id, label }
    })

  return (
    <div className="new-listing-page">
      <div className="nl-header">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div>
            <h1 className="page-title">Request a <span>Haul</span></h1>
            <p className="page-sub">Post a haul job and collect competitive carrier bids</p>
          </div>
          <Link href="/dashboard/haul" className="btn-ghost">Back to Haul Jobs</Link>
        </div>
      </div>

      {eligible.length === 0 ? (
        <div className="nl-card">
          <div className="empty-state">
            <div className="es-icon">🚛</div>
            <div className="es-title">No purchases ready to ship</div>
            <p style={{ color: 'var(--fog)', fontSize: '13px' }}>
              Once you win an auction and complete payment, your purchase will appear here so you
              can request transport. Purchases that already have a haul job are not shown.
            </p>
            <div style={{ marginTop: '14px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <Link href="/auctions" className="btn-primary">Browse Auctions</Link>
              <Link href="/dashboard/haul" className="btn-ghost">My Haul Jobs</Link>
            </div>
          </div>
        </div>
      ) : (
        <RequestHaulForm transactions={eligible} />
      )}
    </div>
  )
}
