-- 0005_enable_rls.sql
-- Enable Row Level Security on every public table.
--
-- Why: NEXT_PUBLIC_SUPABASE_ANON_KEY is shipped to every browser. With RLS
-- off, anyone could hit the Supabase auto-generated REST API and dump or
-- mutate every row, bypassing our application's auth entirely.
--
-- Why no policies: application backend code never uses the anon/authenticated
-- Supabase JS client against these tables. It uses either a direct pg.Pool
-- (lib/db.ts, runs as the postgres owner role and bypasses RLS) or the
-- service_role client (lib/supabase.ts:supabaseAdmin, which Supabase
-- intentionally exempts from RLS). Both keep working. anon/authenticated
-- get no access via REST — which is exactly what we want.
--
-- Idempotent: ALTER TABLE ... ENABLE ROW LEVEL SECURITY is a no-op if
-- already enabled.

ALTER TABLE public.users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrier_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haul_jobs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haul_bids             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haul_tracking         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrier_reviews       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         ENABLE ROW LEVEL SECURITY;
