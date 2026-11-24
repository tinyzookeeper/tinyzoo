CREATE TABLE "site_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"host" text NOT NULL,
	"main" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp (3) with time zone,
	"checked_at" timestamp (3) with time zone,
	"wait" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_sites" (
	"id" text PRIMARY KEY NOT NULL,
	"template" text NOT NULL,
	"row" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "plan" text DEFAULT 'basic' NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "host_state" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "moved_to" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "data_removed_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "move_out" jsonb;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "move_in" jsonb;--> statement-breakpoint
ALTER TABLE "site_domains" ADD CONSTRAINT "site_domains_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "site_domains_host_unique" ON "site_domains" USING btree ("host");--> statement-breakpoint
CREATE INDEX "site_domains_site_idx" ON "site_domains" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "tenant_sites_template_idx" ON "tenant_sites" USING btree ("template");