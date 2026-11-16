ALTER TABLE "post" ADD COLUMN "location" jsonb;--> statement-breakpoint
ALTER TABLE "post_locales" ADD COLUMN "location" jsonb;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "contact" jsonb;