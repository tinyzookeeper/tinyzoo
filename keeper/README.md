# Keeper

One overview of every tinyzoo site you look after: whether each one is up, which tinyzoo it runs, how its client uses the admin, and a way into each admin.

Self-hosted for now, with one team (a *workspace*). Every table already carries the workspace, so a hosted Keeper for many teams can come later without moving data.

## What it does

- **Uptime.** Every minute it asks each site for `GET /api/health/ready`. After 2 failed checks in a row the site counts as down: Keeper opens an incident and e-mails the team. It e-mails again when the site is back.
- **Status.** Every 5 minutes it reads `GET /api/health/status` with the site's token: the tinyzoo version, the database, the collections, accounts, media, errors and plugins.
- **Versions.** Sites running an older tinyzoo than the newest release on npm are marked.
- **Certificates.** Twice a day it reads each site's TLS certificate, and e-mails once when one expires within 14 days.
- **Into the admin.** Every site has an *Open admin* button.

## Connect a site

1. On the site, set `NUXT_CMS_STATUS_TOKEN` to a long random value (`openssl rand -hex 32`) and redeploy. It needs tinyzoo 1.1 or newer; without the token, Keeper still checks uptime and the certificate.
2. In Keeper, click *Add site*, then paste the site's address and the token. *Test connection* tells you whether both work.

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
