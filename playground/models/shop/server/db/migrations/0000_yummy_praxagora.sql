CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."order_form_status" AS ENUM('new', 'read', 'done');--> statement-breakpoint
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
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "category_to_product" (
	"product_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "category_to_product_product_id_category_id_pk" PRIMARY KEY("product_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "cms_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"rights" jsonb NOT NULL,
	"expires_at" timestamp (3) with time zone,
	"last_used_at" timestamp (3) with time zone,
	"revoked_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"origin" text DEFAULT 'manual' NOT NULL,
	"client_id" uuid,
	"access_expires_at" timestamp (3) with time zone,
	"refresh_hash" text,
	"refresh_expires_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "cms_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity" text,
	"record_id" text,
	"meta" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_collab" (
	"name" text PRIMARY KEY NOT NULL,
	"epoch" uuid NOT NULL,
	"state" text NOT NULL,
	"base_version" timestamp (3) with time zone,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"active_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "cms_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"key" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt" text,
	"alt_locales" jsonb,
	"name" text,
	"folder" text,
	"focal_x" integer,
	"focal_y" integer,
	"uploaded_by" uuid,
	"in_library" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_media_sizes" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"widths" text DEFAULT '' NOT NULL,
	"state" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_oauth_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"redirect_uris" jsonb NOT NULL,
	"client_uri" text,
	"last_used_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_oauth_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"resource" text,
	"name" text NOT NULL,
	"rights" jsonb NOT NULL,
	"consumed_at" timestamp (3) with time zone,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_oauth_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"redirect_uri" text NOT NULL,
	"state" text,
	"code_challenge" text NOT NULL,
	"scope" text NOT NULL,
	"resource" text,
	"decided_at" timestamp (3) with time zone,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" text NOT NULL,
	"record_id" uuid NOT NULL,
	"locale" text,
	"action" text NOT NULL,
	"version" timestamp (3) with time zone,
	"data" jsonb NOT NULL,
	"changed" jsonb NOT NULL,
	"user_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_search" (
	"entity" text NOT NULL,
	"record_id" uuid NOT NULL,
	"locale" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"extra" text DEFAULT '' NOT NULL,
	"title_folded" text DEFAULT '' NOT NULL,
	"body_folded" text DEFAULT '' NOT NULL,
	"extra_folded" text DEFAULT '' NOT NULL,
	"path" text,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cms_search_pk" PRIMARY KEY("entity","record_id","locale")
);
--> statement-breakpoint
CREATE TABLE "cms_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"used_at" timestamp (3) with time zone,
	"created_by" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"password_hash" text,
	"locale" text,
	"session_version" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp (3) with time zone NOT NULL,
	"place" text,
	"capacity" integer,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "form_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notify_to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "order_form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"product" text NOT NULL,
	"quantity" integer,
	"status" "order_form_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text NOT NULL,
	"body" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "post_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "post_to_tag" (
	"post_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "post_to_tag_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"price" integer,
	"description" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "product_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "category_to_product" ADD CONSTRAINT "category_to_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_to_product" ADD CONSTRAINT "category_to_product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_access_tokens" ADD CONSTRAINT "cms_access_tokens_user_id_cms_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cms_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_access_tokens" ADD CONSTRAINT "cms_access_tokens_client_id_cms_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."cms_oauth_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_media_sizes" ADD CONSTRAINT "cms_media_sizes_media_id_cms_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."cms_media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_oauth_codes" ADD CONSTRAINT "cms_oauth_codes_client_id_cms_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."cms_oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_oauth_codes" ADD CONSTRAINT "cms_oauth_codes_user_id_cms_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cms_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_oauth_requests" ADD CONSTRAINT "cms_oauth_requests_client_id_cms_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."cms_oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_tokens" ADD CONSTRAINT "cms_tokens_user_id_cms_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cms_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_settings_locales" ADD CONSTRAINT "consent_settings_locales_parent_id_consent_settings_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."consent_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_to_tag" ADD CONSTRAINT "post_to_tag_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_to_tag" ADD CONSTRAINT "post_to_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_daily_dimension_idx" ON "analytics_daily" USING btree ("dimension","day");--> statement-breakpoint
CREATE INDEX "analytics_events_at_idx" ON "analytics_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "analytics_events_visitor_idx" ON "analytics_events" USING btree ("visitor","at");--> statement-breakpoint
CREATE INDEX "analytics_events_view_idx" ON "analytics_events" USING btree ("view");--> statement-breakpoint
CREATE INDEX "analytics_events_entry_idx" ON "analytics_events" USING btree ("entity","entry_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_access_tokens_hash_unique" ON "cms_access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_access_tokens_refresh_unique" ON "cms_access_tokens" USING btree ("refresh_hash");--> statement-breakpoint
CREATE INDEX "cms_access_tokens_user_idx" ON "cms_access_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cms_audit_created_idx" ON "cms_audit" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_oauth_codes_hash_unique" ON "cms_oauth_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "cms_revisions_record_idx" ON "cms_revisions" USING btree ("entity","record_id","locale","created_at");--> statement-breakpoint
CREATE INDEX "cms_search_title_trgm" ON "cms_search" USING gin ("title_folded" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "cms_search_body_trgm" ON "cms_search" USING gin ("body_folded" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "cms_search_extra_trgm" ON "cms_search" USING gin ("extra_folded" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "cms_tokens_hash_unique" ON "cms_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "cms_tokens_user_idx" ON "cms_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_users_email_unique" ON "cms_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "consent_log_consent_idx" ON "consent_log" USING btree ("consent_id","at");--> statement-breakpoint
CREATE INDEX "consent_log_at_idx" ON "consent_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_settings_locales_parent_locale_unique" ON "consent_settings_locales" USING btree ("parent_id","locale");