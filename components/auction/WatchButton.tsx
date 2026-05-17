// components/auction/WatchButton.tsx — Client-side watch toggle for AuctionCard
'use client'

export function WatchButton() {
  return (
    <button
      className="ac-watch"
      onClick={e => { e.preventDefault() }}
      aria-label="Watch"
    >
      ♡
    </button>
  )
}
