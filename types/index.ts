// types/index.ts — All shared TypeScript types for IRONBID

// ─── ENUMS ───────────────────────────────────────────────────────────────────

export type UserRole       = 'buyer' | 'seller' | 'dealer' | 'carrier' | 'admin'
export type KycStatus      = 'pending' | 'verified' | 'rejected'
export type ListingStatus  = 'draft' | 'active' | 'sold' | 'withdrawn'
export type Category       = 'excavator' | 'bulldozer' | 'crane' | 'loader' | 'truck' | 'aerial' | 'compactor' | 'skid_steer'
export type ConditionGrade = 'A+' | 'A' | 'B' | 'C' | 'D'
export type AuctionType    = 'timed' | 'live' | 'buy_now'
export type AuctionStatus  = 'scheduled' | 'active' | 'extended' | 'closed' | 'cancelled'
export type BidType        = 'manual' | 'autobid' | 'proxy'
export type PaymentStatus  = 'pending' | 'paid' | 'overdue' | 'refunded'
export type TitleStatus    = 'pending' | 'transferred' | 'filed'
export type TrailerType    = 'rgn' | 'lowboy' | 'step_deck' | 'flatbed' | 'extendable' | 'any'
export type HaulJobStatus  = 'open' | 'bidding' | 'awarded' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
export type HaulBidStatus  = 'active' | 'accepted' | 'withdrawn' | 'expired'
export type TrackingEvent  = 'bol_signed' | 'picked_up' | 'gps_update' | 'near_destination' | 'delivered'
export type FmcsaStatus    = 'active' | 'inactive' | 'revoked'
export type SafetyRating   = 'satisfactory' | 'conditional' | 'unsatisfactory' | 'unrated'

// ─── CORE MODELS ─────────────────────────────────────────────────────────────

export interface User {
  id: string
  clerkId: string
  email: string
  phone?: string
  firstName?: string
  lastName?: string
  role: UserRole
  companyName?: string
  kycStatus: KycStatus
  creditVerified: boolean
  bidLimit?: number
  stripeCustomerId?: string
  sellerRating?: number
  totalSales: number
  isVerifiedDealer: boolean
  avatarUrl?: string
  createdAt: string
  updatedAt?: string
}

export interface ListingPhoto {
  url: string
  order: number
  caption?: string
}

export interface ListingDocument {
  name: string
  url: string
  type: 'title' | 'inspection' | 'service_history' | 'fluid_analysis' | 'other'
}

export interface InspectionData {
  engine?: 'pass' | 'fair' | 'fail'
  hydraulics?: 'pass' | 'fair' | 'fail'
  tracks?: 'pass' | 'fair' | 'fail'
  cab?: 'pass' | 'fair' | 'fail'
  boom?: 'pass' | 'fair' | 'fail'
  bucket?: 'pass' | 'fair' | 'fail'
  electrical?: 'pass' | 'fair' | 'fail'
  cooling?: 'pass' | 'fair' | 'fail'
  [key: string]: 'pass' | 'fair' | 'fail' | undefined
}

export interface Listing {
  id: string
  sellerId: string
  lotNumber?: string
  status: ListingStatus
  category: Category
  make: string
  model: string
  year: number
  serialNumber?: string
  hours?: number
  weightKg?: number
  conditionGrade?: ConditionGrade
  description?: string
  locationCity?: string
  locationState?: string
  photos?: ListingPhoto[]
  inspectionReportUrl?: string
  inspectionData?: InspectionData
  documents?: ListingDocument[]
  createdAt: string
  updatedAt?: string
  // relations
  seller?: User
  auction?: Auction
}

export interface Auction {
  id: string
  listingId: string
  type: AuctionType
  status: AuctionStatus
  startTime: string
  endTime: string
  extendedEndTime?: string
  startingBid: number
  reservePrice?: number
  buyNowPrice?: number
  minIncrement: number
  buyersPremiumPct: number
  currentBid?: number
  currentWinnerId?: string
  bidCount: number
  reserveMet: boolean
  watchCount: number
  viewCount: number
  finalPrice?: number
  winningBidderId?: string
  createdAt: string
  // relations
  listing?: Listing
  currentWinner?: User
  winningBidder?: User
  bids?: Bid[]
  recentBids?: Bid[]
}

export interface Bid {
  id: string
  auctionId: string
  bidderId: string
  amount: number
  bidType: BidType
  isWinning: boolean
  placedAt: string
  // relations
  bidder?: User
}

export interface Transaction {
  id: string
  auctionId: string
  buyerId: string
  sellerId: string
  hammerPrice: number
  buyersPremium: number
  totalDue: number
  platformFee?: number
  sellerProceeds?: number
  paymentMethod?: string
  paymentStatus: PaymentStatus
  stripePaymentIntent?: string
  titleStatus: TitleStatus
  dueDate?: string
  paidAt?: string
  createdAt: string
  // relations
  auction?: Auction
  buyer?: User
  seller?: User
  haulJob?: HaulJob
}

// ─── HAUL / LOGISTICS ────────────────────────────────────────────────────────

export interface HaulJob {
  id: string
  transactionId: string
  buyerId: string
  listingId: string
  status: HaulJobStatus
  pickupAddress: string
  pickupState?: string
  deliveryAddress: string
  deliveryState?: string
  distanceMiles?: number
  trailerType: TrailerType
  specialRequirements: string[]
  notes?: string
  desiredPickupDate?: string
  deliveryDeadline?: string
  maxBudget?: number
  bidWindowHrs: number
  bidCloseTime?: string
  awardedBidId?: string
  awardedCarrierId?: string
  stripePaymentIntent?: string
  createdAt: string
  // relations
  listing?: Listing
  buyer?: User
  haulBids?: HaulBid[]
  awardedCarrier?: CarrierProfile
  tracking?: HaulTracking[]
}

export interface HaulBid {
  id: string
  haulJobId: string
  carrierId: string
  amount: number
  includesPermits: boolean
  includesPilotCar: boolean
  trailerType?: TrailerType
  estimatedPickupDate?: string
  estimatedDeliveryDate?: string
  carrierNotes?: string
  status: HaulBidStatus
  placedAt: string
  // relations
  carrier?: User
  carrierProfile?: CarrierProfile
}

export interface HaulTracking {
  id: string
  haulJobId: string
  eventType: TrackingEvent
  addressApprox?: string
  milesRemaining?: number
  etaUpdated?: string
  notes?: string
  documentUrl?: string
  recordedAt: string
}

export interface CarrierProfile {
  userId: string
  companyName: string
  mcNumber?: string
  dotNumber?: string
  fmcsaStatus: FmcsaStatus
  safetyRating: SafetyRating
  insuranceAmount?: number
  insuranceExpires?: string
  trailerTypes: TrailerType[]
  maxLoadTons?: number
  baseState?: string
  serviceStates: string[]
  avgRating: number
  completedHauls: number
  stripeAccountId?: string
  stripeOnboarded: boolean
  bio?: string
  logoUrl?: string
  verifiedAt?: string
  createdAt: string
  // relations
  user?: User
  reviews?: CarrierReview[]
}

export interface CarrierReview {
  id: string
  haulJobId: string
  reviewerId: string
  carrierId: string
  rating: number
  comment?: string
  createdAt: string
}

// ─── API REQUEST / RESPONSE SHAPES ───────────────────────────────────────────

export interface CreateListingInput {
  category: Category
  make: string
  model: string
  year: number
  serialNumber?: string
  hours?: number
  weightKg?: number
  conditionGrade?: ConditionGrade
  description?: string
  locationCity?: string
  locationState?: string
}

export interface CreateAuctionInput {
  listingId: string
  type: AuctionType
  startTime: string
  endTime: string
  startingBid: number
  reservePrice?: number
  buyNowPrice?: number
  minIncrement: number
  buyersPremiumPct?: number
}

export interface PlaceBidInput {
  auctionId: string
  amount: number
  maxBid?: number  // for autobid
}

export interface PlaceBidResult {
  bid: Bid
  auction: Pick<Auction, 'id' | 'currentBid' | 'bidCount' | 'reserveMet' | 'endTime'>
  isWinning: boolean
  wasExtended: boolean
}

export interface CreateHaulJobInput {
  transactionId: string
  pickupAddress: string
  deliveryAddress: string
  trailerType?: TrailerType
  specialRequirements?: string[]
  notes?: string
  desiredPickupDate?: string
  deliveryDeadline?: string
  maxBudget?: number
  bidWindowHrs?: 6 | 24 | 48 | 72
}

export interface PlaceHaulBidInput {
  haulJobId: string
  amount: number
  includesPermits?: boolean
  includesPilotCar?: boolean
  trailerType?: TrailerType
  estimatedPickupDate?: string
  estimatedDeliveryDate?: string
  carrierNotes?: string
}

export interface CarrierRegisterInput {
  companyName: string
  mcNumber: string
  dotNumber?: string
  trailerTypes: TrailerType[]
  maxLoadTons: number
  baseState: string
  serviceStates: string[]
  insuranceAmount: number
  insuranceExpires: string
  bio?: string
}

// ─── WEBSOCKET EVENT TYPES ────────────────────────────────────────────────────

export type AuctionEventType =
  | 'bid_placed'
  | 'auction_extended'
  | 'auction_closed'
  | 'auction_started'
  | 'outbid_alert'
  | 'you_won'
  | 'watcher_count'

export type HaulEventType =
  | 'haul_bid_received'
  | 'haul_picked_up'
  | 'haul_gps_update'
  | 'haul_near_destination'
  | 'haul_delivered'
  | 'haul_job_posted'
  | 'haul_job_awarded'

export interface AuctionEvent<T = unknown> {
  type: AuctionEventType
  auctionId: string
  timestamp: number
  data: T
}

export interface HaulEvent<T = unknown> {
  type: HaulEventType
  jobId: string
  timestamp: number
  data: T
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface AuctionFilters {
  category?: Category
  make?: string
  status?: AuctionStatus
  minPrice?: number
  maxPrice?: number
  minYear?: number
  maxYear?: number
  maxHours?: number
  conditionGrade?: ConditionGrade[]
  locationState?: string
  auctionType?: AuctionType
  page?: number
  pageSize?: number
  sort?: 'ending_soon' | 'price_asc' | 'price_desc' | 'newest' | 'most_bids' | 'year_desc'
}
