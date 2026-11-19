# Keeper

One overview of every tinyzoo site you look after: whether each one is up, which tinyzoo it runs, how its client uses the admin, and a way into each admin.

Self-hosted for now, with one team (a *workspace*). Every table already carries the workspace, so a hosted Keeper for many teams can come later without moving data.

## What it does

- **Uptime.** Every minute it asks each site for `GET /api/health/ready`. After 2 failed checks in a row the site counts as down: Keeper opens an incident and e-mails the team. It e-mails again when the site is back.
- **Status.** Every 5 minutes it reads `GET /api/health/status` with the site's token: the tinyzoo version, the database, the collections, accounts, media, errors and plugins.
- **Versions.** Sites running an older tinyzoo than the newest release on npm are marked.
- **Certificates.** Twice a day it reads each site's TLS certificate, and e-mails once when one expires within 14 days.
- **Traffic.** For a site with tinyzoo's analytics plugin (its status lists `analytics`), about once an hour it reads the daily visits with the same token (`GET /api/content/_analytics/rollups`): 90 days the first time, then the last 3 days again, since yesterday's totals become final overnight. The site list shows a 30-day line of visitors and this week against last on wide screens. A site's page has a Traffic section: visitors and pageviews over 30 or 90 days, the numbers against the period before, and the top pages, sources, countries and devices. The visits are daily totals: no visitor, address or cookie ever reaches Keeper. A site without the plugin shows no Traffic section. A site on an older tinyzoo shows a short note there.
- **Traffic drops.** When a site's last 7 complete days have fewer than 40 % of the visitors a day of the 4 weeks before, Keeper e-mails once and lists the site under *Needs you*. This only applies to sites with at least 20 visitors a day in those 4 weeks and 5 weeks of counting. Keeper e-mails again when visits are back to 60 % of the usual level. After 4 weeks the lower level counts as the new usual one, and the site leaves *Needs you* without an e-mail. A drop like that is often a broken deploy, a tracker left out of the pages, or a site that lost its place in search.
- **Into the admin.** Every site has an *Open admin* button.

## Clients, roles and access

Sites belong to a client (or none): name one on the site form, or add clients in Settings. The site list filters by client (`/?client=<id>`), and a client can have its own alert addresses, told on top of the team's.

| Role | Sees | Can do |
|---|---|---|
| Owner | every site | everything; the only one who makes or removes owners |
| Admin | every site | the team, clients, settings and sites |
| Member | every client, or only some | add, change, check and remove the sites they see |
| Viewer | every client, or only some | only look: for a client's own people |

People limited to some clients see only those clients' sites, everywhere: the API, traffic, the MCP server and alert e-mails (without the team's alert addresses, alerts go to everyone who works on that site, not to viewers). Tokens act as their maker, so a viewer's token only reads.

## Connect a site

1. On the site, set `NUXT_CMS_STATUS_TOKEN` to a long random value (`openssl rand -hex 32`) and redeploy. It needs tinyzoo 1.1 or newer; without the token, Keeper still checks uptime and the certificate. For traffic, the site also uses `tinyzoo/analytics` on tinyzoo 1.2 or newer, which shares its daily totals.
2. In Keeper, click *Add site*, then paste the site's address and the token. *Test connection* tells you whether both work.

## The MCP server, OAuth and access tokens

`POST /mcp` is an MCP server (Streamable HTTP, stateless, both protocol eras). Read tools: `fleet_summary` (also traffic drops), `list_sites`, `list_clients`, `get_site` (also this week's visitors against last), `site_traffic` (visitors, pageviews, the trend and the top lists over 7 to 365 days), `list_versions`, `list_incidents`. Write tools, for a write grant: `add_site`, `update_site`, `check_site`, `remove_site`. They go through the same code as the API, and no tool ever returns a site's status token.

**Signing in (OAuth).** A program that speaks OAuth needs only the address. It finds Keeper's sign-in from the 401 (`/.well-known/oauth-protected-resource`, RFC 9728), registers itself (RFC 7591) and sends you to Keeper's consent page. You choose read or read and write; it gets an access token for an hour and a refresh token that lasts 60 days from its last use. PKCE (S256) is required. Codes and tokens are stored only as SHA-256. Each connection shows in *Settings → Access tokens* as "Signed in from …" and is disconnected there (or by the program, RFC 7009).

```sh
claude mcp add --scope user --transport http keeper https://keeper.example.com/mcp
```

**Tokens made by hand.** For a script, or a program that cannot sign in: *Settings → Access tokens* makes a `kpr_…` token, shown once, read or write, until it is revoked. Send it as `Authorization: Bearer kpr_…`. The `/api/sites` routes take one too.

Either kind acts as the person who connected it, while they are in the team. Wrong tokens are counted per address: after 20 in 10 minutes Keeper answers 429. The MCP and OAuth endpoints answer other origins (`Access-Control-Allow-Origin: *`, never with credentials); the rest of Keeper does not.

## Run it (developing Keeper)

```sh
cp keeper/.env.example keeper/.env   # fill in the secrets
pnpm --filter tinyzoo-keeper dev     # http://localhost:3100
```

The database (`NUXT_DATABASE_URL`) is migrated when Keeper starts: the SQL ships inside the server build. The first visit asks for the first account and the team's name; in production it also asks for `NUXT_SETUP_TOKEN`.

| Variable | |
|---|---|
| `NUXT_DATABASE_URL` | Postgres (or `DATABASE_URL`) |
| `NUXT_APP_SECRET` | seals the sign-in cookie, 32+ characters (`openssl rand -base64 32`) |
| `NUXT_KEEPER_SECRET` | encrypts the stored site tokens, 32+ characters. Changing it makes them unreadable |
| `NUXT_SETUP_TOKEN` | asked for when the first account is made; required in production |
| `NUXT_PUBLIC_URL` | Keeper's address, for links in e-mails |
| `NUXT_MAIL_TRANSPORT`, `NUXT_MAIL_FROM`, `NUXT_MAIL_SMTP_HOST`, `_PORT`, `_SECURE`, `_USER`, `_PASS` | alert e-mails (`log` prints them) |
| `NUXT_CHECKS_DOWN_AFTER` | failed checks in a row before a site is down (default 2) |
| `NUXT_CHECKS_TIMEOUT_MS` | how long a check waits (default 10000) |
| `NUXT_CHECKS_STATUS_EVERY_MIN` | how often the status is read (default 5) |
| `NUXT_CHECKS_KEEP_DAYS` | how long single checks are kept (default 90) |

## Deploy: a project that extends Keeper

Keeper is also a Nuxt layer. A deployment is a small app of its own with `extends: ['tinyzoo-keeper']`, the way a website extends tinyzoo. It holds only its settings and its `deploy.yml`, and Pushbase builds it like any Nuxt app. Ours is `~/Coding/VSCodeProjects/keeper`.

To hand the deployment a new Keeper:

```sh
pnpm --filter tinyzoo-keeper pack:to ~/Coding/VSCodeProjects/keeper
```

This packs the layer into that project's `vendor/` and points its dependency there. Then run `pnpm install` and deploy from that project.

Inside the layer, paths are relative to its own files, never `~` (which would mean the extending app). Its types are under `#keeper/…`, not `#shared/…`.

## Schema

`server/db/schema.ts`. After a change run `pnpm --filter tinyzoo-keeper db:generate` and commit the migration.
