DO $$ BEGIN
 CREATE TYPE "auction_status" AS ENUM('scheduled', 'active', 'extended', 'closed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "auction_type" AS ENUM('timed', 'live', 'buy_now');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "bid_type" AS ENUM('manual', 'autobid', 'proxy');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "category" AS ENUM('excavator', 'bulldozer', 'crane', 'loader', 'truck', 'aerial', 'compactor', 'skid_steer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "condition_grade" AS ENUM('A+', 'A', 'B', 'C', 'D');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "fmcsa_status" AS ENUM('active', 'inactive', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "haul_bid_status" AS ENUM('active', 'accepted', 'withdrawn', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "haul_job_status" AS ENUM('open', 'bidding', 'awarded', 'picked_up', 'in_transit', 'delivered', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "kyc_status" AS ENUM('pending', 'verified', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "listing_status" AS ENUM('draft', 'active', 'sold', 'withdrawn');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "payment_status" AS ENUM('pending', 'paid', 'overdue', 'refunded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "safety_rating" AS ENUM('satisfactory', 'conditional', 'unsatisfactory', 'unrated');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "title_status" AS ENUM('pending', 'transferred', 'filed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "tracking_event" AS ENUM('bol_signed', 'picked_up', 'gps_update', 'near_destination', 'delivered');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "trailer_type" AS ENUM('rgn', 'lowboy', 'step_deck', 'flatbed', 'extendable', 'any');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "user_role" AS ENUM('buyer', 'seller', 'dealer', 'carrier', 'admin');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"type" "auction_type" NOT NULL,
	"status" "auction_status" DEFAULT 'scheduled' NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"extended_end_time" timestamp with time zone,
	"starting_bid" numeric(14, 2) NOT NULL,
	"reserve_price" numeric(14, 2),
	"buy_now_price" numeric(14, 2),
	"min_increment" numeric(14, 2) NOT NULL,
	"buyers_premium_pct" numeric(5, 2) DEFAULT '12.00' NOT NULL,
	"current_bid" numeric(14, 2),
	"current_winner_id" uuid,
	"bid_count" integer DEFAULT 0,
	"reserve_met" boolean DEFAULT false,
	"watch_count" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"final_price" numeric(14, 2),
	"winning_bidder_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auctions_listing_id_unique" UNIQUE("listing_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"bidder_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"max_bid" numeric(14, 2),
	"bid_type" "bid_type" DEFAULT 'manual' NOT NULL,
	"is_winning" boolean DEFAULT false,
	"ip_address" varchar(45),
	"user_agent" text,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "carrier_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"mc_number" varchar(20),
	"dot_number" varchar(20),
	"fmcsa_status" "fmcsa_status" DEFAULT 'active',
	"safety_rating" "safety_rating" DEFAULT 'unrated',
	"insurance_amount" numeric(12, 2),
	"insurance_expires" date,
	"trailer_types" text[],
	"max_load_tons" numeric(6, 2),
	"base_state" varchar(2),
	"service_states" text[],
	"avg_rating" numeric(3, 2) DEFAULT '0',
	"completed_hauls" integer DEFAULT 0,
	"stripe_account_id" varchar(100),
	"stripe_onboarded" boolean DEFAULT false,
	"bio" text,
	"logo_url" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carrier_profiles_mc_number_unique" UNIQUE("mc_number"),
	CONSTRAINT "carrier_profiles_dot_number_unique" UNIQUE("dot_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "carrier_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"haul_job_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"carrier_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carrier_reviews_haul_job_id_unique" UNIQUE("haul_job_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "haul_bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"haul_job_id" uuid NOT NULL,
	"carrier_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"includes_permits" boolean DEFAULT false,
	"includes_pilot_car" boolean DEFAULT false,
	"trailer_type" "trailer_type",
	"estimated_pickup_date" date,
	"estimated_delivery_date" date,
	"carrier_notes" text,
	"status" "haul_bid_status" DEFAULT 'active' NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "haul_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"status" "haul_job_status" DEFAULT 'open' NOT NULL,
	"pickup_address" text NOT NULL,
	"pickup_state" varchar(2),
	"delivery_address" text NOT NULL,
	"delivery_state" varchar(2),
	"distance_miles" numeric(8, 2),
	"trailer_type" "trailer_type" DEFAULT 'any',
	"special_requirements" text[],
	"notes" text,
	"desired_pickup_date" date,
	"delivery_deadline" date,
	"max_budget" numeric(10, 2),
	"bid_window_hrs" smallint DEFAULT 24,
	"bid_close_time" timestamp with time zone,
	"awarded_bid_id" uuid,
	"awarded_carrier_id" uuid,
	"stripe_payment_intent" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "haul_jobs_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "haul_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"haul_job_id" uuid NOT NULL,
	"event_type" "tracking_event" NOT NULL,
	"address_approx" varchar(200),
	"miles_remaining" numeric(8, 2),
	"eta_updated" timestamp with time zone,
	"notes" text,
	"document_url" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"lot_number" varchar(20),
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"category" "category" NOT NULL,
	"make" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"year" smallint NOT NULL,
	"serial_number" varchar(100),
	"hours" integer,
	"weight_kg" numeric(10, 2),
	"condition_grade" "condition_grade",
	"description" text,
	"location_city" varchar(100),
	"location_state" varchar(50),
	"photos" jsonb,
	"inspection_report_url" text,
	"inspection_data" jsonb,
	"documents" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "listings_lot_number_unique" UNIQUE("lot_number"),
	CONSTRAINT "listings_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"channel" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"payload" jsonb,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"hammer_price" numeric(14, 2) NOT NULL,
	"buyers_premium" numeric(14, 2) NOT NULL,
	"total_due" numeric(14, 2) NOT NULL,
	"platform_fee" numeric(14, 2),
	"seller_proceeds" numeric(14, 2),
	"payment_method" varchar(20),
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"stripe_payment_intent" varchar(100),
	"title_status" "title_status" DEFAULT 'pending',
	"due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_auction_id_unique" UNIQUE("auction_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"role" "user_role" DEFAULT 'buyer' NOT NULL,
	"company_name" varchar(255),
	"kyc_status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"credit_verified" boolean DEFAULT false,
	"bid_limit" numeric(14, 2),
	"stripe_customer_id" varchar(100),
	"seller_rating" numeric(3, 2),
	"total_sales" integer DEFAULT 0,
	"is_verified_dealer" boolean DEFAULT false,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watchlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"auction_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auctions_status_idx" ON "auctions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auctions_end_idx" ON "auctions" ("end_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bids_auction_idx" ON "bids" ("auction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bids_bidder_idx" ON "bids" ("bidder_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bids_winning_idx" ON "bids" ("is_winning");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "haul_bids_job_idx" ON "haul_bids" ("haul_job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "haul_bids_carrier_idx" ON "haul_bids" ("carrier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "haul_jobs_buyer_idx" ON "haul_jobs" ("buyer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "haul_jobs_status_idx" ON "haul_jobs" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "haul_jobs_bid_close_idx" ON "haul_jobs" ("bid_close_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "haul_tracking_job_idx" ON "haul_tracking" ("haul_job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "haul_tracking_recorded_idx" ON "haul_tracking" ("recorded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_seller_idx" ON "listings" ("seller_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_status_idx" ON "listings" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_category_idx" ON "listings" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tx_payment_status_idx" ON "transactions" ("payment_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_clerk_idx" ON "users" ("clerk_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "watchlist_unique" ON "watchlist" ("user_id","auction_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auctions" ADD CONSTRAINT "auctions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auctions" ADD CONSTRAINT "auctions_current_winner_id_users_id_fk" FOREIGN KEY ("current_winner_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auctions" ADD CONSTRAINT "auctions_winning_bidder_id_users_id_fk" FOREIGN KEY ("winning_bidder_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bids" ADD CONSTRAINT "bids_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bids" ADD CONSTRAINT "bids_bidder_id_users_id_fk" FOREIGN KEY ("bidder_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "carrier_profiles" ADD CONSTRAINT "carrier_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "carrier_reviews" ADD CONSTRAINT "carrier_reviews_haul_job_id_haul_jobs_id_fk" FOREIGN KEY ("haul_job_id") REFERENCES "haul_jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "carrier_reviews" ADD CONSTRAINT "carrier_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "carrier_reviews" ADD CONSTRAINT "carrier_reviews_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "haul_bids" ADD CONSTRAINT "haul_bids_haul_job_id_haul_jobs_id_fk" FOREIGN KEY ("haul_job_id") REFERENCES "haul_jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "haul_bids" ADD CONSTRAINT "haul_bids_carrier_id_users_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "haul_jobs" ADD CONSTRAINT "haul_jobs_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "haul_jobs" ADD CONSTRAINT "haul_jobs_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "haul_jobs" ADD CONSTRAINT "haul_jobs_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "haul_jobs" ADD CONSTRAINT "haul_jobs_awarded_carrier_id_users_id_fk" FOREIGN KEY ("awarded_carrier_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "haul_tracking" ADD CONSTRAINT "haul_tracking_haul_job_id_haul_jobs_id_fk" FOREIGN KEY ("haul_job_id") REFERENCES "haul_jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
