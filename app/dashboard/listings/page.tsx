// app/dashboard/listings/page.tsx — Seller listings (Server Component)
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserByClerkId, getListingsBySeller } from '@/lib/db'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'My Listings | IRONBID' }
export const dynamic = 'force-dynamic'

const STATUS_PILL: Record<string, string> = {
  draft:     'sp-draft',
  active:    'sp-active',
  sold:      'sp-green',
  withdrawn: 'sp-red',
}

export default async function ListingsPage() {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/auth/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/onboarding')

  const listings = await getListingsBySeller(user.id)

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">My <span>Listings</span></h1>
          <p className="page-sub">
            {listings.length} {listings.length === 1 ? 'lot' : 'lots'} · Manage your active and draft lots
          </p>
        </div>
        <Link href="/dashboard/listings/new" className="btn-primary">
          + NEW LISTING
        </Link>
      </div>

      <section className="section-card">
        {listings.length === 0 ? (
          <div className="empty-state">
            <div className="es-icon">📦</div>
            <div className="es-title">No listings yet</div>
            <p style={{ color: 'var(--sand)', fontSize: '14px', marginBottom: '14px' }}>
              Launch your first auction to start selling equipment on IRONBID.
            </p>
            <Link href="/dashboard/listings/new" className="btn-primary">
              + NEW LISTING
            </Link>
          </div>
        ) : (
          <table className="payout-table">
            <thead>
              <tr>
                <th>Lot</th>
                <th>Equipment</th>
                <th>Category</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing.id}>
                  <td>
                    <Link href={`/dashboard/listings/${listing.id}`} style={{ color: 'var(--amber)' }}>
                      {listing.lotNumber ?? 'Draft'}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/dashboard/listings/${listing.id}`} className="bt-name">
                      {listing.year} {listing.make} {listing.model}
                    </Link>
                  </td>
                  <td>{listing.category}</td>
                  <td>
                    <span className={`status-pill ${STATUS_PILL[listing.status] ?? 'sp-fog'}`}>
                      {listing.status}
                    </span>
                  </td>
                  <td>
                    {listing.createdAt
                      ? new Date(listing.createdAt).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
