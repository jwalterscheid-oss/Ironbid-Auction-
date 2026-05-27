-- 0002_stripe_webhook_idempotency.sql
-- Adds a dedupe table for Stripe webhook events. Idempotent; safe to re-run.

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id     varchar(100) PRIMARY KEY,
  type         varchar(100) NOT NULL,
  processed_at timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_processed_at_idx
  ON stripe_webhook_events (processed_at);
