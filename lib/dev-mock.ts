export const isMockMode = process.env.DEV_MOCK_MODE === 'true'

export type MockRole = 'seller' | 'buyer' | 'carrier'

const MOCK_USERS = {
  seller: '11111111-1111-4111-8111-111111111111',
  buyer: '22222222-2222-4222-8222-222222222222',
  carrier: '33333333-3333-4333-8333-333333333333',
} as const

export function mockUserIdForRole(role: MockRole) {
  return MOCK_USERS[role]
}

type MockListing = {
  id: string
  sellerId: string
  lotNumber: string
  status: 'draft' | 'active' | 'sold' | 'withdrawn'
  category: string
  make: string
  model: string
  year: number
  serialNumber?: string
  hours?: number
  weightKg?: number
  conditionGrade?: string
  inspectionData?: Record<string, 'pass' | 'fair' | 'fail'>
  photos?: Array<{ url: string; order: number; caption?: string }>
  description?: string
  locationCity?: string
  locationState?: string
  createdAt: string
}

type MockAuction = {
  id: string
  listingId: string
  type: 'timed' | 'live' | 'buy_now'
  status: 'scheduled' | 'active' | 'extended' | 'closed' | 'cancelled'
  startTime: string
  endTime: string
  startingBid: number
  reservePrice?: number
  buyNowPrice?: number
  minIncrement: number
  buyersPremiumPct: number
  currentBid: number
  currentWinnerId?: string
  bidCount: number
  reserveMet: boolean
  watchCount: number
  viewCount: number
  createdAt: string
}

type MockBid = {
  id: string
  auctionId: string
  bidderId: string
  amount: number
  bidType: 'manual'
  isWinning: boolean
  placedAt: string
}

type MockHaulJob = {
  id: string
  transactionId: string
  buyerId: string
  listingId: string
  status: 'open' | 'bidding' | 'awarded' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
  pickupAddress: string
  deliveryAddress: string
  trailerType: 'rgn' | 'lowboy' | 'step_deck' | 'flatbed' | 'extendable' | 'any'
  specialRequirements: string[]
  notes?: string
  deliveryDeadline?: string
  bidWindowHrs: number
  bidCloseTime: string
  awardedBidId?: string
  awardedCarrierId?: string
  createdAt: string
}

type MockHaulBid = {
  id: string
  haulJobId: string
  carrierId: string
  amount: number
  includesPermits: boolean
  includesPilotCar: boolean
  trailerType?: 'rgn' | 'lowboy' | 'step_deck' | 'flatbed' | 'extendable' | 'any'
  estimatedPickupDate?: string
  estimatedDeliveryDate?: string
  carrierNotes?: string
  status: 'active' | 'accepted' | 'withdrawn' | 'expired'
  placedAt: string
}

type DevMockState = {
  listings: MockListing[]
  auctions: MockAuction[]
  bids: MockBid[]
  haulJobs: MockHaulJob[]
  haulBids: MockHaulBid[]
}

const globalForMock = globalThis as unknown as { devMockState?: DevMockState }

function createInitialState(): DevMockState {
  const now = new Date().toISOString()
  const listingId = crypto.randomUUID()
  const auctionId = crypto.randomUUID()

  return {
    listings: [
      {
        id: listingId,
        sellerId: MOCK_USERS.seller,
        lotNumber: `IB-${new Date().getFullYear()}-00001`,
        status: 'active',
        category: 'excavator',
        make: 'Caterpillar',
        model: '320',
        year: 2019,
        locationCity: 'Dallas',
        locationState: 'TX',
        description: 'Mock listing for local development flow testing.',
        photos: [],
        createdAt: now,
      },
    ],
    auctions: [
      {
        id: auctionId,
        listingId,
        type: 'timed',
        status: 'active',
        startTime: now,
        endTime: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        startingBid: 45000,
        minIncrement: 500,
        buyersPremiumPct: 12,
        currentBid: 45000,
        bidCount: 0,
        reserveMet: false,
        watchCount: 1,
        viewCount: 1,
        createdAt: now,
      },
    ],
    bids: [],
    haulJobs: [],
    haulBids: [],
  }
}

export function getDevMockState() {
  if (!globalForMock.devMockState) {
    globalForMock.devMockState = createInitialState()
  }
  return globalForMock.devMockState
}

export function nextMockLotNumber() {
  const state = getDevMockState()
  const n = state.listings.length + 1
  return `IB-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`
}
