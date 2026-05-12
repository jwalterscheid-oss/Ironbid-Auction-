// components/auction/AuctionTimer.tsx
'use client'
import { useCountdown, formatCountdown } from '@/hooks/useHaulJob'

export function AuctionTimer({ endTime, status }: { endTime: string; status: string }) {
  const cd = useCountdown(endTime)
  const isClosed = status === 'closed' || status === 'cancelled' || cd.isExpired
  return (
    <div className={`countdown-block ${cd.isUrgent ? 'urgent' : ''}`}>
      <div className="cd-label">{isClosed ? 'Auction Ended' : 'Closes In'}</div>
      <div className={`cd-timer ${cd.isUrgent ? 'red' : ''}`}>
        {isClosed ? 'CLOSED' : formatCountdown(cd)}
      </div>
      {!isClosed && (
        <div className="cd-sub">
          {new Date(endTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
        </div>
      )}
    </div>
  )
}
