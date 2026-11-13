CREATE TYPE "public"."page_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"status" "page_status" DEFAULT 'draft' NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"og_image_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "page_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_og_image_id_cms_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."cms_media"("id") ON DELETE set null ON UPDATE no action;