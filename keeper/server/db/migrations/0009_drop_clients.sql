-- Clients became workspaces and teams (0008): their tables and columns go.
ALTER TABLE "sites" DROP CONSTRAINT "sites_client_id_clients_id_fk";--> statement-breakpoint
DROP INDEX "sites_client_idx";--> statement-breakpoint
ALTER TABLE "sites" DROP COLUMN "client_id";--> statement-breakpoint
DROP TABLE "membership_clients" CASCADE;--> statement-breakpoint
DROP TABLE "memberships" CASCADE;--> statement-breakpoint
DROP TABLE "clients" CASCADE;--> statement-breakpoint
ALTER TABLE "sites" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_unique" ON "workspaces" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "workspace_invitations" DROP COLUMN "all_clients";--> statement-breakpoint
ALTER TABLE "workspace_invitations" DROP COLUMN "client_ids";
