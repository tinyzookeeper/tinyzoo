ALTER TABLE "post_locales" ADD COLUMN "published" boolean;--> statement-breakpoint
ALTER TABLE "post_locales" ADD COLUMN "published_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "post_locales" ADD COLUMN "first_live_at" timestamp (3) with time zone;