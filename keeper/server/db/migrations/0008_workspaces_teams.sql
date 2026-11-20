CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "oauth_codes" ALTER COLUMN "workspace_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tokens" ALTER COLUMN "workspace_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD COLUMN "team_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_members_user_idx" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_workspace_slug_unique" ON "teams" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_workspace_name_unique" ON "teams" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "teams_one_default" ON "teams" USING btree ("workspace_id") WHERE "teams"."is_default";--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sites_team_idx" ON "sites" USING btree ("team_id");--> statement-breakpoint
-- The data: every workspace gets a slug and a default team "General" (for its sites without a
-- client). Every client becomes a workspace of its own, with one team named after it, holding
-- its sites (ids unchanged) and its "also alert" addresses as the workspace's alert list. People
-- join the client workspaces they could see (owners and admins all of them), viewers become
-- guests, and people limited to some clients leave the original workspace. Tokens stop naming a
-- workspace: they act as their maker in all of theirs.
CREATE FUNCTION pg_temp.keeper_slug(name text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT coalesce(nullif(left(trim(both '-' from regexp_replace(lower(translate(name,
    'áäàâãåčćçďéěëèêíïìîľĺňńñóöòôõřŕšśťúůüùûýÿžźżÁÄÀÂÃÅČĆÇĎÉĚËÈÊÍÏÌÎĽĹŇŃÑÓÖÒÔÕŘŔŠŚŤÚŮÜÙÛÝŸŽŹŻß',
    'aaaaaacccdeeeeeiiiillnnnooooorrsstuuuuuyyzzzAAAAAACCCDEEEEEIIIILLNNNOOOOORRSSTUUUUUYYZZZs')), '[^a-z0-9]+', '-', 'g')), 48), ''), 'workspace')
$f$;
--> statement-breakpoint
DO $$
DECLARE
  orig uuid[];
  w record;
  c record;
  base text;
  cand text;
  n int;
  general uuid;
  new_ws uuid;
  new_team uuid;
BEGIN
  CREATE TEMP TABLE keeper_client_map (client_id uuid PRIMARY KEY, workspace_id uuid, team_id uuid, name text) ON COMMIT DROP;
  SELECT coalesce(array_agg(id ORDER BY created_at), '{}') INTO orig FROM workspaces;

  FOREACH new_ws IN ARRAY orig LOOP
    SELECT name INTO base FROM workspaces WHERE id = new_ws;
    base := pg_temp.keeper_slug(base);
    cand := base; n := 1;
    WHILE EXISTS (SELECT 1 FROM workspaces WHERE slug = cand) LOOP n := n + 1; cand := base || '-' || n; END LOOP;
    UPDATE workspaces SET slug = cand WHERE id = new_ws;
  END LOOP;

  INSERT INTO workspace_members (workspace_id, user_id, role, created_at)
    SELECT workspace_id, user_id, CASE role WHEN 'viewer' THEN 'guest' ELSE role END, created_at FROM memberships;

  FOR w IN SELECT id FROM workspaces WHERE id = ANY (orig) LOOP
    INSERT INTO teams (workspace_id, name, slug, is_default) VALUES (w.id, 'General', 'general', true) RETURNING id INTO general;
    UPDATE sites SET team_id = general WHERE workspace_id = w.id AND client_id IS NULL;
    INSERT INTO team_members (team_id, user_id, role)
      SELECT general, user_id, 'member' FROM memberships
      WHERE workspace_id = w.id AND role IN ('member', 'viewer') AND all_clients;

    FOR c IN SELECT * FROM clients WHERE workspace_id = w.id ORDER BY lower(name) LOOP
      base := pg_temp.keeper_slug(c.name);
      cand := base; n := 1;
      WHILE EXISTS (SELECT 1 FROM workspaces WHERE slug = cand) LOOP n := n + 1; cand := base || '-' || n; END LOOP;
      INSERT INTO workspaces (name, slug, created_at) VALUES (c.name, cand, c.created_at) RETURNING id INTO new_ws;
      INSERT INTO teams (workspace_id, name, slug, is_default, created_at) VALUES (new_ws, c.name, base, true, c.created_at) RETURNING id INTO new_team;
      INSERT INTO keeper_client_map VALUES (c.id, new_ws, new_team, c.name);
      UPDATE sites SET workspace_id = new_ws, team_id = new_team WHERE client_id = c.id;
      INSERT INTO workspace_members (workspace_id, user_id, role, created_at)
        SELECT new_ws, m.user_id, CASE m.role WHEN 'viewer' THEN 'guest' ELSE m.role END, m.created_at FROM memberships m
        WHERE m.workspace_id = w.id AND (m.role IN ('owner', 'admin') OR m.all_clients
          OR EXISTS (SELECT 1 FROM membership_clients mc WHERE mc.workspace_id = w.id AND mc.user_id = m.user_id AND mc.client_id = c.id));
      INSERT INTO team_members (team_id, user_id, role)
        SELECT new_team, wm.user_id, 'member' FROM workspace_members wm WHERE wm.workspace_id = new_ws AND wm.role IN ('member', 'guest');
      -- Alerts: the client's addresses joined the team's before. They still both hear, and when
      -- the team had no list (everyone who works on the site), those people are named too.
      UPDATE workspaces nw SET alert_emails = (
        SELECT coalesce(jsonb_agg(DISTINCT e ORDER BY e), '[]'::jsonb) FROM (
          SELECT jsonb_array_elements_text(ow.alert_emails) AS e FROM workspaces ow WHERE ow.id = w.id
          UNION SELECT jsonb_array_elements_text(c.alert_emails)
          UNION SELECT u.email FROM workspace_members wm JOIN users u ON u.id = wm.user_id
            WHERE wm.workspace_id = new_ws AND wm.role <> 'guest'
              AND jsonb_array_length(c.alert_emails) > 0
              AND jsonb_array_length((SELECT ow2.alert_emails FROM workspaces ow2 WHERE ow2.id = w.id)) = 0
        ) x)
        WHERE nw.id = new_ws;
    END LOOP;

    -- People limited to some clients have nothing left to see here.
    DELETE FROM workspace_members wm USING memberships m
      WHERE wm.workspace_id = w.id AND m.workspace_id = w.id AND m.user_id = wm.user_id AND m.role IN ('member', 'viewer') AND NOT m.all_clients;

    -- Open invitations limited to clients go to the first of those clients' workspaces.
    UPDATE workspace_invitations i SET workspace_id = cm.workspace_id, team_ids = jsonb_build_array(cm.team_id)
      FROM keeper_client_map cm
      WHERE i.workspace_id = w.id AND NOT i.all_clients AND i.role IN ('member', 'viewer')
        AND cm.client_id = (SELECT m2.client_id FROM keeper_client_map m2 WHERE i.client_ids ? m2.client_id::text ORDER BY lower(m2.name) LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM workspace_invitations o WHERE o.workspace_id = cm.workspace_id AND o.email = i.email);
    DELETE FROM workspace_invitations WHERE workspace_id = w.id AND NOT all_clients AND role IN ('member', 'viewer');
    -- A guest always names a team: the open ones for every client of the workspace get General.
    UPDATE workspace_invitations SET team_ids = jsonb_build_array(general) WHERE workspace_id = w.id AND role = 'viewer';
  END LOOP;

  UPDATE workspace_invitations SET role = 'guest' WHERE role = 'viewer';
  UPDATE tokens SET workspace_id = NULL;
  UPDATE oauth_codes SET workspace_id = NULL;
END $$;
