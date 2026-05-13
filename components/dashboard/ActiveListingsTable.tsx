import Link from 'next/link'

type ListingRow = {
  id: string
  lotNumber?: string | null
  year: number
  make: string
  model: string
  status: string
}

export function ActiveListingsTable({ listings }: { listings: ListingRow[] }) {
  return (
    <div className="active-listings-table">
      <div className="alt-header">
        <h2>Active Listings</h2>
      </div>
      <div className="alt-body">
        {listings.length === 0 ? (
          <p>No listings yet.</p>
        ) : (
          listings.map(listing => (
            <Link key={listing.id} href={`/dashboard/listings/${listing.id}`} className="alt-row">
              <span>{listing.lotNumber ?? 'Draft'}</span>
              <strong>{listing.year} {listing.make} {listing.model}</strong>
              <span>{listing.status}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
