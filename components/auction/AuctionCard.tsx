// components/auction/AuctionCard.tsx — Reusable auction listing card
import Link from 'next/link'
import Image from 'next/image'
import { WatchButton } from './WatchButton'

interface AuctionCardAuction {
  id: string
  status: string
  endTime: string | Date
  startingBid: string | number
  currentBid?: string | number | null
}

interface AuctionCardListing {
  year: number
  make: string
  model: string
  hours?: number | null
  conditionGrade?: string | null
  locationCity?: string | null
  locationState?: string | null
  weightKg?: string | number | null
  photos?: Array<{ url: string }>
}

interface Props { auction: AuctionCardAuction; listing: AuctionCardListing }

const BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: 'LIVE',      cls: 'b-live' },
  extended:  { label: 'ENDING',    cls: 'b-ending' },
  scheduled: { label: 'Upcoming',   cls: 'b-upcoming' },
  closed:    { label: 'Closed',     cls: 'b-closed' },
}

export function AuctionCard({ auction, listing }: Props) {
  const badge    = BADGE[auction.status] ?? BADGE.active
  const photo    = listing.photos?.[0]?.url
  const endTime  = new Date(auction.endTime)
  const isUrgent = endTime.getTime() - Date.now() < 5 * 60 * 1000

  return (
    <Link href={`/auctions/${auction.id}`} className="auction-card">
      <div className="ac-img">
        {photo ? (
          <Image src={photo} alt={`${listing.year} ${listing.make} ${listing.model}`} width={640} height={480} loading="lazy" unoptimized />
        ) : (
          <div className="ac-img-placeholder">IRONBID</div>
        )}
        <div className={`ac-badge ${badge.cls}`}>{badge.label}</div>
        <WatchButton />
      </div>

      <div className="ac-body">
        <div className="ac-make">{listing.make} · {listing.year}</div>
        <div className="ac-name">{listing.year} {listing.make} {listing.model}</div>

        <div className="ac-specs">
          <div className="as-item">
            <span className="as-label">Hours</span>
            <span className="as-val">{listing.hours?.toLocaleString() ?? '—'}</span>
          </div>
          <div className="as-item">
            <span className="as-label">Grade</span>
            <span className={`as-val grade-${listing.conditionGrade}`}>{listing.conditionGrade ?? '—'}</span>
          </div>
          <div className="as-item">
            <span className="as-label">Location</span>
            <span className="as-val">{listing.locationCity}, {listing.locationState}</span>
          </div>
        </div>

        <div className="ac-footer">
          <div className="af-bid">
            <div className="af-bid-label">
              {auction.status === 'closed' ? 'Final Price' : 'Current Bid'}
            </div>
            <div className="af-bid-amount">
              ${Number(auction.currentBid ?? auction.startingBid).toLocaleString()}
            </div>
          </div>
          <div className="af-countdown">
            <div className="af-cd-label">
              {auction.status === 'closed' ? 'Closed' : 'Closes In'}
            </div>
            <div className={`af-cd-time ${isUrgent ? 'urgent' : ''}`}>
              {auction.status === 'closed'
                ? endTime.toLocaleDateString()
                : formatRelative(endTime)}
            </div>
          </div>
        </div>

        <div className="ac-cta">VIEW & BID →</div>
      </div>
    </Link>
  )
}

function formatRelative(date: Date): string {
  const ms = date.getTime() - Date.now()
  if (ms <= 0) return 'Closed'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0)  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}
