CREATE TABLE "navigation_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"main" jsonb,
	"footer" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text,
	"slug" text,
	"perex" text,
	"body" jsonb,
	"meta_title" text,
	"meta_description" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text,
	"slug" text,
	"sections" jsonb,
	"meta_title" text,
	"meta_description" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "siteSettings_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"tagline" text,
	"footer_note" text,
	"meta_title" text,
	"meta_description" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "navigation_locales" ADD CONSTRAINT "navigation_locales_parent_id_navigation_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."navigation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_locales" ADD CONSTRAINT "news_locales_parent_id_news_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_locales" ADD CONSTRAINT "page_locales_parent_id_page_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "siteSettings_locales" ADD CONSTRAINT "siteSettings_locales_parent_id_siteSettings_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."siteSettings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "navigation_locales_parent_locale_unique" ON "navigation_locales" USING btree ("parent_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "news_locales_parent_locale_unique" ON "news_locales" USING btree ("parent_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "news_locales_slug_unique" ON "news_locales" USING btree ("locale","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "page_locales_parent_locale_unique" ON "page_locales" USING btree ("parent_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "page_locales_slug_unique" ON "page_locales" USING btree ("locale","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "siteSettings_locales_parent_locale_unique" ON "siteSettings_locales" USING btree ("parent_id","locale");