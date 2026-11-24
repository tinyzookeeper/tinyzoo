CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."lesson_day" AS ENUM('po', 'ut', 'st', 'ct', 'pa', 'so');--> statement-breakpoint
CREATE TYPE "public"."lesson_level" AS ENUM('z', 'm', 'p', 'v', 'd');--> statement-breakpoint
CREATE TYPE "public"."page_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."site_settings_colors" AS ENUM('borovice', 'jil', 'indigo', 'kobalt', 'rumelka', 'smaragd', 'slunce', 'mata', 'pivonka');--> statement-breakpoint
CREATE TYPE "public"."site_settings_look" AS ENUM('sal', 'tabule', 'deka');--> statement-breakpoint
CREATE TYPE "public"."trial_status" AS ENUM('new', 'read', 'done');--> statement-breakpoint
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
CREATE TABLE "course" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"kind_id" uuid,
	"text" text NOT NULL,
	"starts_on" timestamp (3) with time zone NOT NULL,
	"lessons" integer NOT NULL,
	"price" integer NOT NULL,
	"capacity" integer NOT NULL,
	"free" integer NOT NULL,
	"position" integer,
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
CREATE TABLE "instructor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"photo_id" uuid,
	"label" text NOT NULL,
	"bio" text NOT NULL,
	"position" integer,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "instructor_to_lesson_kind" (
	"instructor_id" uuid NOT NULL,
	"lesson_kind_id" uuid NOT NULL,
	CONSTRAINT "instructor_to_lesson_kind_instructor_id_lesson_kind_id_pk" PRIMARY KEY("instructor_id","lesson_kind_id")
);
--> statement-breakpoint
CREATE TABLE "lesson" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"kind_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	"day" "lesson_day" DEFAULT 'po' NOT NULL,
	"start" text NOT NULL,
	"end" text NOT NULL,
	"level" "lesson_level" DEFAULT 'v' NOT NULL,
	"room" text NOT NULL,
	"capacity" integer NOT NULL,
	"free" integer NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "lesson_kind" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"summary" text NOT NULL,
	"audience" text NOT NULL,
	"level_note" text NOT NULL,
	"duration" text NOT NULL,
	"image_id" uuid,
	"position" integer,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "navigation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"main" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"legal" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
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
CREATE TABLE "question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"position" integer,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "redirect" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"permanent" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "redirect_from_unique" UNIQUE("from")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_name" text NOT NULL,
	"tagline" text,
	"logo_id" uuid,
	"look" "site_settings_look" DEFAULT 'sal' NOT NULL,
	"colors" "site_settings_colors" DEFAULT 'borovice' NOT NULL,
	"phone" text,
	"email" text,
	"instagram" text,
	"facebook" text,
	"street" text,
	"zip" text,
	"city" text,
	"address_note" text,
	"map_url" text,
	"hours" text,
	"cta_label" text,
	"cta_long_label" text,
	"cta_url" text,
	"about" text,
	"legal_name" text,
	"company_id" text,
	"meta_title" text,
	"meta_description" text,
	"og_image_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "tariff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"text" text NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"badge" text NOT NULL,
	"link_label" text NOT NULL,
	"link_url" text NOT NULL,
	"position" integer,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "trial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"lesson" text NOT NULL,
	"date" text NOT NULL,
	"consent" boolean DEFAULT false NOT NULL,
	"status" "trial_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "cms_access_tokens" ADD CONSTRAINT "cms_access_tokens_user_id_cms_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cms_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_access_tokens" ADD CONSTRAINT "cms_access_tokens_client_id_cms_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."cms_oauth_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_media_sizes" ADD CONSTRAINT "cms_media_sizes_media_id_cms_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."cms_media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_oauth_codes" ADD CONSTRAINT "cms_oauth_codes_client_id_cms_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."cms_oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_oauth_codes" ADD CONSTRAINT "cms_oauth_codes_user_id_cms_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cms_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_oauth_requests" ADD CONSTRAINT "cms_oauth_requests_client_id_cms_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."cms_oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_tokens" ADD CONSTRAINT "cms_tokens_user_id_cms_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cms_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_kind_id_lesson_kind_id_fk" FOREIGN KEY ("kind_id") REFERENCES "public"."lesson_kind"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor" ADD CONSTRAINT "instructor_photo_id_cms_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."cms_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_to_lesson_kind" ADD CONSTRAINT "instructor_to_lesson_kind_instructor_id_instructor_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_to_lesson_kind" ADD CONSTRAINT "instructor_to_lesson_kind_lesson_kind_id_lesson_kind_id_fk" FOREIGN KEY ("lesson_kind_id") REFERENCES "public"."lesson_kind"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_kind_id_lesson_kind_id_fk" FOREIGN KEY ("kind_id") REFERENCES "public"."lesson_kind"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_instructor_id_instructor_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_kind" ADD CONSTRAINT "lesson_kind_image_id_cms_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."cms_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_og_image_id_cms_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."cms_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_logo_id_cms_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."cms_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_og_image_id_cms_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."cms_media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
CREATE UNIQUE INDEX "cms_users_email_unique" ON "cms_users" USING btree ("email");