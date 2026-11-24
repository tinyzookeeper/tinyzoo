CREATE TABLE "email_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"used_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"template" text NOT NULL,
	"status" text DEFAULT 'creating' NOT NULL,
	"driver" text NOT NULL,
	"public_url" text,
	"internal_url" text,
	"driver_state" jsonb,
	"secrets" text NOT NULL,
	"invite_url" text,
	"invite_sent_at" timestamp (3) with time zone,
	"owner_accepted_at" timestamp (3) with time zone,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp (3) with time zone,
	"removed_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp (3) with time zone,
	"locale" text DEFAULT 'cs' NOT NULL,
	"session_version" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_tokens_hash_unique" ON "email_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "email_tokens_user_idx" ON "email_tokens" USING btree ("user_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_slug_unique" ON "sites" USING btree ("slug") WHERE "sites"."status" <> 'removed';--> statement-breakpoint
CREATE INDEX "sites_owner_idx" ON "sites" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");