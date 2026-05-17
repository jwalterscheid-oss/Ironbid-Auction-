// app/auctions/[id]/page.tsx — Auction detail page (Server Component)
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getAuctionById, getBidsByAuction, getUserByClerkId } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
import { BiddingPanel } from '@/components/auction/BiddingPanel'
import { BidHistory }   from '@/components/auction/BidHistory'
import { AuctionTimer } from '@/components/auction/AuctionTimer'
import { GalleryViewer } from '@/components/auction/GalleryViewer'
import { InspectionPanel } from '@/components/auction/InspectionPanel'
import type { Metadata } from 'next'
import { getDevMockState, isMockMode, mockUserIdForRole } from '@/lib/dev-mock'

interface Props { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (isMockMode) {
    const state = getDevMockState()
    const auction = state.auctions.find((a) => a.id === params.id)
    const listing = auction
      ? state.listings.find((l) => l.id === auction.listingId)
      : null

    if (!auction || !listing) return { title: 'Auction | IRONBID' }

    const { year, make, model } = listing
    return {
      title: `${year} ${make} ${model} | IRONBID Auction`,
      description: `Bid on ${year} ${make} ${model} — Lot #${listing.lotNumber}. Current bid: $${Number(auction.currentBid).toLocaleString()}`,
    }
  }

  const auction = await getAuctionById(params.id)
  if (!auction?.listing) return { title: 'Auction | IRONBID' }
  const { year, make, model } = auction.listing
  return {
    title: `${year} ${make} ${model} | IRONBID Auction`,
    description: `Bid on ${year} ${make} ${model} — Lot #${auction.listing.lotNumber}. Current bid: $${Number(auction.currentBid).toLocaleString()}`,
  }
}

export default async function AuctionPage({ params }: Props) {
  if (isMockMode) {
    const state = getDevMockState()
    const auction = state.auctions.find((a) => a.id === params.id)
    if (!auction) notFound()

    const listing = state.listings.find((l) => l.id === auction.listingId)
    if (!listing) notFound()

    const currentUserId = mockUserIdForRole('buyer')
    const recentBids = state.bids
      .filter((b) => b.auctionId === params.id)
      .slice(0, 20)
      .map((b) => ({
        id: b.id,
        auctionId: params.id,
        bidderId: b.bidderId,
        amount: Number(b.amount),
        bidType: b.bidType,
        isWinning: b.isWinning,
        placedAt: b.placedAt,
        bidderMasked: b.bidderId.slice(0, 2).toUpperCase() + '***',
        isCurrentUser: b.bidderId === currentUserId,
      }))

    return (
      <div className="auction-layout">
        <div className="auction-left">
          <Suspense fallback={<div className="gallery-skeleton" />}>
            <GalleryViewer photos={listing.photos ?? []} />
          </Suspense>

          <div className="eq-info">
            <div className="eq-make">{listing.make} · {listing.year}</div>
            <h1 className="eq-title">{listing.year} {listing.make} {listing.model}</h1>
            <div className="eq-lot">Lot #{listing.lotNumber} · Serial: {listing.serialNumber ?? 'N/A'}</div>

            <div className="specs-grid">
              <div className="spec"><span>Hours</span><strong>{listing.hours?.toLocaleString() ?? '—'}</strong></div>
              <div className="spec"><span>Grade</span><strong>{listing.conditionGrade ?? '—'}</strong></div>
              <div className="spec"><span>Location</span><strong>{listing.locationCity ?? '—'}, {listing.locationState ?? '—'}</strong></div>
              <div className="spec"><span>Weight</span><strong>{listing.weightKg ? `${(Number(listing.weightKg) / 1000).toFixed(1)} t` : '—'}</strong></div>
            </div>
          </div>

          <InspectionPanel
            description={listing.description}
            inspectionData={listing.inspectionData}
            documents={[]}
            reportUrl={undefined}
            seller={undefined}
          />
        </div>

        <div className="auction-right">
          <AuctionTimer
            endTime={auction.endTime}
            status={auction.status}
          />

          <BiddingPanel
            auctionId={params.id}
            initialBid={Number(auction.currentBid ?? auction.startingBid)}
            bidCount={auction.bidCount}
            buyersPremiumPct={Number(auction.buyersPremiumPct)}
            reserveMet={auction.reserveMet}
            minIncrement={Number(auction.minIncrement)}
            buyNowPrice={auction.buyNowPrice ? Number(auction.buyNowPrice) : undefined}
            currentUserId={currentUserId}
            currentWinnerId={auction.currentWinnerId ?? undefined}
            isVerified={true}
            realtimeEnabled={false}
          />

          <BidHistory
            auctionId={params.id}
            initialBids={recentBids}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    )
  }

  const [auction, recentBidsRaw] = await Promise.all([
    getAuctionById(params.id),
    getBidsByAuction(params.id, 20),
  ])

  if (!auction) notFound()

  // Get current user (for "is winning" state)
  const { userId: clerkId } = auth()
  const currentUser = clerkId ? await getUserByClerkId(clerkId) : null

  const recentBids = recentBidsRaw.map(r => ({
    id:           r.bid.id,
    auctionId:    params.id,
    bidderId:     r.bid.bidderId,
    amount:       Number(r.bid.amount),
    bidType:      r.bid.bidType,
    isWinning:    r.bid.isWinning,
    placedAt:     r.bid.placedAt instanceof Date ? r.bid.placedAt.toISOString() : r.bid.placedAt,
    bidderMasked: r.bid.bidderId.slice(0, 2).toUpperCase() + '***',
    isCurrentUser: r.bid.bidderId === currentUser?.id,
  }))

  const listing = auction.listing!

  return (
    <div className="auction-layout">
      {/* LEFT — Equipment detail (server-rendered for SEO) */}
      <div className="auction-left">
        <Suspense fallback={<div className="gallery-skeleton" />}>
          <GalleryViewer photos={listing.photos ?? []} />
        </Suspense>

        {/* Equipment meta */}
        <div className="eq-info">
          <div className="eq-make">{listing.make} · {listing.year}</div>
          <h1 className="eq-title">{listing.year} {listing.make} {listing.model}</h1>
          <div className="eq-lot">Lot #{listing.lotNumber} · Serial: {listing.serialNumber}</div>

          <div className="specs-grid">
            <div className="spec"><span>Hours</span><strong>{listing.hours?.toLocaleString()}</strong></div>
            <div className="spec"><span>Grade</span><strong>{listing.conditionGrade}</strong></div>
            <div className="spec"><span>Location</span><strong>{listing.locationCity}, {listing.locationState}</strong></div>
            <div className="spec"><span>Weight</span><strong>{listing.weightKg ? `${(Number(listing.weightKg) / 1000).toFixed(1)} t` : '—'}</strong></div>
          </div>
        </div>

        {/* Description + inspection tabs */}
        <InspectionPanel
          description={listing.description}
          inspectionData={listing.inspectionData}
          documents={listing.documents ?? []}
          reportUrl={listing.inspectionReportUrl}
          seller={auction.listing?.seller}
        />
      </div>

      {/* RIGHT — Live bidding panel (client components) */}
      <div className="auction-right">
        {/* Countdown (client component — ticks every second) */}
        <AuctionTimer
          endTime={auction.endTime instanceof Date ? auction.endTime.toISOString() : auction.endTime}
          status={auction.status}
        />

        {/* Bidding panel — real-time via Ably */}
        <BiddingPanel
          auctionId={params.id}
          initialBid={Number(auction.currentBid ?? auction.startingBid)}
          bidCount={auction.bidCount}
          buyersPremiumPct={Number(auction.buyersPremiumPct)}
          reserveMet={auction.reserveMet}
          minIncrement={Number(auction.minIncrement)}
          buyNowPrice={auction.buyNowPrice ? Number(auction.buyNowPrice) : undefined}
          currentUserId={currentUser?.id}
          currentWinnerId={auction.currentWinnerId ?? undefined}
          isVerified={currentUser?.kycStatus === 'verified'}
        />

        {/* Bid history — real-time feed */}
        <BidHistory
          auctionId={params.id}
          initialBids={recentBids}
          currentUserId={currentUser?.id}
        />
      </div>
    </div>
  )
}
