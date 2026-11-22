CREATE TABLE "site_restarts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"at" timestamp (3) with time zone NOT NULL,
	"memory_peak" bigint,
	"memory_limit" bigint
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "status_build_id" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "restart_alerted_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "site_restarts" ADD CONSTRAINT "site_restarts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_restarts_site_at_idx" ON "site_restarts" USING btree ("site_id","at");