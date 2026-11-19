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
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cms_access_tokens" ADD CONSTRAINT "cms_access_tokens_user_id_cms_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cms_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cms_access_tokens_hash_unique" ON "cms_access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "cms_access_tokens_user_idx" ON "cms_access_tokens" USING btree ("user_id");