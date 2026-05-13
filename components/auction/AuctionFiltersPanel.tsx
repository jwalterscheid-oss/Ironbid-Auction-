import Link from 'next/link'
import type { AuctionFilters, Category } from '@/types'

const categories: Array<{ value: Category; label: string }> = [
  { value: 'excavator', label: 'Excavators' },
  { value: 'bulldozer', label: 'Bulldozers' },
  { value: 'crane', label: 'Cranes' },
  { value: 'loader', label: 'Loaders' },
  { value: 'truck', label: 'Trucks' },
  { value: 'aerial', label: 'Aerial' },
  { value: 'compactor', label: 'Compactors' },
  { value: 'skid_steer', label: 'Skid Steers' },
]

export function AuctionFiltersPanel({ currentFilters }: { currentFilters: AuctionFilters }) {
  return (
    <div className="filters-panel">
      <div className="fp-header">
        <h2>Filters</h2>
        <Link href="/auctions">Reset</Link>
      </div>
      <div className="fp-group">
        <div className="fp-label">Category</div>
        <div className="fp-options">
          {categories.map(category => (
            <Link
              key={category.value}
              href={`/auctions?category=${category.value}`}
              className={currentFilters.category === category.value ? 'active' : ''}
            >
              {category.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
