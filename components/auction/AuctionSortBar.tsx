import Link from 'next/link'
import type { AuctionFilters } from '@/types'

const options: Array<{ value: NonNullable<AuctionFilters['sort']>; label: string }> = [
  { value: 'ending_soon', label: 'Ending Soon' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
  { value: 'most_bids', label: 'Most Bids' },
  { value: 'year_desc', label: 'Newest Equipment' },
]

export function AuctionSortBar({ total, currentSort }: { total: number; currentSort?: AuctionFilters['sort'] }) {
  return (
    <div className="auction-sort-bar">
      <div className="asb-total">{total.toLocaleString()} results</div>
      <div className="asb-options">
        {options.map(option => (
          <Link
            key={option.value}
            href={`/auctions?sort=${option.value}`}
            className={currentSort === option.value ? 'active' : ''}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
