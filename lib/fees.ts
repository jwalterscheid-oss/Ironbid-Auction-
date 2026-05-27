// lib/fees.ts — single source of truth for marketplace fees.
//
// All math is done in integer cents so two independent rounding paths
// (buyer-side total, seller-side proceeds) always agree to the cent. DB
// columns are still numeric(14,2) in dollars — convert at the boundary
// using `centsToDollarString` for writes and `numericToCents` for reads.

export const SELLER_PLATFORM_FEE_PCT_BPS = 200    //  2.00%  of hammer
export const CARRIER_PLATFORM_FEE_PCT_BPS = (() => {
  const raw = Number(process.env.STRIPE_CARRIER_PLATFORM_FEE_PCT ?? 8)
  return Number.isFinite(raw) ? Math.round(raw * 100) : 800
})()
export const DEFAULT_BUYERS_PREMIUM_PCT_BPS = 1200 // 12.00% if unset

const BPS_DENOMINATOR = 10_000

function applyBps(cents: number, bps: number): number {
  // banker-safe: Math.round on the integer product avoids float drift
  return Math.round((cents * bps) / BPS_DENOMINATOR)
}

// ─── Boundary helpers (DB numeric ↔ integer cents) ───────────────────────────

export function numericToCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

export function centsToDollarString(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function centsToDollars(cents: number): number {
  return cents / 100
}

// ─── Auction settlement ─────────────────────────────────────────────────────

export interface AuctionSettlement {
  hammerCents:        number
  buyersPremiumCents: number
  totalDueCents:      number
  platformFeeCents:   number
  sellerProceedsCents: number
}

// Compute every leg of an auction close from the integer hammer price. The
// platform's revenue is the buyer's premium PLUS the seller fee — both are
// implicit residuals here:
//   buyer pays  = hammer + premium
//   seller gets = hammer − sellerFee
//   platform   = (buyer pays) − (seller gets) = premium + sellerFee
// Independent rounding paths cannot diverge because each leg is a single
// integer subtraction.
export function computeAuctionSettlement(
  hammerCents: number,
  buyersPremiumPctBps: number = DEFAULT_BUYERS_PREMIUM_PCT_BPS,
): AuctionSettlement {
  const buyersPremiumCents  = applyBps(hammerCents, buyersPremiumPctBps)
  const totalDueCents       = hammerCents + buyersPremiumCents
  const platformFeeCents    = applyBps(hammerCents, SELLER_PLATFORM_FEE_PCT_BPS)
  const sellerProceedsCents = hammerCents - platformFeeCents
  return {
    hammerCents,
    buyersPremiumCents,
    totalDueCents,
    platformFeeCents,
    sellerProceedsCents,
  }
}

// ─── Haul payout ────────────────────────────────────────────────────────────

export interface HaulSettlement {
  bidCents:           number
  applicationFeeCents: number
  carrierNetCents:    number
}

export function computeHaulSettlement(bidCents: number): HaulSettlement {
  const applicationFeeCents = applyBps(bidCents, CARRIER_PLATFORM_FEE_PCT_BPS)
  return {
    bidCents,
    applicationFeeCents,
    carrierNetCents: bidCents - applicationFeeCents,
  }
}

// Accept a buyer's-premium percentage that may arrive as a string (`numeric`
// from Drizzle) or a number (e.g. 12, 12.5). Returns basis points.
export function buyersPremiumPctToBps(pct: string | number | null | undefined): number {
  if (pct === null || pct === undefined) return DEFAULT_BUYERS_PREMIUM_PCT_BPS
  const n = typeof pct === 'string' ? Number(pct) : pct
  if (!Number.isFinite(n)) return DEFAULT_BUYERS_PREMIUM_PCT_BPS
  return Math.round(n * 100)
}
