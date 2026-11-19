CREATE TABLE "analytics_daily" (
	"day" date NOT NULL,
	"dimension" text NOT NULL,
	"value" text NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL,
	"visits" integer DEFAULT 0 NOT NULL,
	"pageviews" integer DEFAULT 0 NOT NULL,
	"bounces" integer DEFAULT 0 NOT NULL,
	"engaged_ms" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_daily_pk" PRIMARY KEY("day","dimension","value")
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"path" text NOT NULL,
	"entity" text,
	"entry_id" text,
	"locale" text,
	"visitor" text NOT NULL,
	"session" text NOT NULL,
	"consent_id" text,
	"view" text NOT NULL,
	"is_entry" boolean DEFAULT false NOT NULL,
	"referrer_host" text,
	"source" text DEFAULT 'Direct' NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"country" text,
	"device" text,
	"browser" text,
	"os" text,
	"language" text,
	"engaged_ms" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collect" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE INDEX "analytics_daily_dimension_idx" ON "analytics_daily" USING btree ("dimension","day");--> statement-breakpoint
CREATE INDEX "analytics_events_at_idx" ON "analytics_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "analytics_events_visitor_idx" ON "analytics_events" USING btree ("visitor","at");--> statement-breakpoint
CREATE INDEX "analytics_events_view_idx" ON "analytics_events" USING btree ("view");--> statement-breakpoint
CREATE INDEX "analytics_events_entry_idx" ON "analytics_events" USING btree ("entity","entry_id","at");