// app/dashboard/listings/[id]/page.tsx — Seller listing detail (Server Component)
import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getUserByClerkId, getListingById, getAuctionByListingId } from '@/lib/db'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Listing Detail | IRONBID' }
export const dynamic = 'force-dynamic'

interface Props { params: { id: string } }

const LISTING_STATUS_PILL: Record<string, string> = {
  draft:     'sp-draft',
  active:    'sp-active',
  sold:      'sp-green',
  withdrawn: 'sp-red',
}

const AUCTION_STATUS_PILL: Record<string, string> = {
  scheduled: 'sp-amber',
  active:    'sp-active',
  extended:  'sp-ending',
  closed:    'sp-fog',
  cancelled: 'sp-red',
}

export default async function ListingDetailPage({ params }: Props) {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/auth/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/onboarding')

  const listing = await getListingById(params.id)
  if (!listing || listing.sellerId !== user.id) notFound()

  const auction = await getAuctionByListingId(listing.id)

  const photos = listing.photos ?? []
  const inspectionEntries = listing.inspectionData
    ? Object.entries(listing.inspectionData as Record<string, string>)
    : []

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {listing.year} <span>{listing.make}</span> {listing.model}
          </h1>
          <p className="page-sub">
            Lot #{listing.lotNumber ?? '—'} · {listing.category}
            {' · '}
            <span className={`status-pill ${LISTING_STATUS_PILL[listing.status] ?? 'sp-fog'}`}>
              {listing.status}
            </span>
          </p>
        </div>
        <Link href="/dashboard/listings" className="btn-ghost">
          ← All Listings
        </Link>
      </div>

      {/* Auction status */}
      {auction && (
        <section className="section-card">
          <div className="sc-head">
            <span className="sc-title">Auction</span>
            <Link href={`/auctions/${auction.id}`} className="sc-action">
              View public auction →
            </Link>
          </div>
          <div className="specs-grid" style={{ padding: '14px' }}>
            <div className="spec">
              <span>Status</span>
              <strong>
                <span className={`status-pill ${AUCTION_STATUS_PILL[auction.status] ?? 'sp-fog'}`}>
                  {auction.status}
                </span>
              </strong>
            </div>
            <div className="spec">
              <span>Current Bid</span>
              <strong>
                ${Number(auction.currentBid ?? auction.startingBid).toLocaleString()}
              </strong>
            </div>
            <div className="spec">
              <span>Bids</span>
              <strong>{auction.bidCount ?? 0}</strong>
            </div>
            <div className="spec">
              <span>Ends</span>
              <strong>
                {auction.endTime ? new Date(auction.endTime).toLocaleString() : '—'}
              </strong>
            </div>
          </div>
        </section>
      )}

      {/* Specs */}
      <section className="section-card">
        <div className="sc-head"><span className="sc-title">Equipment Specs</span></div>
        <div className="specs-grid" style={{ padding: '14px' }}>
          <div className="spec"><span>Year</span><strong>{listing.year}</strong></div>
          <div className="spec"><span>Make</span><strong>{listing.make}</strong></div>
          <div className="spec"><span>Model</span><strong>{listing.model}</strong></div>
          <div className="spec"><span>Category</span><strong>{listing.category}</strong></div>
          <div className="spec"><span>Serial Number</span><strong>{listing.serialNumber ?? '—'}</strong></div>
          <div className="spec">
            <span>Hours</span>
            <strong>{listing.hours != null ? listing.hours.toLocaleString() : '—'}</strong>
          </div>
          <div className="spec">
            <span>Weight</span>
            <strong>
              {listing.weightKg ? `${Number(listing.weightKg).toLocaleString()} kg` : '—'}
            </strong>
          </div>
          <div className="spec">
            <span>Condition Grade</span>
            <strong>{listing.conditionGrade ?? '—'}</strong>
          </div>
          <div className="spec">
            <span>Location</span>
            <strong>
              {[listing.locationCity, listing.locationState].filter(Boolean).join(', ') || '—'}
            </strong>
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="section-card" style={{ padding: '18px' }}>
        <div className="sc-title" style={{ marginBottom: '8px' }}>Description</div>
        <p style={{ color: 'var(--sand)', fontSize: '14px', maxWidth: '70ch' }}>
          {listing.description?.trim() || 'No description provided.'}
        </p>
      </section>

      {/* Inspection */}
      {inspectionEntries.length > 0 && (
        <section className="section-card" style={{ padding: '18px' }}>
          <div className="sc-title" style={{ marginBottom: '10px' }}>Inspection</div>
          <div className="inspection-grid">
            {inspectionEntries.map(([key, value]) => (
              <div key={key} className="inspection-row">
                <span>{key}</span>
                <strong>{String(value)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Photos */}
      <section className="section-card" style={{ padding: '18px' }}>
        <div className="sc-title" style={{ marginBottom: '10px' }}>
          Photos {photos.length > 0 ? `(${photos.length})` : ''}
        </div>
        {photos.length === 0 ? (
          <p style={{ color: 'var(--fog)', fontSize: '13px' }}>No photos uploaded.</p>
        ) : (
          <div className="photo-preview-grid">
            {photos
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((photo, i) => (
                <div key={`${photo.url}-${i}`} className="photo-thumb">
                  <Image
                    src={photo.url}
                    alt={photo.caption ?? `Photo ${i + 1}`}
                    width={320}
                    height={240}
                    unoptimized
                  />
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  )
}
