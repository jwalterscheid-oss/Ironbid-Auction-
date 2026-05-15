// app/auctions/page.tsx — Auction catalog (Server Component + URL-based filters)
import { getActiveAuctions } from '@/lib/db'
import { AuctionCard } from '@/components/auction/AuctionCard'
import { AuctionFiltersPanel } from '@/components/auction/AuctionFiltersPanel'
import { AuctionSortBar } from '@/components/auction/AuctionSortBar'
import type { AuctionFilters, Category, AuctionStatus } from '@/types'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Browse Auctions | IRONBID',
  description: 'Browse thousands of heavy equipment auctions — excavators, bulldozers, cranes, loaders, and more.',
}

interface Props {
  searchParams: {
    category?: string
    make?: string
    status?: string
    minPrice?: string
    maxPrice?: string
    minYear?: string
    maxYear?: string
    maxHours?: string
    state?: string
    type?: string
    page?: string
    sort?: string
  }
}

export default async function AuctionsPage({ searchParams: sp }: Props) {
  const filters: AuctionFilters = {
    category:      sp.category as Category | undefined,
    make:          sp.make,
    status:        (sp.status as AuctionStatus) ?? 'active',
    minPrice:      sp.minPrice   ? Number(sp.minPrice)   : undefined,
    maxPrice:      sp.maxPrice   ? Number(sp.maxPrice)   : undefined,
    minYear:       sp.minYear    ? Number(sp.minYear)    : undefined,
    maxYear:       sp.maxYear    ? Number(sp.maxYear)    : undefined,
    maxHours:      sp.maxHours   ? Number(sp.maxHours)   : undefined,
    locationState: sp.state,
    page:          sp.page       ? Number(sp.page)       : 1,
    pageSize:      24,
    sort:          (sp.sort as AuctionFilters['sort']) ?? 'ending_soon',
  }

  const { data, total, page, totalPages } = await getActiveAuctions(filters)
  const hasActiveFilters = Boolean(filters.category || filters.make || filters.locationState)

  return (
    <div className="catalog-layout">
      {/* Sidebar filters */}
      <aside className="catalog-sidebar">
        <AuctionFiltersPanel currentFilters={filters} />
      </aside>

      {/* Main content */}
      <div className="catalog-main">
        {/* Sort bar + results count */}
        <AuctionSortBar total={total} currentSort={filters.sort} />

        {/* Active filter chips */}
        <div className="active-filters">
          {filters.category && (
            <FilterChip label={filters.category} param="category" />
          )}
          {filters.make && (
            <FilterChip label={filters.make} param="make" />
          )}
          {filters.locationState && (
            <FilterChip label={filters.locationState} param="state" />
          )}
        </div>

        {/* Grid */}
        {data.length === 0 ? (
          <div className="empty-state catalog-empty">
            <div className="es-icon">🔍</div>
            <div className="es-title">No auctions found</div>
            <p>Try adjusting your filters or jump into a popular category below.</p>

            <div className="catalog-empty-actions">
              <Link href="/auctions" className="btn-primary">Browse all active auctions</Link>
              {hasActiveFilters && (
                <Link href="/auctions" className="btn-ghost">Clear all filters</Link>
              )}
            </div>

            <div className="catalog-empty-cats">
              {[
                { slug: 'excavator', label: 'Excavators' },
                { slug: 'bulldozer', label: 'Bulldozers' },
                { slug: 'loader', label: 'Loaders' },
                { slug: 'truck', label: 'Haul Trucks' },
              ].map((cat) => (
                <Link key={cat.slug} href={`/auctions?category=${cat.slug}`} className="ce-cat">
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="auctions-grid">
            {data.map(({ auction, listing }) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                listing={listing}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination currentPage={page} totalPages={totalPages} />
        )}
      </div>
    </div>
  )
}

function FilterChip({ label, param }: { label: string; param: string }) {
  return (
    <div className="filter-chip">
      {label}
      <a href={`?${param}=`} className="chip-remove">×</a>
    </div>
  )
}

function Pagination({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1)
  return (
    <nav className="pagination">
      {currentPage > 1 && <a href={`?page=${currentPage - 1}`} className="page-btn">‹</a>}
      {pages.map(p => (
        <a key={p} href={`?page=${p}`} className={`page-btn ${p === currentPage ? 'active' : ''}`}>{p}</a>
      ))}
      {currentPage < totalPages && <a href={`?page=${currentPage + 1}`} className="page-btn">›</a>}
    </nav>
  )
}
