CREATE TABLE "cms_media_sizes" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"widths" text DEFAULT '' NOT NULL,
	"state" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cms_media_sizes" ADD CONSTRAINT "cms_media_sizes_media_id_cms_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."cms_media"("id") ON DELETE cascade ON UPDATE no action;