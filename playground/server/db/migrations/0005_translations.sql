CREATE TABLE "page_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text,
	"slug" text,
	"sections" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text,
	"slug" text,
	"body" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"name" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "page_locales" ADD CONSTRAINT "page_locales_parent_id_page_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_locales" ADD CONSTRAINT "post_locales_parent_id_post_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_locales" ADD CONSTRAINT "tag_locales_parent_id_tag_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "page_locales_parent_locale_unique" ON "page_locales" USING btree ("parent_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "page_locales_slug_unique" ON "page_locales" USING btree ("locale","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "post_locales_parent_locale_unique" ON "post_locales" USING btree ("parent_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "post_locales_slug_unique" ON "post_locales" USING btree ("locale","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_locales_parent_locale_unique" ON "tag_locales" USING btree ("parent_id","locale");