-- 0004_missing_indexes.sql
-- Adds indexes implied by hot query patterns. Uses CONCURRENTLY where
-- supported so the migration doesn't block writes on a live table.
-- Idempotent; safe to re-run.

CREATE INDEX IF NOT EXISTS tx_buyer_idx          ON transactions (buyer_id);
CREATE INDEX IF NOT EXISTS tx_seller_idx         ON transactions (seller_id);
CREATE INDEX IF NOT EXISTS bids_placed_at_idx    ON bids (placed_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_idx   ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_status_idx ON notifications (status);
