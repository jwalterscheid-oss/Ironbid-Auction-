-- 0001_marketplace_corrections.sql
-- Adds seller payout / identity columns, the one-winner constraint, and the
-- transactional RPCs (place_bid, close_auction, award_haul_job) that the
-- application relies on. Idempotent: safe to re-run.

-- ─── SCHEMA ADDITIONS ────────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id   varchar(100),
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_identity_session_id  varchar(100),
  ADD COLUMN IF NOT EXISTS disabled_at                 timestamptz;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS stripe_checkout_session  varchar(100),
  ADD COLUMN IF NOT EXISTS seller_payout_id         varchar(100),
  ADD COLUMN IF NOT EXISTS seller_paid_at           timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at                timestamptz;

-- At most one winning bid per auction.
CREATE UNIQUE INDEX IF NOT EXISTS bids_one_winner_idx
  ON bids (auction_id) WHERE is_winning = true;

-- Gap-free, race-free lot numbers (replaces the COUNT(*)+1 scheme).
-- Seed from the highest existing lot-number suffix so a deleted listing can
-- never cause nextval() to reissue a suffix already in use.
CREATE SEQUENCE IF NOT EXISTS listing_lot_seq START 1;
SELECT setval(
  'listing_lot_seq',
  GREATEST(
    COALESCE(
      (SELECT MAX(split_part(lot_number, '-', 3)::int)
         FROM listings
        WHERE lot_number ~ '^IB-\d+-\d+$'),
      0
    ),
    1
  )
);

-- ─── place_bid ───────────────────────────────────────────────────────────────
-- Serializable bid placement. Locks the auction row so concurrent bids queue
-- behind one another, validates the increment, records the bid, and applies
-- anti-snipe extension. Mirrors getMinIncrement() in lib/auction/bid-processor.ts.

CREATE OR REPLACE FUNCTION place_bid(
  p_auction_id  uuid,
  p_bidder_id   uuid,
  p_amount      numeric,
  p_max_bid     numeric DEFAULT NULL,
  p_ip_address  text    DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_auction       auctions%ROWTYPE;
  v_min_increment numeric;
  v_current       numeric;
  v_bid_id        uuid;
  v_prev_winner   uuid;
  v_new_end       timestamptz;
  v_extended      boolean := false;
  v_reserve_met   boolean;
  v_bid_count     integer;
BEGIN
  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found';
  END IF;

  IF v_auction.status <> 'active' THEN
    RAISE EXCEPTION 'auction_not_active';
  END IF;

  v_new_end := COALESCE(v_auction.extended_end_time, v_auction.end_time);
  IF now() >= v_new_end THEN
    RAISE EXCEPTION 'auction_not_active';
  END IF;

  v_current := COALESCE(v_auction.current_bid, v_auction.starting_bid);

  v_min_increment := CASE
    WHEN v_current >= 500000 THEN 5000
    WHEN v_current >= 200000 THEN 2500
    WHEN v_current >= 50000  THEN 1000
    ELSE 500
  END;

  IF v_auction.bid_count > 0 AND p_amount < v_current + v_min_increment THEN
    RAISE EXCEPTION 'bid_too_low';
  END IF;
  IF v_auction.bid_count = 0 AND p_amount < v_current THEN
    RAISE EXCEPTION 'bid_too_low';
  END IF;

  v_prev_winner := v_auction.current_winner_id;

  UPDATE bids SET is_winning = false
    WHERE auction_id = p_auction_id AND is_winning = true;

  INSERT INTO bids (auction_id, bidder_id, amount, max_bid, bid_type, is_winning, ip_address)
    VALUES (p_auction_id, p_bidder_id, p_amount, p_max_bid, 'manual', true, p_ip_address)
    RETURNING id INTO v_bid_id;

  -- Anti-snipe: extend the close if a bid lands in the final 2 minutes.
  IF v_new_end - now() < interval '2 minutes' THEN
    v_new_end  := now() + interval '2 minutes';
    v_extended := true;
  END IF;

  v_reserve_met := v_auction.reserve_price IS NULL OR p_amount >= v_auction.reserve_price;
  v_bid_count   := COALESCE(v_auction.bid_count, 0) + 1;

  UPDATE auctions SET
    current_bid       = p_amount,
    current_winner_id = p_bidder_id,
    bid_count         = v_bid_count,
    reserve_met       = v_reserve_met,
    end_time          = CASE WHEN v_extended THEN v_new_end ELSE end_time END,
    extended_end_time = CASE WHEN v_extended THEN v_new_end ELSE extended_end_time END,
    status            = 'active'
  WHERE id = p_auction_id;

  RETURN json_build_object(
    'bid_id',             v_bid_id,
    'new_current_bid',    p_amount,
    'new_bid_count',      v_bid_count,
    'reserve_met',        v_reserve_met,
    'new_end_time',       v_new_end,
    'was_extended',       v_extended,
    'previous_winner_id', v_prev_winner
  );
END;
$$;

-- ─── close_auction ───────────────────────────────────────────────────────────
-- Closes a won auction and creates the buyer transaction in one step.

CREATE OR REPLACE FUNCTION close_auction(
  p_auction_id      uuid,
  p_winner_id       uuid,
  p_final_price     numeric,
  p_buyers_premium  numeric,
  p_total_due       numeric,
  p_platform_fee    numeric,
  p_seller_proceeds numeric,
  p_due_date        timestamptz
) RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_auction   auctions%ROWTYPE;
  v_seller_id uuid;
  v_tx_id     uuid;
BEGIN
  -- Lock the auction row so two closers (the delayed BullMQ job and the
  -- close-auctions cron safety net) cannot both settle the same auction.
  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found';
  END IF;

  -- Already settled by another runner — return without re-broadcasting.
  IF v_auction.status <> 'active' THEN
    SELECT id INTO v_tx_id FROM transactions WHERE auction_id = p_auction_id;
    RETURN json_build_object('closed', false, 'transaction_id', v_tx_id, 'auction_id', p_auction_id);
  END IF;

  SELECT seller_id INTO v_seller_id FROM listings WHERE id = v_auction.listing_id;

  UPDATE auctions SET
    status            = 'closed',
    final_price       = p_final_price,
    winning_bidder_id = p_winner_id
  WHERE id = p_auction_id;

  UPDATE listings SET status = 'sold' WHERE id = v_auction.listing_id;

  INSERT INTO transactions (
    auction_id, buyer_id, seller_id, hammer_price, buyers_premium,
    total_due, platform_fee, seller_proceeds, payment_status, due_date
  ) VALUES (
    p_auction_id, p_winner_id, v_seller_id, p_final_price, p_buyers_premium,
    p_total_due, p_platform_fee, p_seller_proceeds, 'pending', p_due_date
  )
  ON CONFLICT (auction_id) DO NOTHING
  RETURNING id INTO v_tx_id;

  IF v_tx_id IS NULL THEN
    SELECT id INTO v_tx_id FROM transactions WHERE auction_id = p_auction_id;
  END IF;

  RETURN json_build_object('closed', true, 'transaction_id', v_tx_id, 'auction_id', p_auction_id);
END;
$$;

-- ─── award_haul_job ──────────────────────────────────────────────────────────
-- Awards a haul job to the winning carrier bid and expires the rest.

CREATE OR REPLACE FUNCTION award_haul_job(
  p_job_id            uuid,
  p_bid_id            uuid,
  p_carrier_id        uuid,
  p_payment_intent_id text
) RETURNS json
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE haul_jobs SET
    status                = 'awarded',
    awarded_bid_id        = p_bid_id,
    awarded_carrier_id    = p_carrier_id,
    stripe_payment_intent = p_payment_intent_id
  WHERE id = p_job_id AND status = 'bidding';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'haul_job_not_awardable';
  END IF;

  UPDATE haul_bids SET status = 'accepted' WHERE id = p_bid_id;
  UPDATE haul_bids SET status = 'expired'
    WHERE haul_job_id = p_job_id AND id <> p_bid_id AND status = 'active';

  RETURN json_build_object('job_id', p_job_id, 'awarded_bid_id', p_bid_id);
END;
$$;
