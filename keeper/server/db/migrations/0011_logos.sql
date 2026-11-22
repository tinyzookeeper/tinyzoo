CREATE TABLE "logos" (
	"hash" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"fit" text DEFAULT 'pad' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "logo_hash" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "logo_source" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "logo_checked_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "logo_hash" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "logo_hash" text;