-- 0003_haul_bid_window_enforcement.sql
-- Enforces haul-bid timing at the DB level: bids can only be inserted or
-- updated while the parent job is in 'bidding' status AND before its
-- bid_close_time. Closes the application-land TOCTOU race where two
-- carriers near bid-close could both pass an in-app check and then both
-- insert. Idempotent; safe to re-run.

CREATE OR REPLACE FUNCTION enforce_haul_bid_window() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_status      haul_job_status;
  v_close_time  timestamptz;
BEGIN
  -- Only gate active bids — withdrawals/expirations may happen any time.
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT status, bid_close_time
    INTO v_status, v_close_time
    FROM haul_jobs
    WHERE id = NEW.haul_job_id
    FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'haul_job_not_found';
  END IF;

  IF v_status <> 'bidding' THEN
    RAISE EXCEPTION 'haul_job_not_bidding';
  END IF;

  IF v_close_time IS NOT NULL AND now() >= v_close_time THEN
    RAISE EXCEPTION 'haul_bid_window_closed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS haul_bids_window_check ON haul_bids;
CREATE TRIGGER haul_bids_window_check
  BEFORE INSERT OR UPDATE OF amount, status ON haul_bids
  FOR EACH ROW
  EXECUTE FUNCTION enforce_haul_bid_window();

-- Prevent duplicate active bids from the same carrier on the same job.
-- The application currently does a TOCTOU read-then-write; this is the
-- backstop.
CREATE UNIQUE INDEX IF NOT EXISTS haul_bids_one_active_per_carrier_idx
  ON haul_bids (haul_job_id, carrier_id) WHERE status = 'active';
