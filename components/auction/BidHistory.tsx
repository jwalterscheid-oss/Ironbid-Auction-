// components/auction/BidHistory.tsx — Live bid feed
'use client'
import { useAuction } from '@/hooks/useAuction'
import type { Bid } from '@/types'

interface Props {
  auctionId:     string
  initialBids:   Array<Bid & { bidderMasked: string; isCurrentUser?: boolean }>
  currentUserId?: string
}

type BidHistoryRow = Bid & { bidderMasked?: string; isCurrentUser?: boolean }

export function BidHistory({ auctionId, initialBids, currentUserId }: Props) {
  const { bidHistory } = useAuction(auctionId)
  const bids = bidHistory.length > 0 ? bidHistory : initialBids

  return (
    <div className="bid-history">
      <div className="bh-header">
        <span className="bh-title">Bid History</span>
        <span className="bh-count">{bids.length} bids</span>
      </div>
      <div className="bh-list">
        {bids.map((bid, i) => {
          const historyBid = bid as BidHistoryRow
          const isYou = bid.bidderId === currentUserId
          const masked = historyBid.bidderMasked ?? bid.bidderId.slice(0,2).toUpperCase() + '***'
          return (
            <div key={bid.id} className={`bh-item ${i === 0 ? 'top' : ''} ${isYou ? 'mine' : ''}`}>
              <div className={`bh-avatar ${isYou ? 'you' : ''}`}>
                {isYou ? 'ME' : masked.slice(0,2)}
              </div>
              <div className="bh-info">
                <span className="bh-name">
                  {isYou ? 'You' : masked}
                  {isYou && <span className="you-tag">YOU</span>}
                </span>
                <span className="bh-time">
                  {new Date(bid.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className={`bh-amount ${i === 0 ? 'winning' : ''}`}>
                ${Number(bid.amount).toLocaleString()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
