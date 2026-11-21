# Keeper

One overview of every tinyzoo site you look after: whether each one is up, which tinyzoo it runs, how its client uses the admin, and a way into each admin.

Self-hosted, with as many workspaces as you look after (one per client, say). A hosted Keeper with open sign-up comes later, on the same code.

## What it does

- **Uptime.** Every minute it asks each site for `GET /api/health/ready`. After 2 failed checks in a row the site counts as down: Keeper opens an incident and e-mails the team. It e-mails again when the site is back.
- **Status.** Every 5 minutes, and within a minute of a deploy (a new build at `/_nuxt/builds/latest.json`), it reads `GET /api/health/status` with the site's token: the tinyzoo version, the database, the collections, accounts, media, errors and plugins.
- **Versions.** Sites running an older tinyzoo than the newest release on npm are marked.
- **Certificates.** Twice a day it reads each site's TLS certificate, and e-mails once when one expires within 14 days.
- **Traffic.** For a site with tinyzoo's analytics plugin (its status lists `analytics`), about once an hour it reads the daily visits with the same token (`GET /api/content/_analytics/rollups`): 90 days the first time, then the last 3 days again, since yesterday's totals become final overnight. The site list shows a 30-day line of visitors and this week against last on wide screens. A site's page has a Traffic section: visitors and pageviews over 30 or 90 days, the numbers against the period before, and the top pages, sources, countries and devices. The visits are daily totals: no visitor, address or cookie ever reaches Keeper. A site without the plugin shows no Traffic section. A site on an older tinyzoo shows a short note there.
- **Today, live.** A site on tinyzoo 1.6 or newer also answers `GET /api/content/_analytics/live` with the same token: who is on it right now (the last 5 minutes), today so far by hour, today's top lists, and yesterday up to the same time. Keeper asks only while someone looks (a page every 30 seconds, or the MCP server) and keeps each answer 20 seconds, so a site hears from it at most about three times a minute; nothing of it is stored. A site's Traffic section opens on *Today*, and its 7, 30 and 90 days end with today so far as a dashed point.
- **Traffic across sites.** *Visitors* in the sidebar adds up every site of a workspace and team, or of every workspace you work in: who is on them now, the totals against the period before, one chart, the sites side by side (sortable, with their share and trend), and the top pages, sources, countries and devices across them, today live or over 7, 30 or 90 days. The table downloads as CSV, a day (or an hour) per column. Visitors add up per site, so one person on two sites counts twice.
- **Simple or Detailed.** The visits read two ways, one switch apart, and Keeper remembers the choice per person (a cookie). *Simple* says it in words: how many people came, how that compares with the period before ("About a fifth fewer than last month"), who is there now, one warm line of visitors with the period before dashed, what they read and how they found the site; the workspace's *Visitors* page is a card per site with its animal, its people, a mood ("Quieter than usual", "Busier than usual", "Steady") and a small line, the sites that need a look first. *Detailed* keeps the usual numbers: visitors, pageviews, visits, time per visit, changes in %, the days as a table, the sortable table of sites and the CSV. Owners and admins open on Detailed, everyone else on Simple. A drop in visitors shows in both as a calm note with *Check the site now*.
- **Traffic drops.** When a site's last 7 complete days have fewer than 40 % of the visitors a day of the 4 weeks before, Keeper e-mails once and lists the site under *Needs you*. This only applies to sites with at least 20 visitors a day in those 4 weeks and 5 weeks of counting. Keeper e-mails again when visits are back to 60 % of the usual level. After 4 weeks the lower level counts as the new usual one, and the site leaves *Needs you* without an e-mail. A drop like that is often a broken deploy, a tracker left out of the pages, or a site that lost its place in search.
- **Into the admin.** Every site has an *Open admin* button.

## Workspaces, teams and people

Keeper follows Postyard's model: **workspace › team › site**.

- A **workspace** is a company, or one client. Its people, alert addresses and invitations are its own. The workspace switcher sits at the top of the sidebar; *New workspace* makes one you own.
- A **team** is a group of sites inside a workspace: a product, or a client's sites. Every workspace has one default team (a new one starts with "General"), where new sites and invitations go when no team is named. A workspace with a single team shows no team switcher. A team's menu (*Settings → Teams*) can **move it to another workspace** with its sites, their history and its people (an owner or admin of both); a workspace left with nothing in it can then be deleted (*Settings → General*, owners).
- A **site** belongs to one team. Its id never changes.

**Every workspace** (`/home`) is one list of every site in all the workspaces you work in, grouped by workspace, trouble first: down, certificates running out, unreadable status, drops in visitors, server errors, an older tinyzoo. Workspaces with nothing to say fold into one line. *Versions* there (`/home/versions`) covers them all too. It is where you land when you work in more than one workspace; with one, Keeper opens that one, and a workspace where you are a guest is left out.

The scope is in the address: `/w/<workspace>/t/<team|all>/…`, with `t/all` for every team you see. Slugs are made from the names once and never follow a rename. Older addresses (`/sites/<id>`, links in e-mails sent before workspaces, `/versions`, `/settings`) redirect into the right place. Inside a workspace, Keeper remembers the team you were in.

| Role in a workspace | Sees | Can do |
|---|---|---|
| Owner | every team | everything; the only one who makes or removes owners, deletes the workspace |
| Admin | every team | the workspace, its teams, people, alerts and sites |
| Member | the teams they are on | add, change, check and remove those teams' sites |
| Guest | the teams they are on | only look: for a client's own people |

**The guest view.** A guest sees their sites in plain words and nothing else: whether each is up, its outages over 30 days, visitors, speed and how long its certificate lasts, signed "looked after by …" (*Settings → General → Looked after by*; empty: the workspace's name). No versions, tokens, errors, admin links or settings besides their password.

On a team, someone is a **lead** or a **member**. A lead renames the team and chooses who is on it.

**Invitations.** People join by invitation only; there is no sign-up page. An owner or admin opens *Settings → People → Invite*, enters one or more addresses, a role and the teams they join (none: the default team; a guest always names teams). Each gets an e-mail with a link that works for 7 days. The link makes the account (name and password), or, for an address that already has one, asks its password and adds it to the workspace. While e-mail is not set up (`NUXT_MAIL_TRANSPORT=log`), or when sending fails, the dialog shows each link to pass on yourself. Open invitations are listed under People, where they can be sent again (a new link, 7 more days) or taken back. Only an owner invites an owner. The first account (and its workspace) is made on the setup page.

What someone sees holds everywhere: the API, traffic, the MCP server and alert e-mails. A workspace's alert addresses hear about all its sites; without them, alerts go to everyone there who works on the site (owners, admins and the members of its team, never guests). Tokens are personal: one acts as its maker in every workspace they are in, and only reads where they are a guest.

**From clients to workspaces (0.10.0).** Migration 0008 turns each client of the old single workspace into a workspace of its own, with one team named after the client holding its sites. Each client's "also alert" addresses join its workspace's alert list (with the people who heard before). People join the client workspaces they could see (owners and admins all of them), viewers become guests, and existing tokens keep working.

## Connect a site

1. On the site, set `NUXT_CMS_STATUS_TOKEN` to a long random value (`openssl rand -hex 32`) and redeploy. It needs tinyzoo 1.1 or newer; without the token, Keeper still checks uptime and the certificate. For traffic, the site also uses `tinyzoo/analytics` on tinyzoo 1.3 or newer, which shares its daily totals.
2. In Keeper, click *Add site*, then paste the site's address and the token. *Test connection* tells you whether both work.

## The MCP server, OAuth and access tokens

`POST /mcp` is an MCP server (Streamable HTTP, stateless, both protocol eras). Read tools: `fleet_summary` (also traffic drops), `list_workspaces` (`list_clients` is its older name), `list_sites`, `get_site` (also this week's visitors against last), `site_traffic` (visitors, pageviews, the trend and the top lists over 7 to 365 days, and today live), `workspace_traffic` (all the sites of a workspace, a team or every workspace added up, with a line per site, today live or over 7, 30 or 90 days), `list_versions`, `list_incidents`. Write tools, for a write grant: `add_site`, `update_site`, `check_site`, `remove_site`. Every tool answers for all your workspaces, or for one given as `workspace` (name, slug or id); `add_site` takes `workspace` and `team`. They go through the same code as the API, and no tool ever returns a site's status token.

**Signing in (OAuth).** A program that speaks OAuth needs only the address. It finds Keeper's sign-in from the 401 (`/.well-known/oauth-protected-resource`, RFC 9728), registers itself (RFC 7591) and sends you to Keeper's consent page. You choose read or read and write; it gets an access token for an hour and a refresh token that lasts 60 days from its last use. PKCE (S256) is required. Codes and tokens are stored only as SHA-256. Each connection shows in *Settings → Access tokens* as "Signed in from …" and is disconnected there (or by the program, RFC 7009).

```sh
claude mcp add --scope user --transport http keeper https://keeper.example.com/mcp
```

**Tokens made by hand.** For a script, or a program that cannot sign in: *Settings → Access tokens* makes a `kpr_…` token, shown once, read or write, until it is revoked. Send it as `Authorization: Bearer kpr_…`. The `/api/sites` routes take one too.

Either kind acts as the person who connected it, in every workspace they are in. Wrong tokens are counted per address: after 20 in 10 minutes Keeper answers 429. The MCP and OAuth endpoints answer other origins (`Access-Control-Allow-Origin: *`, never with credentials); the rest of Keeper does not.

### E-mail through Zimbra (or any SMTP server)

Make a mailbox (or an alias) for Keeper on the Zimbra server, then set:

```sh
NUXT_MAIL_TRANSPORT=smtp
NUXT_MAIL_FROM="Keeper <keeper@example.com>"
NUXT_MAIL_SMTP_HOST=mail.example.com
NUXT_MAIL_SMTP_PORT=587
NUXT_MAIL_SMTP_REQUIRE_TLS=true
NUXT_MAIL_SMTP_USER=keeper@example.com
NUXT_MAIL_SMTP_PASS=…
```

Zimbra usually wants the sender to be the signed-in mailbox or one of its aliases. With port 465 use `NUXT_MAIL_SMTP_SECURE=true` instead of `REQUIRE_TLS`. *Settings → Alerts* shows how Keeper sends and has *Send a test e-mail*.

## Run it (developing Keeper)

```sh
cp keeper/.env.example keeper/.env   # fill in the secrets
pnpm --filter tinyzoo-keeper dev     # http://localhost:3100
```

The database (`NUXT_DATABASE_URL`) is migrated when Keeper starts: the SQL ships inside the server build. The first visit asks for the first account and its workspace's name; in production it also asks for `NUXT_SETUP_TOKEN`.

| Variable | |
|---|---|
| `NUXT_DATABASE_URL` | Postgres (or `DATABASE_URL`) |
| `NUXT_APP_SECRET` | seals the sign-in cookie, 32+ characters (`openssl rand -base64 32`) |
| `NUXT_KEEPER_SECRET` | encrypts the stored site tokens, 32+ characters. Changing it makes them unreadable |
| `NUXT_SETUP_TOKEN` | asked for when the first account is made; required in production |
| `NUXT_PUBLIC_URL` | Keeper's address, for links in e-mails |
| `NUXT_MAIL_TRANSPORT` | `smtp` sends alerts and invitations; `log` (default) only prints them |
| `NUXT_MAIL_FROM` | the sender, e.g. `Keeper <keeper@example.com>` (default: the SMTP user) |
| `NUXT_MAIL_SMTP_HOST`, `_PORT`, `_USER`, `_PASS` | the SMTP server (port 587 by default) |
| `NUXT_MAIL_SMTP_SECURE` | `true` for TLS from the start (port 465) |
| `NUXT_MAIL_SMTP_REQUIRE_TLS` | `true` refuses to send without STARTTLS (port 587) |
| `NUXT_MAIL_SMTP_TLS_REJECT_UNAUTHORIZED` | `false` accepts a self-signed certificate |
| `NUXT_MAIL_SMTP_NAME` | the host name Keeper greets the server with |
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
