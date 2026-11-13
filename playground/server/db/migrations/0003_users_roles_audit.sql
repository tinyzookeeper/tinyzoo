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
ALTER TABLE "author" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "author" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "siteSettings" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "siteSettings" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "tag" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "tag" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "cms_tokens" ADD CONSTRAINT "cms_tokens_user_id_cms_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cms_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cms_audit_created_idx" ON "cms_audit" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_tokens_hash_unique" ON "cms_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "cms_tokens_user_idx" ON "cms_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_users_email_unique" ON "cms_users" USING btree ("email");