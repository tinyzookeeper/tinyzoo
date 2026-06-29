CREATE TABLE "siteSettings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_name" text NOT NULL,
	"tagline" text,
	"logo_id" uuid,
	"meta_title" text,
	"meta_description" text,
	"og_image_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "meta_title" text;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "meta_description" text;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "og_image_id" uuid;--> statement-breakpoint
ALTER TABLE "siteSettings" ADD CONSTRAINT "siteSettings_logo_id_cms_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."cms_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "siteSettings" ADD CONSTRAINT "siteSettings_og_image_id_cms_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."cms_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_og_image_id_cms_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."cms_media"("id") ON DELETE set null ON UPDATE no action;