-- 0006_lock_function_search_path.sql
-- Lock the search_path on RPC functions to prevent search_path hijacking.
--
-- Supabase advisor flagged place_bid, close_auction, award_haul_job, and
-- enforce_haul_bid_window with the `function_search_path_mutable` warning.
-- A caller who can alter their own search_path (e.g. authenticated/anon
-- when RLS lets them touch a related table) could shadow public.bids with
-- their own bids object and trick a SECURITY DEFINER function into reading
-- attacker-controlled data.
--
-- Setting search_path explicitly to 'public, pg_catalog' is the practical
-- fix: function bodies keep working without needing every identifier
-- requalified, but the resolution is no longer caller-controlled.
--
-- DO-block form handles overloaded signatures and is idempotent.

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT oid::regprocedure AS sig
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('place_bid', 'close_auction', 'award_haul_job', 'enforce_haul_bid_window')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_catalog', fn.sig);
  END LOOP;
END
$$;
