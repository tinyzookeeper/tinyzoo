CREATE TYPE "public"."plan_animal" AS ENUM('bunny', 'bird', 'fox', 'frog', 'octopus', 'elephant', 'owl', 'whale', 'turtle', 'hedgehog', 'koala', 'penguin');--> statement-breakpoint
CREATE TYPE "public"."plan_stage" AS ENUM('done', 'now', 'next', 'later');--> statement-breakpoint
CREATE TABLE "plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"text" text,
	"stage" "plan_stage" DEFAULT 'next' NOT NULL,
	"version" text,
	"animal" "plan_animal",
	"position" integer,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "plan_locales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text,
	"text" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_locales" ADD CONSTRAINT "plan_locales_parent_id_plan_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_locales_parent_locale_unique" ON "plan_locales" USING btree ("parent_id","locale");