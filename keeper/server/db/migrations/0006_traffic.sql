CREATE TABLE "site_traffic" (
	"site_id" uuid NOT NULL,
	"day" date NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL,
	"visits" integer DEFAULT 0 NOT NULL,
	"pageviews" integer DEFAULT 0 NOT NULL,
	"bounces" integer DEFAULT 0 NOT NULL,
	"engaged_ms" bigint DEFAULT 0 NOT NULL,
	"pages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"devices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fetched_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_traffic_pk" PRIMARY KEY("site_id","day")
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "traffic_checked_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "traffic_error" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "traffic_since" date;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "traffic_through" date;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "traffic_drop" jsonb;--> statement-breakpoint
ALTER TABLE "site_traffic" ADD CONSTRAINT "site_traffic_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;