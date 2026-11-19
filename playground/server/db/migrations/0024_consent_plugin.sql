CREATE TABLE "consent_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"consent_id" text NOT NULL,
	"at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"choice" jsonb NOT NULL,
	"version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"body" text,
	"accept_all" text,
	"reject_all" text,
	"settings" text,
	"save" text,
	"settings_title" text,
	"necessary_label" text,
	"necessary_text" text,
	"analytics_label" text,
	"analytics_text" text,
	"marketing_label" text,
	"marketing_text" text,
	"privacy_label" text,
	"privacy_url" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "consent_settings_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text,
	"body" text,
	"accept_all" text,
	"reject_all" text,
	"settings" text,
	"save" text,
	"settings_title" text,
	"necessary_label" text,
	"necessary_text" text,
	"analytics_label" text,
	"analytics_text" text,
	"marketing_label" text,
	"marketing_text" text,
	"privacy_label" text,
	"privacy_url" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consent_settings_locales" ADD CONSTRAINT "consent_settings_locales_parent_id_consent_settings_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."consent_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_log_consent_idx" ON "consent_log" USING btree ("consent_id","at");--> statement-breakpoint
CREATE INDEX "consent_log_at_idx" ON "consent_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_settings_locales_parent_locale_unique" ON "consent_settings_locales" USING btree ("parent_id","locale");