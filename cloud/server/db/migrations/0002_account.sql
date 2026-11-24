CREATE TABLE "account_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"site_id" uuid,
	"name" text NOT NULL,
	"url" text,
	"secret_hash" text NOT NULL,
	"revoked_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"used_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_members" (
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text,
	"active" boolean DEFAULT true NOT NULL,
	"confirmed_at" timestamp (3) with time zone,
	"last_sign_in_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_members_client_id_user_id_pk" PRIMARY KEY("client_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "account_clients" ADD CONSTRAINT "account_clients_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_clients" ADD CONSTRAINT "account_clients_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_codes" ADD CONSTRAINT "account_codes_client_id_account_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."account_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_codes" ADD CONSTRAINT "account_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_client_id_account_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."account_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_clients_site_unique" ON "account_clients" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "account_clients_owner_idx" ON "account_clients" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_codes_hash_unique" ON "account_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "account_codes_expires_idx" ON "account_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "account_members_user_idx" ON "account_members" USING btree ("user_id");