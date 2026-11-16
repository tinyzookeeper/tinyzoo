CREATE TYPE "public"."contactForm_status" AS ENUM('new', 'read', 'done');--> statement-breakpoint
CREATE TYPE "public"."contactForm_topic" AS ENUM('question', 'race', 'other');--> statement-breakpoint
CREATE TABLE "contactForm" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"topic" "contactForm_topic",
	"message" text NOT NULL,
	"consent" boolean DEFAULT false NOT NULL,
	"status" "contactForm_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "formSettings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notify_to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
