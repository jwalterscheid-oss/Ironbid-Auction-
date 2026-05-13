// app/carrier/my-bids/page.tsx — Carrier's submitted haul bids
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getUserByClerkId, getHaulBidsByCarrier } from '@/lib/db'
import { WithdrawBidButton } from '@/components/carrier/WithdrawBidButton'
import type { Metadata } from 'next'

interface ListingSummary {
  year: number
  make: string
  model: string
}

interface JobWithOptionalBids {
  haulBids?: Array<{ amount: string | number }>
}

export const metadata: Metadata = { title: 'My Bids | IRONBID Carrier' }
export const dynamic = 'force-dynamic'

export default async function MyBidsPage() {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/sign-in')

  const allBids = await getHaulBidsByCarrier(user.id)
  const active  = allBids.filter(r => r.bid.status === 'active')
  const others  = allBids.filter(r => r.bid.status !== 'active')

  return (
    <div className="my-bids-page">
      <div className="page-header">
        <h1 className="page-title">My <span>Bids</span></h1>
        <p className="page-sub">{active.length} active · {others.filter(r => r.bid.status === 'accepted').length} accepted</p>
      </div>

      <div className="section-card">
        <div className="sc-head"><span className="sc-title">Active Bids</span></div>
        {active.length === 0 ? (
          <div className="empty-inline">No active bids</div>
        ) : (
          <table className="bids-table">
            <thead>
              <tr>
                <th>Equipment / Route</th>
                <th>My Bid</th>
                <th>Lowest Bid</th>
                <th>Status</th>
                <th>Closes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {active.map(({ bid, job, listing }) => {
                const allJobBids = (job as JobWithOptionalBids).haulBids ?? []
                const lowest     = allJobBids.length > 0
                  ? Math.min(...allJobBids.map(b => Number(b.amount)))
                  : null
                const isLowest   = lowest !== null && Number(bid.amount) === lowest
                const equipment = listing as ListingSummary

                return (
                  <tr key={bid.id}>
                    <td>
                      <div className="bt-name">
                        {equipment.year} {equipment.make} {equipment.model}
                      </div>
                      <div className="bt-route">
                        {job.pickupAddress} → {job.deliveryAddress}
                      </div>
                    </td>
                    <td className="bid-amount">${Number(bid.amount).toLocaleString()}</td>
                    <td className={isLowest ? 'lowest' : 'outbid'}>
                      {lowest !== null ? `$${lowest.toLocaleString()}${isLowest ? ' ★' : ''}` : '—'}
                    </td>
                    <td>
                      <span className={isLowest ? 'bp-lowest' : 'bp-outbid'}>
                        {isLowest ? '● Lowest' : '● Outbid'}
                      </span>
                    </td>
                    <td>
                      {job.bidCloseTime
                        ? new Date(job.bidCloseTime).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>
                      <WithdrawBidButton bidId={bid.id} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {others.length > 0 && (
        <div className="section-card" style={{ marginTop: 2 }}>
          <div className="sc-head"><span className="sc-title">Bid History</span></div>
          <table className="bids-table">
            <thead>
              <tr><th>Equipment</th><th>Amount</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {others.map(({ bid, listing }) => (
                <tr key={bid.id}>
                  <td>{(listing as ListingSummary).year} {(listing as ListingSummary).make} {(listing as ListingSummary).model}</td>
                  <td>${Number(bid.amount).toLocaleString()}</td>
                  <td><span className={`bp-${bid.status}`}>{bid.status}</span></td>
                  <td>{new Date(bid.placedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
