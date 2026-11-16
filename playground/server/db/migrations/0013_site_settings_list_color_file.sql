ALTER TABLE "siteSettings" ADD COLUMN "brand_color" text;--> statement-breakpoint
ALTER TABLE "siteSettings" ADD COLUMN "opening_hours" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "siteSettings" ADD COLUMN "rules_id" uuid;--> statement-breakpoint
ALTER TABLE "siteSettings" ADD CONSTRAINT "siteSettings_rules_id_cms_media_id_fk" FOREIGN KEY ("rules_id") REFERENCES "public"."cms_media"("id") ON DELETE set null ON UPDATE no action;