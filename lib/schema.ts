// lib/schema.ts — Drizzle ORM schema (PostgreSQL)
import {
  pgTable, uuid, varchar, text, boolean, integer, smallint,
  numeric, timestamp, date, pgEnum, jsonb, index, uniqueIndex
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// ─── ENUMS ───────────────────────────────────────────────

export const userRoleEnum       = pgEnum('user_role', ['buyer','seller','dealer','carrier','admin'])
export const kycStatusEnum      = pgEnum('kyc_status', ['pending','verified','rejected'])
export const listingStatusEnum  = pgEnum('listing_status', ['draft','active','sold','withdrawn'])
export const categoryEnum       = pgEnum('category', ['excavator','bulldozer','crane','loader','truck','aerial','compactor','skid_steer'])
export const conditionGradeEnum = pgEnum('condition_grade', ['A+','A','B','C','D'])
export const auctionTypeEnum    = pgEnum('auction_type', ['timed','live','buy_now'])
export const auctionStatusEnum  = pgEnum('auction_status', ['scheduled','active','extended','closed','cancelled'])
export const bidTypeEnum        = pgEnum('bid_type', ['manual','autobid','proxy'])
export const paymentStatusEnum  = pgEnum('payment_status', ['pending','paid','overdue','refunded'])
export const titleStatusEnum    = pgEnum('title_status', ['pending','transferred','filed'])
export const trailerTypeEnum    = pgEnum('trailer_type', ['rgn','lowboy','step_deck','flatbed','extendable','any'])
export const haulJobStatusEnum  = pgEnum('haul_job_status', ['open','bidding','awarded','picked_up','in_transit','delivered','cancelled'])
export const haulBidStatusEnum  = pgEnum('haul_bid_status', ['active','accepted','withdrawn','expired'])
export const trackingEventEnum  = pgEnum('tracking_event', ['bol_signed','picked_up','gps_update','near_destination','delivered'])
export const fmcsaStatusEnum    = pgEnum('fmcsa_status', ['active','inactive','revoked'])
export const safetyRatingEnum   = pgEnum('safety_rating', ['satisfactory','conditional','unsatisfactory','unrated'])

// ─── USERS ───────────────────────────────────────────────

export const users = pgTable('users', {
  id:                uuid('id').defaultRandom().primaryKey(),
  clerkId:           varchar('clerk_id', { length: 100 }).notNull().unique(),
  email:             varchar('email', { length: 255 }).notNull().unique(),
  phone:             varchar('phone', { length: 20 }),
  firstName:         varchar('first_name', { length: 100 }),
  lastName:          varchar('last_name', { length: 100 }),
  role:              userRoleEnum('role').notNull().default('buyer'),
  companyName:       varchar('company_name', { length: 255 }),
  kycStatus:         kycStatusEnum('kyc_status').notNull().default('pending'),
  creditVerified:    boolean('credit_verified').default(false),
  bidLimit:          numeric('bid_limit', { precision: 14, scale: 2 }),
  stripeCustomerId:  varchar('stripe_customer_id', { length: 100 }),
  // Seller payout account (Stripe Connect Express). Distinct from the
  // carrier Connect account stored on carrier_profiles.
  stripeConnectAccountId:  varchar('stripe_connect_account_id', { length: 100 }),
  stripeConnectOnboarded:  boolean('stripe_connect_onboarded').default(false),
  // Stripe Identity verification session correlation.
  stripeIdentitySessionId: varchar('stripe_identity_session_id', { length: 100 }),
  sellerRating:      numeric('seller_rating', { precision: 3, scale: 2 }),
  totalSales:        integer('total_sales').default(0),
  isVerifiedDealer:  boolean('is_verified_dealer').default(false),
  avatarUrl:         text('avatar_url'),
  // Soft-delete marker. Set when the Clerk account is deleted; gates auth.
  disabledAt:        timestamp('disabled_at', { withTimezone: true }),
  createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  clerkIdx: index('users_clerk_idx').on(t.clerkId),
  emailIdx: index('users_email_idx').on(t.email),
}))

// ─── LISTINGS ────────────────────────────────────────────

export const listings = pgTable('listings', {
  id:                   uuid('id').defaultRandom().primaryKey(),
  sellerId:             uuid('seller_id').notNull().references(() => users.id),
  lotNumber:            varchar('lot_number', { length: 20 }).unique(),
  status:               listingStatusEnum('status').notNull().default('draft'),
  category:             categoryEnum('category').notNull(),
  make:                 varchar('make', { length: 100 }).notNull(),
  model:                varchar('model', { length: 100 }).notNull(),
  year:                 smallint('year').notNull(),
  serialNumber:         varchar('serial_number', { length: 100 }).unique(),
  hours:                integer('hours'),
  weightKg:             numeric('weight_kg', { precision: 10, scale: 2 }),
  conditionGrade:       conditionGradeEnum('condition_grade'),
  description:          text('description'),
  locationCity:         varchar('location_city', { length: 100 }),
  locationState:        varchar('location_state', { length: 50 }),
  photos:               jsonb('photos').$type<Array<{ url: string; order: number; caption?: string }>>(),
  inspectionReportUrl:  text('inspection_report_url'),
  inspectionData:       jsonb('inspection_data'),
  documents:            jsonb('documents').$type<Array<{ name: string; url: string; type: string }>>(),
  createdAt:            timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  sellerIdx:   index('listings_seller_idx').on(t.sellerId),
  statusIdx:   index('listings_status_idx').on(t.status),
  categoryIdx: index('listings_category_idx').on(t.category),
}))

// ─── AUCTIONS ────────────────────────────────────────────

export const auctions = pgTable('auctions', {
  id:                uuid('id').defaultRandom().primaryKey(),
  listingId:         uuid('listing_id').notNull().references(() => listings.id).unique(),
  type:              auctionTypeEnum('type').notNull(),
  status:            auctionStatusEnum('status').notNull().default('scheduled'),
  startTime:         timestamp('start_time', { withTimezone: true }).notNull(),
  endTime:           timestamp('end_time', { withTimezone: true }).notNull(),
  extendedEndTime:   timestamp('extended_end_time', { withTimezone: true }),
  startingBid:       numeric('starting_bid', { precision: 14, scale: 2 }).notNull(),
  reservePrice:      numeric('reserve_price', { precision: 14, scale: 2 }),
  buyNowPrice:       numeric('buy_now_price', { precision: 14, scale: 2 }),
  minIncrement:      numeric('min_increment', { precision: 14, scale: 2 }).notNull(),
  buyersPremiumPct:  numeric('buyers_premium_pct', { precision: 5, scale: 2 }).notNull().default('12.00'),
  currentBid:        numeric('current_bid', { precision: 14, scale: 2 }),
  currentWinnerId:   uuid('current_winner_id').references(() => users.id),
  bidCount:          integer('bid_count').default(0),
  reserveMet:        boolean('reserve_met').default(false),
  watchCount:        integer('watch_count').default(0),
  viewCount:         integer('view_count').default(0),
  finalPrice:        numeric('final_price', { precision: 14, scale: 2 }),
  winningBidderId:   uuid('winning_bidder_id').references(() => users.id),
  createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  statusIdx: index('auctions_status_idx').on(t.status),
  endIdx:    index('auctions_end_idx').on(t.endTime),
}))

// ─── BIDS ────────────────────────────────────────────────

export const bids = pgTable('bids', {
  id:        uuid('id').defaultRandom().primaryKey(),
  auctionId: uuid('auction_id').notNull().references(() => auctions.id),
  bidderId:  uuid('bidder_id').notNull().references(() => users.id),
  amount:    numeric('amount', { precision: 14, scale: 2 }).notNull(),
  maxBid:    numeric('max_bid', { precision: 14, scale: 2 }),      // encrypted
  bidType:   bidTypeEnum('bid_type').notNull().default('manual'),
  isWinning: boolean('is_winning').default(false),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  placedAt:  timestamp('placed_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  auctionIdx: index('bids_auction_idx').on(t.auctionId),
  bidderIdx:  index('bids_bidder_idx').on(t.bidderId),
  winningIdx: index('bids_winning_idx').on(t.isWinning),
  // At most one winning bid per auction — enforced at the DB level.
  oneWinnerIdx: uniqueIndex('bids_one_winner_idx')
    .on(t.auctionId)
    .where(sql`${t.isWinning} = true`),
}))

// ─── TRANSACTIONS ────────────────────────────────────────

export const transactions = pgTable('transactions', {
  id:                  uuid('id').defaultRandom().primaryKey(),
  auctionId:           uuid('auction_id').notNull().references(() => auctions.id).unique(),
  buyerId:             uuid('buyer_id').notNull().references(() => users.id),
  sellerId:            uuid('seller_id').notNull().references(() => users.id),
  hammerPrice:         numeric('hammer_price', { precision: 14, scale: 2 }).notNull(),
  buyersPremium:       numeric('buyers_premium', { precision: 14, scale: 2 }).notNull(),
  totalDue:            numeric('total_due', { precision: 14, scale: 2 }).notNull(),
  platformFee:         numeric('platform_fee', { precision: 14, scale: 2 }),
  sellerProceeds:      numeric('seller_proceeds', { precision: 14, scale: 2 }),
  paymentMethod:       varchar('payment_method', { length: 20 }),
  paymentStatus:       paymentStatusEnum('payment_status').notNull().default('pending'),
  stripePaymentIntent: varchar('stripe_payment_intent', { length: 100 }),
  stripeCheckoutSession: varchar('stripe_checkout_session', { length: 100 }),
  // Seller payout (Stripe transfer to the seller's Connect account).
  sellerPayoutId:      varchar('seller_payout_id', { length: 100 }),
  sellerPaidAt:        timestamp('seller_paid_at', { withTimezone: true }),
  titleStatus:         titleStatusEnum('title_status').default('pending'),
  dueDate:             timestamp('due_date', { withTimezone: true }),
  paidAt:              timestamp('paid_at', { withTimezone: true }),
  // Set when the equipment is delivered and the sale is fully closed.
  closedAt:            timestamp('closed_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  paymentStatusIdx: index('tx_payment_status_idx').on(t.paymentStatus),
}))

// ─── CARRIER PROFILES ────────────────────────────────────

export const carrierProfiles = pgTable('carrier_profiles', {
  userId:           uuid('user_id').primaryKey().references(() => users.id),
  companyName:      varchar('company_name', { length: 255 }).notNull(),
  mcNumber:         varchar('mc_number', { length: 20 }).unique(),
  dotNumber:        varchar('dot_number', { length: 20 }).unique(),
  fmcsaStatus:      fmcsaStatusEnum('fmcsa_status').default('active'),
  safetyRating:     safetyRatingEnum('safety_rating').default('unrated'),
  insuranceAmount:  numeric('insurance_amount', { precision: 12, scale: 2 }),
  insuranceExpires: date('insurance_expires'),
  trailerTypes:     text('trailer_types').array(),
  maxLoadTons:      numeric('max_load_tons', { precision: 6, scale: 2 }),
  baseState:        varchar('base_state', { length: 2 }),
  serviceStates:    text('service_states').array(),
  avgRating:        numeric('avg_rating', { precision: 3, scale: 2 }).default('0'),
  completedHauls:   integer('completed_hauls').default(0),
  stripeAccountId:  varchar('stripe_account_id', { length: 100 }),
  stripeOnboarded:  boolean('stripe_onboarded').default(false),
  bio:              text('bio'),
  logoUrl:          text('logo_url'),
  verifiedAt:       timestamp('verified_at', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── HAUL JOBS ───────────────────────────────────────────

export const haulJobs = pgTable('haul_jobs', {
  id:                   uuid('id').defaultRandom().primaryKey(),
  transactionId:        uuid('transaction_id').notNull().references(() => transactions.id).unique(),
  buyerId:              uuid('buyer_id').notNull().references(() => users.id),
  listingId:            uuid('listing_id').notNull().references(() => listings.id),
  status:               haulJobStatusEnum('status').notNull().default('open'),
  pickupAddress:        text('pickup_address').notNull(),
  pickupState:          varchar('pickup_state', { length: 2 }),
  deliveryAddress:      text('delivery_address').notNull(),
  deliveryState:        varchar('delivery_state', { length: 2 }),
  distanceMiles:        numeric('distance_miles', { precision: 8, scale: 2 }),
  trailerType:          trailerTypeEnum('trailer_type').default('any'),
  specialRequirements:  text('special_requirements').array(),
  notes:                text('notes'),
  desiredPickupDate:    date('desired_pickup_date'),
  deliveryDeadline:     date('delivery_deadline'),
  maxBudget:            numeric('max_budget', { precision: 10, scale: 2 }),
  bidWindowHrs:         smallint('bid_window_hrs').default(24),
  bidCloseTime:         timestamp('bid_close_time', { withTimezone: true }),
  awardedBidId:         uuid('awarded_bid_id'),
  awardedCarrierId:     uuid('awarded_carrier_id').references(() => users.id),
  stripePaymentIntent:  varchar('stripe_payment_intent', { length: 100 }),
  createdAt:            timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  buyerIdx:      index('haul_jobs_buyer_idx').on(t.buyerId),
  statusIdx:     index('haul_jobs_status_idx').on(t.status),
  bidCloseIdx:   index('haul_jobs_bid_close_idx').on(t.bidCloseTime),
}))

// ─── HAUL BIDS ───────────────────────────────────────────

export const haulBids = pgTable('haul_bids', {
  id:                    uuid('id').defaultRandom().primaryKey(),
  haulJobId:             uuid('haul_job_id').notNull().references(() => haulJobs.id),
  carrierId:             uuid('carrier_id').notNull().references(() => users.id),
  amount:                numeric('amount', { precision: 10, scale: 2 }).notNull(),
  includesPermits:       boolean('includes_permits').default(false),
  includesPilotCar:      boolean('includes_pilot_car').default(false),
  trailerType:           trailerTypeEnum('trailer_type'),
  estimatedPickupDate:   date('estimated_pickup_date'),
  estimatedDeliveryDate: date('estimated_delivery_date'),
  carrierNotes:          text('carrier_notes'),
  status:                haulBidStatusEnum('status').notNull().default('active'),
  placedAt:              timestamp('placed_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  jobIdx:     index('haul_bids_job_idx').on(t.haulJobId),
  carrierIdx: index('haul_bids_carrier_idx').on(t.carrierId),
}))

// ─── HAUL TRACKING ───────────────────────────────────────

export const haulTracking = pgTable('haul_tracking', {
  id:              uuid('id').defaultRandom().primaryKey(),
  haulJobId:       uuid('haul_job_id').notNull().references(() => haulJobs.id),
  eventType:       trackingEventEnum('event_type').notNull(),
  addressApprox:   varchar('address_approx', { length: 200 }),
  milesRemaining:  numeric('miles_remaining', { precision: 8, scale: 2 }),
  etaUpdated:      timestamp('eta_updated', { withTimezone: true }),
  notes:           text('notes'),
  documentUrl:     text('document_url'),
  recordedAt:      timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  jobIdx:      index('haul_tracking_job_idx').on(t.haulJobId),
  recordedIdx: index('haul_tracking_recorded_idx').on(t.recordedAt),
}))

// ─── SUPPORTING TABLES ───────────────────────────────────

export const watchlist = pgTable('watchlist', {
  id:        uuid('id').defaultRandom().primaryKey(),
  userId:    uuid('user_id').notNull().references(() => users.id),
  auctionId: uuid('auction_id').notNull().references(() => auctions.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  unique: uniqueIndex('watchlist_unique').on(t.userId, t.auctionId),
}))

export const carrierReviews = pgTable('carrier_reviews', {
  id:           uuid('id').defaultRandom().primaryKey(),
  haulJobId:    uuid('haul_job_id').notNull().references(() => haulJobs.id).unique(),
  reviewerId:   uuid('reviewer_id').notNull().references(() => users.id),
  carrierId:    uuid('carrier_id').notNull().references(() => users.id),
  rating:       smallint('rating').notNull(),
  comment:      text('comment'),
  createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const notifications = pgTable('notifications', {
  id:        uuid('id').defaultRandom().primaryKey(),
  userId:    uuid('user_id').notNull().references(() => users.id),
  type:      varchar('type', { length: 50 }).notNull(),
  channel:   varchar('channel', { length: 20 }).notNull(),
  status:    varchar('status', { length: 20 }).default('pending'),
  payload:   jsonb('payload'),
  sentAt:    timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const usersRelations = relations(users, ({ many, one }) => ({
  listings: many(listings),
  bids: many(bids),
  carrierProfile: one(carrierProfiles, {
    fields: [users.id],
    references: [carrierProfiles.userId],
  }),
  haulJobs: many(haulJobs, { relationName: 'haul_job_buyer' }),
  awardedHaulJobs: many(haulJobs, { relationName: 'haul_job_awarded_carrier' }),
  haulBids: many(haulBids),
}))

export const listingsRelations = relations(listings, ({ many, one }) => ({
  seller: one(users, {
    fields: [listings.sellerId],
    references: [users.id],
  }),
  auction: one(auctions, {
    fields: [listings.id],
    references: [auctions.listingId],
  }),
  haulJobs: many(haulJobs),
}))

export const auctionsRelations = relations(auctions, ({ many, one }) => ({
  listing: one(listings, {
    fields: [auctions.listingId],
    references: [listings.id],
  }),
  currentWinner: one(users, {
    fields: [auctions.currentWinnerId],
    references: [users.id],
    relationName: 'auction_current_winner',
  }),
  winningBidder: one(users, {
    fields: [auctions.winningBidderId],
    references: [users.id],
    relationName: 'auction_winning_bidder',
  }),
  bids: many(bids),
  watchers: many(watchlist),
}))

export const bidsRelations = relations(bids, ({ one }) => ({
  auction: one(auctions, {
    fields: [bids.auctionId],
    references: [auctions.id],
  }),
  bidder: one(users, {
    fields: [bids.bidderId],
    references: [users.id],
  }),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  auction: one(auctions, {
    fields: [transactions.auctionId],
    references: [auctions.id],
  }),
  buyer: one(users, {
    fields: [transactions.buyerId],
    references: [users.id],
    relationName: 'transaction_buyer',
  }),
  seller: one(users, {
    fields: [transactions.sellerId],
    references: [users.id],
    relationName: 'transaction_seller',
  }),
  haulJob: one(haulJobs, {
    fields: [transactions.id],
    references: [haulJobs.transactionId],
  }),
}))

export const carrierProfilesRelations = relations(carrierProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [carrierProfiles.userId],
    references: [users.id],
  }),
  reviews: many(carrierReviews),
}))

export const haulJobsRelations = relations(haulJobs, ({ many, one }) => ({
  transaction: one(transactions, {
    fields: [haulJobs.transactionId],
    references: [transactions.id],
  }),
  buyer: one(users, {
    fields: [haulJobs.buyerId],
    references: [users.id],
    relationName: 'haul_job_buyer',
  }),
  listing: one(listings, {
    fields: [haulJobs.listingId],
    references: [listings.id],
  }),
  haulBids: many(haulBids),
  awardedCarrier: one(users, {
    fields: [haulJobs.awardedCarrierId],
    references: [users.id],
    relationName: 'haul_job_awarded_carrier',
  }),
  tracking: many(haulTracking),
}))

export const haulBidsRelations = relations(haulBids, ({ one }) => ({
  haulJob: one(haulJobs, {
    fields: [haulBids.haulJobId],
    references: [haulJobs.id],
  }),
  carrier: one(users, {
    fields: [haulBids.carrierId],
    references: [users.id],
  }),
}))

export const haulTrackingRelations = relations(haulTracking, ({ one }) => ({
  haulJob: one(haulJobs, {
    fields: [haulTracking.haulJobId],
    references: [haulJobs.id],
  }),
}))

export const watchlistRelations = relations(watchlist, ({ one }) => ({
  user: one(users, {
    fields: [watchlist.userId],
    references: [users.id],
  }),
  auction: one(auctions, {
    fields: [watchlist.auctionId],
    references: [auctions.id],
  }),
}))

export const carrierReviewsRelations = relations(carrierReviews, ({ one }) => ({
  haulJob: one(haulJobs, {
    fields: [carrierReviews.haulJobId],
    references: [haulJobs.id],
  }),
  reviewer: one(users, {
    fields: [carrierReviews.reviewerId],
    references: [users.id],
    relationName: 'carrier_review_reviewer',
  }),
  carrier: one(users, {
    fields: [carrierReviews.carrierId],
    references: [users.id],
    relationName: 'carrier_review_carrier',
  }),
}))
