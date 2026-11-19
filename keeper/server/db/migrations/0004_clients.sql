CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"alert_emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_clients" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	CONSTRAINT "membership_clients_workspace_id_user_id_client_id_pk" PRIMARY KEY("workspace_id","user_id","client_id")
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "all_clients" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_clients" ADD CONSTRAINT "membership_clients_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_clients" ADD CONSTRAINT "membership_clients_membership_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."memberships"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_workspace_name_unique" ON "clients" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE INDEX "membership_clients_client_idx" ON "membership_clients" USING btree ("client_id");--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sites_client_idx" ON "sites" USING btree ("client_id");--> statement-breakpoint
-- The client names typed on sites become clients (one per name, any case), and the sites point at them.
INSERT INTO "clients" ("workspace_id", "name")
SELECT DISTINCT ON ("workspace_id", lower(btrim("client"))) "workspace_id", btrim("client")
FROM "sites" WHERE btrim("client") <> ''
ORDER BY "workspace_id", lower(btrim("client")), btrim("client");--> statement-breakpoint
UPDATE "sites" SET "client_id" = c."id"
FROM "clients" c
WHERE c."workspace_id" = "sites"."workspace_id" AND lower(c."name") = lower(btrim("sites"."client")) AND btrim("sites"."client") <> '';
