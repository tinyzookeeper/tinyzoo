# Deploying

This page shows how a site built on the CMS runs in production, with Pushbase as the worked example. You need it when you take a site live.

The same steps apply to any container host. Only the build output (`.output/`) ships. The database and Redis are services next to it, and media go to object storage.

## The short version

To take a site live:

1. Provision the services the site needs: Postgres, Redis, a bucket and SMTP. See [What runs](#what-runs).
2. Build the image from the `Dockerfile` in [A client site on any container host](#a-client-site-on-any-container-host).
3. Set the environment on the platform. [Environment](#environment) lists every variable.
4. Point media at the bucket before the first upload. A container's own disk is lost on every deploy. See [Media](#media), and for a private bucket [Pushbase / private buckets](#pushbase--private-buckets).
5. Set `NUXT_CMS_MIGRATIONS_ON_START=true`, so the server migrates itself. See [Migrations](#migrations).
6. Start the site and create the first administrator with the setup code. The code is in the log, or it is `NUXT_CMS_AUTH_SETUP_TOKEN` when you set one. See [First run: the setup code](#first-run-the-setup-code).
7. Work through [Before the site goes live](#before-the-site-goes-live): the admin's name, `robots.txt`, the sitemap and the public address.
8. Probe the container with the [health](#health) endpoints, and decide what a CDN may [cache](#caching).
9. Take a backup and try a restore once. See [Backups and restore](#backups-and-restore) and the [restore drill](#restore-drill).
10. Write the privacy policy from [Privacy (GDPR)](#privacy-gdpr).

On Pushbase, [Pushbase, step by step](#pushbase-step-by-step) walks through the same list.

## What runs

One Node process runs per replica:

```text
node .output/server/index.mjs
```

It listens on `PORT` (Pushbase: 3000, with `HOST=0.0.0.0`). It serves the website, `/admin`, the admin API and the public content API.

The Node version must fit `^22.22.3 || ^24.15.0 || >=26.0.0`. These are the lines that both Node.js and Nuxt support ([which lines 1.x keeps](stability.md#platform-and-dependencies)).

The site needs four things next to it:

| Needs | Why | On Pushbase |
|---|---|---|
| Postgres 16+ (for all of 1.x) | all content, accounts, audit log | managed Postgres, linked → `DATABASE_URL` |
| Redis (or Valkey) | rate limits shared by replicas, change fan-out (caches, realtime) | managed Redis, linked → `REDIS_URL` |
| S3-compatible bucket | media (containers have no lasting disk) | external — see [Media](#media) |
| SMTP | invitations, password resets, email-change links and notices | external (any provider) |

### Without Redis

Everything still works on **one** replica without Redis.

With several replicas, each one counts rate limits on its own. Each also sees the other replicas' content changes only after its caches expire (redirects: 30 s, sitemap: 1 hour). So set `REDIS_URL` when you run more than one replica.

### A client site on any container host

A site made with `tinyzoo init` is an ordinary Nuxt app in its own repository. Any host that runs a container (or a plain Node process) can run it. Put this `Dockerfile` next to `package.json`:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=4096
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
# Only the build output ships: no node_modules, no source. The migrations are inside it.
COPY --from=build /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

Then, on the host:

1. Build the image. The build needs no database and no secrets, so one image serves every environment.
2. Put the settings in the container's environment (see below).
3. Probe `GET /api/health/live` and `/api/health/ready` on the container's port.
4. On the first start, read `Setup code: …` in the log and finish at `/admin/setup` ([First run](#first-run-the-setup-code)).

The settings are read when the container starts. Set these:

- `DATABASE_URL`
- `NUXT_APP_SECRET`
- `NUXT_CMS_PUBLIC_URL`
- `NUXT_CMS_MIGRATIONS_ON_START=true`
- The storage variables: `NUXT_CMS_STORAGE_DRIVER=s3` and `NUXT_CMS_STORAGE_S3_*`. A container's own disk is gone after every deploy.
- The mail variables: `NUXT_CMS_MAIL_TRANSPORT=smtp`, `NUXT_CMS_MAIL_FROM` and `NUXT_CMS_MAIL_SMTP_*`.

The [Environment](#environment) table has the rest. Without a `.env`, nothing is read from files, so put every value on the platform.

Try it on your machine before the host does:

```bash
docker build -t my-site .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://site:site@host.docker.internal:5433/site \
  -e NUXT_APP_SECRET="$(openssl rand -base64 32)" \
  -e NUXT_CMS_PUBLIC_URL=http://localhost:3000 \
  -e NUXT_CMS_MIGRATIONS_ON_START=true \
  -e NUXT_CMS_STORAGE_LOCAL_DIR=/tmp/uploads \
  my-site
```

`host.docker.internal` is how a container reaches a database on your own machine from Docker Desktop. On Linux, add `--add-host=host.docker.internal:host-gateway`. Without a bucket, uploads go to the container's disk and are lost with it.

#### Details

- **Pin pnpm.** Use `corepack prepare pnpm@10`, or a `"packageManager": "pnpm@10.x"` in `package.json`, which `corepack enable` then follows. Without either, the image takes the newest pnpm. A newer pnpm can refuse the install by its own rules. It did, for packages published the day before.
- **What ships is `.output/` and nothing else.** `pnpm build` (`nuxt build`) writes it. `node .output/server/index.mjs` starts it, on `HOST`:`PORT`. It does not need `node_modules`, `cms.config.ts` or `server/db/` next to it.
- **The migrations are bundled.** They are the site's `server/db/migrations`, taken into the build. They are applied when the server starts, **if** `NUXT_CMS_MIGRATIONS_ON_START=true`.
- **Several replicas** need `REDIS_URL` (see [What runs](#what-runs)).
- **HTTPS and the public domain** are the platform's job. `NUXT_CMS_AUTH_TRUSTED_PROXIES` says how many proxies are in front.

## Before the site goes live

[Getting started](guide/getting-started.md#going-live) has the checklist with the reasons. These are the items people forget, in one place:

- **The admin's name.** `cms.admin.name` in `app/app.config.ts` (per language) is what the admin's top left, its sign-in page and its browser tab say. The starter ships "My website". Set it to the client's name before anybody signs in.
- **`robots.txt` and the sitemap.** Open both on the live address. Check that the sitemap's addresses start with the site's real address.
- **The public address.** `NUXT_CMS_PUBLIC_URL` is also the base of the sitemap (unless `NUXT_SITE_URL` is set) and of the starter's canonical and `hreflang` links.

### More on `robots.txt` and the sitemap

- The starter serves `/robots.txt`. It `Disallow`s the admin and names the sitemap.
- Every tinyzoo site serves `/sitemap.xml` ([`@nuxtjs/sitemap`](guide/content-api.md#the-sitemap)).
- A site not made from the starter needs its own `robots.txt`. Use a file in `public/`, a `server/routes/robots.txt.get.ts`, or [`@nuxtjs/robots`](https://nuxtseo.com/docs/robots), which names the sitemap by itself.
- Addresses the website draws from data (the news list on a catch-all page) go in `cms.sitemap.paths` in `nuxt.config.ts`.

## Environment

Generate secrets with `openssl rand -base64 32` and set them on the platform, never in the repo. Everything below is read at runtime, so changing it needs no rebuild.

| Variable | Required | |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection (`NUXT_CMS_DATABASE_URL` overrides). The server refuses to start without one |
| `NUXT_APP_SECRET` | yes | Nuxt's app secret, at least 32 characters. See [The app secret](#the-app-secret) |
| `NUXT_CMS_PUBLIC_URL` | yes | the admin's public address, e.g. `https://www.example.cz`. See [The public address](#the-public-address) |
| `NUXT_SITE_URL`, `NUXT_SITE_INDEXABLE` | optional | [Nuxt SEO's site config](https://nuxtseo.com/docs/site-config). See [The public address](#the-public-address) |
| `NUXT_CMS_MIGRATIONS_ON_START` | recommended | `true`: apply bundled migrations at start (see [Migrations](#migrations)) |
| `REDIS_URL` | with > 1 replica | `NUXT_CMS_REDIS_URL` overrides |
| `NUXT_CMS_REDIS_PREFIX` | optional | namespace for keys and channels; default `cms:<database name>`, so environments sharing one Redis stay apart |
| `NUXT_CMS_STORAGE_DRIVER` | yes | `s3` (or `r2`) in production; `local` is for development |
| `NUXT_CMS_STORAGE_S3_ENDPOINT`, `_REGION`, `_BUCKET`, `_ACCESS_KEY_ID`, `_SECRET_ACCESS_KEY` | with s3 | bucket credentials |
| `NUXT_CMS_STORAGE_S3_PUBLIC_BASE_URL` | public bucket | where browsers load media from (the bucket's public URL or a CDN in front). Setting it makes `delivery` default to `public` |
| `NUXT_CMS_STORAGE_S3_DELIVERY` | optional | `public`, `proxy` or `redirect`: how browsers get the files, see [Pushbase / private buckets](#pushbase--private-buckets). Default: `public` with a public base URL, otherwise `proxy` |
| `NUXT_CMS_MAIL_TRANSPORT` | yes | `smtp` in production (`log` prints emails to the console) |
| `NUXT_CMS_MAIL_FROM`, `NUXT_CMS_MAIL_SMTP_HOST`, `_PORT`, `_SECURE`, `_USER`, `_PASS` | with smtp | |
| `NUXT_CMS_WEBHOOKS_URLS`, `NUXT_CMS_WEBHOOKS_SECRET` | optional | publish webhooks (see [Publish webhooks](#publish-webhooks)) |
| `NUXT_CMS_CONTENT_TOKEN` | optional | require a token on the public content API (`x-api-key` or `Authorization: Bearer`). The website's own server-side requests need none, see [Content API token](#content-api-token) |
| `NUXT_CMS_STATUS_TOKEN` | optional | turns on `/api/health/status`, a summary of the site for a tool that watches many sites, and is the token it asks for. See [Site status](#site-status) |
| `NUXT_CMS_MCP_ENABLED` | optional | `false` turns off the MCP server at `/api/mcp` and the access tokens. See [the MCP server](guide/mcp.md) |
| `NUXT_CMS_CONTENT_DOCS` | optional | `true` publishes the interactive API reference at `/api/openapi` (off in production by default, see [Content API token](#content-api-token)) |
| `NUXT_CMS_AUTH_SETUP_TOKEN` | optional | a code of your choosing that first-run setup needs (`/admin/setup?token=…`). See [First run](#first-run-the-setup-code) |
| `CMS_ALLOW_REQUEST_ORIGIN` | almost never | `1` lets email links use the address of the request. See [Email links without a public address](#email-links-without-a-public-address) |
| `NUXT_CMS_RETENTION_AUDIT_DAYS` | optional | delete audit-log entries older than this many days (default 365, `0` = keep). See [Privacy](#privacy-gdpr) |
| `NUXT_CMS_AUTH_TRUSTED_PROXIES` | optional | proxy hops in front of the app (default 1, Pushbase's ingress). Set `0` when the app is reached directly. See [Trusted proxies](#trusted-proxies) |

`playground/.env.example` lists them with local-development values.

### The app secret

`NUXT_APP_SECRET` is Nuxt's app secret.

- The sign-in cookie is sealed with a key derived from it.
- Other modules derive their keys from it too (signed image URLs, for example).
- Changing it signs everyone out.

**The server refuses to start** in three cases, and says so in the log:

- The secret is missing.
- It is shorter than 32 characters.
- It is the example value of the starter's `.env.example` (`change-me-to-a-long-random-string-32-chars-min`). Anyone can read that value.

A site set up before 0.4 has `NUXT_SESSION_PASSWORD` instead. 0.4 and 0.5 used that value as a stand-in, and 0.6 does not read it. The start check tells you to rename the variable. Keeping the value signs nobody out ([upgrading](upgrading.md#from-05-to-06)).

### The public address

`NUXT_CMS_PUBLIC_URL` is the admin's public address. It is used for:

- links in emails, and the logo in them (mail clients load it from this address);
- the server address of `/api/openapi.json`, unless `cms.content.publicUrl` / `NUXT_CMS_CONTENT_PUBLIC_URL` is set;
- the address `/sitemap.xml` starts with. `NUXT_SITE_URL` wins when it is set.

Without it, the server starts but logs one warning saying what is missing.

Mail clients load the logo in emails from `<NUXT_CMS_PUBLIC_URL>/api/cms/_brand/full-email.png`, so that address must be reachable from the internet. `GET /api/cms/_theme` and `/api/cms/_brand/*` need no sign-in (the sign-in page, the tab icons and mail clients read them). A proxy, basic auth or an IP rule in front of `/api/cms` must let them through.

`NUXT_SITE_URL` and `NUXT_SITE_INDEXABLE` come from [Nuxt SEO's site config](https://nuxtseo.com/docs/site-config):

- `NUXT_SITE_URL` is the address `/sitemap.xml` starts with when the website's address is not `NUXT_CMS_PUBLIC_URL`.
- `NUXT_SITE_INDEXABLE=false` keeps a copy of a site (a demo, a staging site) out of search engines, with `@nuxtjs/robots`.

### Trusted proxies

`NUXT_CMS_AUTH_TRUSTED_PROXIES` is the number of proxy hops in front of the app. The default is 1, which is Pushbase's ingress. Set `0` when the app is reached directly.

- Too few, and rate limits count the proxy instead of visitors.
- Too many (for example 1 with no proxy at all), and visitors can fake their address in `X-Forwarded-For` to dodge limits.

### Email links without a public address

`CMS_ALLOW_REQUEST_ORIGIN=1` lets links in emails (invitations, password resets) use the address of the request. It applies when `NUXT_CMS_PUBLIC_URL` is not set, also in production.

**Do not set it on a site with a public address.** The request's `Host` is chosen by whoever makes it, so a forged one would put an attacker's domain in a reset link.

It is for a deploy that has no public address, such as an internal tool behind a proxy you trust. It is not a `NUXT_CMS_*` setting on purpose. It is an escape hatch, read when the link is written.

### When the scheduled tasks run

Two tasks run on a schedule: publishing what is scheduled, and the daily [retention](#retention) clean-up. Their cron expressions are the `scheduler: { cron }` and `retention: { cron }` options in nuxt.config's `cms` options.

They are read **when the site is built**. A change needs a rebuild.

The old variables `CMS_SCHEDULER_CRON` and `CMS_RETENTION_CRON` were removed in 1.0. Move their values into the options. A build that still has one set stops and says which option to write.

### The setup token

`NUXT_CMS_AUTH_SETUP_TOKEN` is a secret, so it is an environment variable only. There is no `cms` option, because an option would be written into the build and into a committed `nuxt.config.ts`. Without it, the server makes a one-time code and prints it in the log (see [First run](#first-run-the-setup-code)).

## Content API token

`NUXT_CMS_CONTENT_TOKEN` closes `/api/content/*` (and `/api/openapi.json`) to everyone who comes from outside without the token. Send it as `x-api-key: <token>` or `Authorization: Bearer <token>`.

The cases:

- **The website itself needs no token.** Its pages fetch the content API *inside the server* while they render (`useFetch('/api/content/…')`, `$fetch`, `event.$fetch`). Nitro answers those in-process, with no network hop. They are the site, not a visitor, so they are let through.
- **The token never reaches a browser or the page's HTML.** An outside request cannot pass for an in-process one whatever headers it sends.
- **A browser cannot call the API itself.** On client-side navigation a `useFetch` runs in the browser, which has no token (and must not get one). With a token, render content on the server. Or put a route of the site's own in between that asks for it server-side.
- **A separate site or a script** sends the token itself, from its server. Examples are `createClient({ token })`, a build step and a cache purge.
- **Drafts** (`?preview`) stay behind the token or an admin session. Rendering a page in-process does not unlock them.
- **Refused requests are counted.** Requests refused for a missing or wrong token are logged as one line at most once a minute (`[cms] 3 content API requests refused: …`). So a site that cannot read its own content does not fail in silence.

### The interactive API reference

The reference at `/api/openapi` is Scalar, loaded from jsDelivr, and public on the admin's origin.

- It is **off in production** unless `cms.content.docs: true` (`NUXT_CMS_CONTENT_DOCS=true`).
- In development it is on.
- With a token it is always off, because a browser cannot send the key.
- It loads one pinned version of the script, checked by its hash.

`/api/openapi.json` is the document that code generators read (`openapi-typescript https://…/api/openapi.json`). It is **not** behind that switch. It describes only what the public content API returns, and a token closes it.

## First run: the setup code

A new deploy has no administrator, and `/admin/setup` is reachable by anyone who knows the address. So in production, first-run setup always asks for a **setup code**.

To get the code:

- With `NUXT_CMS_AUTH_SETUP_TOKEN` set, that value is the code. Open `/admin/setup?token=<value>` to have it filled in.
- Without it, the server **makes a one-time code when it starts** and prints one line in its log:

  ```
  [cms] No administrator yet. Setup code: K7QM-2XVD-R9TE-HC4Y — open https://www.example.cz/admin/setup
  ```

  Open the project's log (Pushbase: the deploy/runtime log) and find the line. Type the code into the setup page. Capitals, dashes and spaces do not matter.

Development (`nuxt dev`, `NODE_ENV=development` or `test`) needs no code. Anything else counts as production, so an unset `NODE_ENV` does not leave a deploy open.

### How the code works

- The code is 16 characters from an alphabet without look-alikes (80 bits).
- With several replicas it is shared. The replica that stores it first prints it. The others say it was issued.
- Only its hash is kept in the database (`cms_state`, key `setup_code`).
- It is deleted in the same transaction that creates the first account.
- A restart while there is still no account prints the code again if it is older than five minutes. A new one replaces it, and the old one stops working. A fresher code is left alone.
- Wrong codes are answered `403`. They are counted by the rate limit (10 attempts per quarter hour per visitor) and written to the audit log (`auth.setup_failed`).

### Seeding a deployed site

`tinyzoo seed` (see [Seeding](guide/seeding.md)) works against a deployed site from your own machine. It needs only the site's address and an administrator, never the database.

Use the setup code to create the first account from the seed itself:

```sh
SEED_URL=https://www.example.cz SEED_EMAIL=you@example.cz SEED_PASSWORD='…' \
SEED_SETUP_CODE=K7QM-2XVD-R9TE-HC4Y   pnpm seed            # a new site: creates the account, then seeds
SEED_URL=https://www.example.cz SEED_EMAIL=you@example.cz SEED_PASSWORD='…'   pnpm seed --dry-run   # an existing one: what would change
```

Use `https://`. The command warns when the password would travel unencrypted.

Send only what belongs on a live site. `s.upsert` brings pages up to the seed. `s.create` leaves what editors have written alone.

## Migrations

The platform has no release step, so the app migrates itself. Set this:

```text
NUXT_CMS_MIGRATIONS_ON_START=true
```

When the server starts, it applies the bundled migrations. These are the host app's `server/db/migrations`, generated by `pnpm tinyzoo generate`. API requests wait for it. A Postgres advisory lock makes concurrent replicas take turns, so the first one migrates and the rest find nothing to do.

Before a deploy that changes the schema, take a backup (see [Backups and restore](#backups-and-restore)).

### Running them yourself

- The bookkeeping is drizzle's own (`drizzle.__drizzle_migrations`), so running `drizzle-kit migrate` by hand stays compatible.
- The same start also runs tinyzoo's **upgrade steps**. These are the data work of an upgrade that a migration cannot express, recorded in `cms_upgrades`. They run in the same transaction.
- `tinyzoo up` does exactly the same from the command line. It reads `DATABASE_URL` from the environment or the site's `.env`.
- `tinyzoo status` tells what is still pending. It exits with code 1 when something is, which is handy as a deploy check.
- A migration that was never applied but is older than one that was (two branches each generated one) stops the start with an error naming the file. It is not skipped.

See [upgrading.md](upgrading.md).

### When it fails

- If the database does not accept connections yet (freshly provisioned, restarting), the instance retries for about a minute and a half.
- A migration that fails is logged. The API answers 503 instead of running on a half-migrated schema, and `/api/health/live` fails.
- In production the process exits, so the platform restarts it.
- Pushbase's readiness check is the open port, so watch the deploy log after a schema change.
- Destructive changes (dropping a column the running version still reads) need two deploys: stop using it, then drop it ([the two-step rule](upgrading.md#the-two-step-rule)).
- To restore after a failed upgrade, restore the database backup taken before it.

### Exit codes

These are for a deploy script or CI step. `0` is success everywhere. What else a command answers:

| Command | Exit code |
|---|---|
| `tinyzoo up` | `1`: a migration failed, the migrations are out of order, or `DATABASE_URL` is missing or does not connect |
| `tinyzoo status` | `0` up to date · `1` something is pending, or out of order · **`2` the database could not be read** (a deploy check should treat `2` as a failure of its own, not as "pending") |
| `tinyzoo generate`, `tinyzoo upgrade` | `1`: drizzle-kit failed, it needs a terminal to ask about a rename, or the guard removed a migration that loses data or may fail on existing rows (CI always gets this unless `--allow-drop` / `--allow-risky` is given). `upgrade` also stops with `1` when its typed client step fails |
| `tinyzoo content:migrate` | `1`: some blocks could not be upgraded (they stay as stored), the arguments are wrong, or there is no `DATABASE_URL` |
| `tinyzoo links:convert` | `1`: wrong arguments, or no `DATABASE_URL`. Addresses it could not convert are reported, not an error: the exit code is `0` |
| `tinyzoo seed`, `export`, `import`, `backup`, `restore` | `1`: the command failed or refused (a non-empty database without `--force`, a missing Postgres tool, a wrong password); one line says why |
| `tinyzoo init` | `1`: no folder given, an option it does not know or that does not fit (`--demo` with a first language that is not `cs` or `en`), or the folder exists and is not empty |
| anything else | an unknown command prints the usage and exits `1` |

## Health

Probe these two endpoints on the container's port:

- `GET /api/health/live` says the process is up (liveness). It fails when start-up migrations gave up.
- `GET /api/health/ready` says migrations are done and the database answers (readiness).

### Site status

When you look after several sites, `GET /api/health/status` tells a monitoring tool what it needs to list this one. It is off (`404`) until you set `NUXT_CMS_STATUS_TOKEN` to a long random value (`openssl rand -hex 32`). The request then carries the token as `x-api-key: <token>` or `Authorization: Bearer <token>`. A signed-in admin without the token gets `401` as well, and one address may ask 30 times a minute.

```sh
curl -H "x-api-key: $NUXT_CMS_STATUS_TOKEN" https://example.com/api/health/status
```

The answer (`CmsStatus` in `tinyzoo`) has:

- the tinyzoo and Node.js versions, and when this instance started;
- the site's public address, where its admin is, the sign-in mode and the content languages;
- whether the database answers, the state of start-up migrations and the database's size;
- every collection and global with how many entries it holds and when one was last saved, and how many entries wait for a translation;
- how many accounts are active, invited and disabled, how many signed in during the last 30 days, and the last sign-in;
- how many media files there are and their total size;
- how many webhook addresses are set and whether a secret signs them;
- the server errors this instance reported in the last 24 hours, by request, task and webhook;
- the plugins and their versions.

It holds numbers, dates, versions and names from `cms.config.ts`. It never holds content, anyone's name or email, or a secret. The error counts are kept in memory, so a restart starts them again from 0, and each replica counts its own.

`format: 'tinyzoo-status'` and `version: 1` say how to read it. Within version 1, keys are only added, so a reader ignores the ones it does not know.

## Caching

This section lists what the app sends, so a CDN in front of it can be set up for exactly that.

| Response | `Cache-Control` | Notes |
|---|---|---|
| Content API (`/api/content/…`) | `public, max-age=0, must-revalidate, s-maxage=300` | a **shared cache (CDN) may keep it 5 minutes** (`s-maxage`). See [The content API](#the-content-api) |
| Media files and picture sizes (`/api/cms/_media/raw/…`, `/api/cms/_media/img/…`) | `public, max-age=31536000, immutable` | a new upload has a new address, so they never change under it. These addresses are frozen ([media and logo addresses](api-surface.md#media-and-logo-addresses)) |
| The logo's PNG versions (`/api/cms/_brand/…png?v=…`) | `public, max-age=31536000, immutable` | with the current `v`; a new logo has a new `v`. Without it, or with an old one: `public, max-age=300` |
| `/sitemap.xml` | `public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600` | the server's own copy is cleared at once when content changes; a CDN may keep it an hour. Change it with `sitemap.cacheMaxAgeSeconds` |
| `/robots.txt` of the starter | `public, max-age=3600` | |
| The admin's theme and web manifest (`/api/cms/_theme`, `/api/cms/_brand/admin.webmanifest`) | `no-cache` | a browser may keep a copy but asks again each time |
| The admin and its API (`/admin`, `/api/cms/…`) | `no-store` | never cache |
| The website's own pages | none of the CMS's | whatever your site sets (`routeRules` in `nuxt.config.ts`); Nuxt sends no `Cache-Control` for a server-rendered page |

So "a CDN keeps content 5 minutes" is true of the content API, and of nothing else by default.

To make a change visible sooner than five minutes, purge. The [publish webhook](#publish-webhooks) says which addresses changed.

Many CDNs do not store a response that sets a cookie. Check on the live address that the answer has no `Set-Cookie` header:

```text
curl -sI https://www.example.cz/api/content/page
```

### The content API

- A shared cache (CDN) may keep a response 5 minutes (`s-maxage`).
- A browser asks again every time. It gets a quick `304` through the `ETag` while nothing changed. So a published change shows at once for visitors who reach the origin.
- Change the header with `cms.content.cacheControl`. The 5 minutes are a default that a minor release may change ([tuning](api-surface.md#numbers-promised-and-numbers-tuned)), so set it yourself when your site depends on it.
- Behind a content token, and for an editor's draft preview, the header is `private, no-store`.

## Media

Production media belong in object storage in the EU (GDPR). Two good choices are Hetzner Object Storage (Falkenstein/Nuremberg/Helsinki) and Cloudflare R2 with the EU jurisdiction.

To set it up:

1. Create a bucket.
2. Create a key limited to that bucket.
3. Set the `NUXT_CMS_STORAGE_S3_*` variables.
4. Choose how to serve the files (below).

There are two ways to serve the files:

- **A public bucket** (public read for objects), or a CDN in front of it. Set `NUXT_CMS_STORAGE_S3_PUBLIC_BASE_URL`. Browsers load files straight from there. Uploaded files are immutable (new upload = new key), so a CDN can cache them forever.
- **A private bucket** (no public read, no bucket policy), which is what Pushbase Storage is. Leave `PUBLIC_BASE_URL` out. The app serves the files itself (`proxy`, the default) or sends browsers to a short-lived signed address (`redirect`). See [Pushbase / private buckets](#pushbase--private-buckets).

The bucket is not covered by the platform's database backups. Turn on its versioning or a lifecycle copy if losing an upload matters (see [Backups and restore](#backups-and-restore)).

### Temporary files for uploads

Every upload is staged in a temporary file first, whatever the storage. The folder is `TMPDIR` (`/tmp` when unset).

A container with a read-only filesystem needs a writable folder there. Mount a volume (an `emptyDir` in Kubernetes) and point `TMPDIR` at it. Without one, uploads answer 500 and the log names the folder.

`/dev/shm` works as a stopgap. But it is memory, so a file staged there counts against the container's memory limit. Keep it for small pictures.

## Publish webhooks

A webhook lets the website purge its cache when content changes. Set the URLs and a secret:

```text
NUXT_CMS_WEBHOOKS_URLS=…
NUXT_CMS_WEBHOOKS_SECRET=…
```

Each URL in `NUXT_CMS_WEBHOOKS_URLS` gets a POST when content of a public collection that visitors can see is saved. The collection's `content.published` rule decides what is public, before or after the save. It is the same rule the content API applies.

These changes are sent: entries created, changed, published, unpublished or deleted, translations and globals. Drafts stay quiet. In production nothing is sent without a secret.

```json
{ "delivery": "…", "type": "entry.published", "entity": "post", "id": "…", "locale": null,
  "public": true, "paths": ["/blog/hello", "/en/blog/hello"], "version": "…", "at": "2026-11-13T10:00:00.000Z" }
```

`paths` are the addresses from `content.path` that visitors could reach before or after the change, in every language. A renamed slug gives both addresses. A translation change gives only that language's.

### Verifying in a Nuxt site

Check the signature before you trust a request. Each request carries these headers:

- `X-CMS-Event`
- `X-CMS-Delivery`
- `X-CMS-Signature: t=<unix>,v1=<hex>`, an HMAC-SHA256 of `` `${t}.${rawBody}` `` with `NUXT_CMS_WEBHOOKS_SECRET`

The signature header is a list of parts, split by commas. Today it holds one `t=` and one `v1=`. A later 1.x may send more than one `v1=`, or parts of a new kind. So read it like this:

- split the header on `,`;
- accept the request when **any** `v1=` value matches;
- ignore parts you do not know;
- refuse a `t` more than five minutes away from now.

```ts
// server/api/cms-hook.post.ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const raw = (await readRawBody(event)) ?? ''
  const parts = (getHeader(event, 'x-cms-signature') ?? '').split(',').map((p) => p.trim())
  const t = parts.find((p) => p.startsWith('t='))?.slice(2) ?? ''
  // CMS_WEBHOOK_SECRET holds the same value as the CMS's NUXT_CMS_WEBHOOKS_SECRET
  const expected = Buffer.from(createHmac('sha256', process.env.CMS_WEBHOOK_SECRET!).update(`${t}.${raw}`).digest('hex'))
  const fresh = /^\d+$/.test(t) && Math.abs(Date.now() / 1000 - Number(t)) <= 300
  const valid = parts.filter((p) => p.startsWith('v1=')).some((p) => {
    const sig = Buffer.from(p.slice(3))
    return sig.length === expected.length && timingSafeEqual(sig, expected)
  })
  if (!fresh || !valid) throw createError({ statusCode: 401 })
  const change = JSON.parse(raw)
  // e.g. purge the route cache for change.paths
  return { ok: true }
})
```

### In-process code

In-process code can listen too, with no network involved. It runs after the response, on the instance that saved:

```ts
// server/plugins/on-change.ts in the host app
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('cms:change', (change) => { /* … */ })
})
```

### Details

**Languages.** With `publish.perLocale`, publishing, unpublishing or a scheduled go-live of one language is an `entry.published` or `entry.unpublished` event. It has that language in `locale` and only its addresses in `paths`. An address served through the default language is included. Purge exactly those.

The default language gates the others. So unpublishing it (or its date coming) names the languages it takes with it. That is one event with `locale: null`. It carries the address of each language that was live and has a translation or a state of its own.

**Deliveries and retries.**

- `delivery` is unique per change and the same on every retry. Deduplicate on it. It is inside the signed body.
- A request is tried up to three times. The second attempt is 1 s after the first fails, and the third is 5 s later. These numbers are tuning: a minor release may change them ([what a minor may change](api-surface.md#numbers-promised-and-numbers-tuned)).
- A body may carry keys and `type` values a later 1.x adds. Ignore what you do not know.
- Failures are logged. They are also reported through the `cms:error` hook (see [Error reporting](#error-reporting)).
- The log shows the address shortened to its origin and a hash of the path, because a webhook's secret often sits in the path.

**Not reported (yet).**

- Media edits (alt text, deletion).
- Changes that show on a page only through a relation (renaming an author shown on their posts).

Purge by time for those.

## Logs

Server errors (5xx) are written to stderr as one JSON line each. The line has:

- the request id the browser got in `X-Request-Id` (an incoming `X-Request-Id` from the proxy is kept);
- the path without its query string;
- the signed-in person's id (not their email);
- the error without the bound values of a failed database query.

Expected errors (validation, permissions) are not logged. Sign-ins, invitations and content changes are in the audit log instead.

### Only the JSON line reaches the log

**That line is the only way a server error reaches the log.**

Nitro would also print every unhandled error itself (`[request error] [unhandled] [GET] <url>` and the error with its causes). For a failed query that dump carries the bound values (emails, text from a form, password hashes) and the request URL with its query string.

In production tinyzoo hushes the error before Nitro sees it:

- The message becomes the plain "Server Error" the visitor gets anyway.
- The causes are replaced by scrubbed copies.
- The error is no longer marked unhandled, which is what makes Nitro print it.

So nothing but the JSON line is written. The answer to the client does not change.

In `nuxt dev` Nitro's own output stays, because a developer wants it.

If your site has its own Nitro `error` hook, whether it sees the hushed error or the original depends on which plugin registered first. Use `cms:error` (see [Error reporting](#error-reporting)) when you need the original.

### What can still appear in a log

- **A driver message that names a value.** The message is kept because it says what went wrong (`Query failed: relation "post" does not exist (42P01)`). In rare cases the database includes a value in it (`invalid input syntax for type uuid: "…"`). Such a line can hold what a visitor typed into an address. Treat the log as a place where a few such details may land.
- **A mail server's refusal** names the address. tinyzoo replaces anything that looks like an email with `<email>` in the lines it logs about failed mail.
- **`cms.mail.transport: "log"`** writes the receiver's address to the log by design. Outside production it writes the whole message with its one-time link. It is for trying things out, not for a live site.
- **Your own code.** A `console.error(err)` in a site's plugin or route prints what it is given. Pass `scrubError`-style copies (`report.error` from `cms:error`) or log the message only.
- **The platform's own access logs** (the reverse proxy, Pushbase) record request lines with their query strings. The Privacy lookup sends the address in the request body for that reason. But a search term typed into the admin's search (`?q=`) is in the proxy's log.

### Error reporting

Besides the log line, every server error runs a Nitro runtime hook, **`cms:error`**. A site can use it to send the error to an error tracker (Sentry, GlitchTip, a Slack message…).

The package depends on no vendor. Subscribe in a server plugin of the site:

```ts
// server/plugins/sentry.ts in the site
import * as Sentry from '@sentry/node'

export default defineNitroPlugin((nitroApp) => {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV })
  nitroApp.hooks.hook('cms:error', (report) => {
    Sentry.withScope((scope) => {
      scope.setTag('source', report.source) // request | task | webhook
      if (report.requestId) scope.setTag('request_id', report.requestId)
      if (report.userId) scope.setUser({ id: report.userId }) // an id, never an email
      scope.setContext('cms', { status: report.status, method: report.method, path: report.path, task: report.task, webhook: report.webhook })
      Sentry.captureException(report.error) // already scrubbed; never send report.rawError
    })
  })
})
```

The hook runs after the response and never waits for your code. It never breaks anything: a hook that throws is logged (`cms:error hook failed`) and ignored. Expected errors (4xx) and the 503s of a migration in progress are not reported.

#### The report

The hook gets a `CmsErrorReport`. It is typed through `NitroRuntimeHooks` and exported from `tinyzoo`.

| Field | |
|---|---|
| `source` | `request` (a 5xx answer), `task` (a scheduled task threw: `cms:scheduled`, `cms:retention`, `cms:search-reindex`) or `webhook` (a publish webhook gave up after its retries) |
| `error`, `message` | `error` is an `Error` that is safe to send: its message is `message` (a failed database query is reduced to what the driver said, without the query's bound values), its stack frames are kept, and its causes are scrubbed the same way. `message` is the same text |
| `rawError` | the error as thrown (a copy taken before the server hushed the original, see [Logs](#logs)). **May contain personal data** (a failed query's message carries emails, form text, password hashes). Use it inside the process, for instance to read a status code, and never send it to a third party |
| `status`, `requestId`, `method`, `path`, `userId` | for requests: the status, the `X-Request-Id` the browser got, the path **without its query string**, the signed-in person's id; `null` otherwise |
| `task` / `webhook` | the task name / `{ url, type, delivery }`. `url` is the webhook's origin and a short hash of its path (`https://hooks.slack.com/…#3f9a1c20`), never the path or query, since Slack, Discord and similar services keep their secret there. The hash tells two hooks on one host apart |

#### Why `error` is a copy

The message of a failed database query (`Failed query: … params: …`) carries the bound values. These can be emails or text from a form. The web framework copies that message into the error it throws.

`report.error`, `report.message` and the log line leave the values out. The driver's own message is kept (`Query failed: relation "post" does not exist (42P01)`).

In rare cases such a message names a value too (`invalid input syntax for type uuid: "…"`). So treat your tracker as a place where a few such details can land, and keep `rawError` out.

## Realtime

The admin keeps one WebSocket per tab (`/api/cms/_live`, same port). It carries presence ("Jana is editing") and live updates. Redis carries them between replicas.

If a proxy blocks WebSockets, the admin works as before, without them.

Saves are protected either way. An editor who saves over a version someone else saved in the meantime gets a choice, and nothing is silently overwritten.

## Security

- The admin and its API answer with `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy: same-origin` and `nosniff`. The API also sends `Cache-Control: no-store`.
- Uploaded files are served with `Content-Security-Policy: sandbox` and `nosniff`.
- The session cookie is `Secure` in production and `SameSite=Lax`. State-changing API calls must be JSON from the same origin.
- A script CSP for the website itself is the host app's call, because Nuxt needs nonces for its inline hydration script. `nuxt-security` does it well.
- HTTPS is terminated by the platform. Send HSTS from there or from the app.

## Backups and restore

This table shows what holds what, and who is responsible:

| Data | Lives in | Backed up by |
|---|---|---|
| content, accounts, form messages, audit log, saved versions, the search index | Postgres | Pushbase backs up its managed Postgres. `tinyzoo backup` takes your own copy as well |
| uploaded media | the S3 bucket | **you**: turn on the bucket's versioning or replication; `tinyzoo backup` also copies the files |
| secrets and settings | the platform's environment | **you**: keep them in a password manager |

### `tinyzoo backup` and `tinyzoo restore`

Run them from the site's folder, or anywhere with the production settings in the environment. They read `NUXT_CMS_DATABASE_URL` / `DATABASE_URL` and `NUXT_CMS_STORAGE_*` the way the server does: environment first, then `.env`, then the `cms:` options of `nuxt.config`.

```bash
tinyzoo backup                              # tinyzoo-backup-<database>-<time>.tar here
tinyzoo backup backups/before-0.3.tar
tinyzoo restore backups/before-0.3.tar      # asks you to type the database's name
tinyzoo restore backups/before-0.3.tar --yes     # no question (scripts)
tinyzoo restore backups/before-0.3.tar --force   # the database already has tables: replace everything in it
```

The commands need `pg_dump`, `pg_restore` and `psql` (`brew install libpq`, `apt install postgresql-client`). See [Tools](#tools) for the versions.

Take a backup before every deploy that changes the schema. `tinyzoo backup` takes seconds on a small site. In CI, run it before the deploy step. See [No automatic backup before migrations](#no-automatic-backup-before-migrations).

#### The archive

The archive is one plain tar. List it with `tar -tf`. It holds:

- `manifest.json`: the tinyzoo version, the time and the media list.
- `database.dump`: the output of `pg_dump --format=custom`.
- `media/<key>` for every file `cms_media` refers to. The files are read from the local upload folder, or downloaded from the bucket with the same signed requests the app uses.

The resized copies under `_w/` are not included. The site makes them again.

Files the database refers to but storage no longer has are listed as missing, not silently dropped.

The archive holds password hashes, form messages and every upload. It is created readable by its owner only, before the first byte is written. Keep it as private as the database.

#### What restore does

**Restore** replaces the whole database with the backup's.

1. It turns the dump into SQL (`pg_restore -f -`).
2. It leaves out of the first lines any session setting your server does not know (see [Tools](#tools)).
3. It runs the result through `psql` in **one transaction**. The transaction first drops and recreates the `public` and `drizzle` schemas. The tables, the migration journal and the `pg_trgm` extension go with them and come back from the dump.
4. It writes the media into the configured folder or bucket.

Dropping everything, and not just what the dump contains, is what makes an **older backup over a database that was upgraded since** come out exactly as the backup was. There are no renamed tables beside the old ones and no newer journal. The restored journal lets the site start on it, and a newer version applies its migrations itself.

The restore is all or nothing, and the emptying is part of the same transaction. If anything fails, the transaction is rolled back. The database is **exactly as it was before**, not empty and not half old and half new, and the message says so. Fix the cause and run it again.

Stop the site first. A connection that holds a lock stops the drop after 15 seconds with a clear message.

#### What it refuses

It refuses a database that is not empty. That means any table in `public`, or applied migrations in `drizzle.__drizzle_migrations` (so an external-sign-in site with no accounts is protected too). Add `--force` to go ahead. A site that has run its migrations once has tables, so restoring over it needs `--force`.

It always asks you to type the database's name, unless you add `--yes`.

Before it changes anything, it checks the whole archive:

- `pg_restore` can read the dump.
- No media path leaves the media folder.
- Nothing in the archive is a link. The restore unpacks with its own reader and takes plain files only, so a symbolic link to `~/.ssh/id_rsa` can never be copied into public media.
- It does not unpack to more than 20 GiB. `TINYZOO_MAX_ARCHIVE_BYTES` changes the cap.

#### TLS to the database

`pg_dump` and `pg_restore` connect with the TLS settings of the connection string, mapped to what the app (node-postgres) does:

| In the connection string | Meaning |
|---|---|
| `sslmode=require`, `prefer`, `verify-ca`, `verify-full`, `ssl=true`, or any of `sslrootcert` / `sslcert` / `sslkey` | an encrypted connection with the certificate **and** the host name verified (libpq `verify-full`; libpq's own `require` would accept any certificate) |
| `sslmode=no-verify` | encrypted without checking (libpq `require`) |
| `sslmode=disable` | no TLS |

- The certificate files are passed on.
- `PGSSLMODE`, `PGSSLROOTCERT`, `PGSSLCERT` and `PGSSLKEY` of the shell are kept when the URL says nothing.
- With `uselibpqcompat=true` in the URL, libpq's own meanings are used.

#### Tools

The commands need `pg_dump`, `pg_restore` and `psql`. Which version works with which:

| Tool | Version it needs | Why |
|---|---|---|
| `pg_dump` (backup) | the server's major version **or newer** | `pg_dump` refuses a server newer than itself |
| `pg_restore` (restore) | **at least as new as the `pg_dump` that made the backup** | it cannot read a newer archive format |
| `psql` (restore) | any current version | it only runs SQL; use the one that came with `pg_restore` |

Client tools **newer than the server are fine**. That is what a laptop usually has against an older managed database.

A backup made by `pg_dump` 17 or 18 starts with settings a PostgreSQL 16 server has never heard of (`SET transaction_timeout`, new in 17). A plain `pg_restore` onto it stops at them. `tinyzoo restore` leaves those lines out (and prints which), and everything else is restored as dumped.

A backup whose SQL really needs a newer server than yours fails inside the transaction. That happens when it was taken from a newer server by a newer `pg_dump` and uses something your server lacks. Nothing is changed, and the message says to take the backup with a `pg_dump` of your server's version.

What is **refused up front, before anything is touched**, is a backup made by a newer `pg_dump` than the `pg_restore` you have (restoring a 17 backup with `pg_restore` 16). Install the newer client tools, or point the variables below at them. A missing `psql` is reported before anything is emptied too.

#### Other versions of the tools

`TINYZOO_PG_DUMP`, `TINYZOO_PG_RESTORE` and `TINYZOO_PSQL` point at a binary or a wrapper script to use another one. For example, a wrapper can run the tool inside a Docker container of the version you want.

The value is **one executable path**. It is started directly, not through a shell, so it cannot carry arguments. Put them in a wrapper script.

**What a wrapper receives.** tinyzoo calls each tool exactly like the real one. A wrapper only has to pass everything through: `"$@"`, stdin, stdout, stderr and the exit code.

| Tool | Arguments | stdin → stdout |
|---|---|---|
| `pg_dump` | `--format=custom` | nothing in → the dump out (tinyzoo writes it to a file) |
| `pg_restore` | `--version`; `--list`; `-f - --no-owner --no-acl --no-comments` | the dump in (all three) → the listing, or the dump as SQL |
| `psql` | `--version`; `-X -q -v ON_ERROR_STOP=1 -f -` | the SQL in → nothing out |

The connection is **never in the arguments**. It is in the environment, taken from `DATABASE_URL`: `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` and, from the connection string's TLS settings, `PGSSLMODE`, `PGSSLROOTCERT`, `PGSSLCERT`, `PGSSLKEY`. Every other `PG*` variable of your shell is removed before the tool starts, so a stray `PGDATABASE` cannot send a dump to another database.

Rules for a wrapper:

- `--version` has to print the real tool's line (`pg_restore (PostgreSQL) 17.2`), since tinyzoo compares versions with it.
- Anything else on stdout of the other calls corrupts the dump, so a wrapper prints nothing of its own. Messages go to stderr.
- A non-zero exit stops the command. Whatever the tool wrote to stderr is shown.

A wrapper that runs the tool in Docker has to hand the `PG*` variables to the container. `-e PGHOST -e PGPORT …`, without values, takes them from the environment. It also has to keep stdin open (`-i`).

Inside the container `localhost` is the container itself. When the database is on the machine Docker runs on, the wrapper must turn `localhost` into `host.docker.internal`. That works on Docker Desktop. On Linux, also add `--add-host=host.docker.internal:host-gateway`:

```sh
#!/bin/sh
# pg-17: runs a PostgreSQL 17 client tool in Docker. Link it as pg_dump, pg_restore and psql,
# and point TINYZOO_PG_DUMP, TINYZOO_PG_RESTORE and TINYZOO_PSQL at the three links.
tool=$(basename "$0")
case "$PGHOST" in localhost|127.0.0.1|::1) PGHOST=host.docker.internal ;; esac
export PGHOST
exec docker run --rm -i --add-host=host.docker.internal:host-gateway \
  -e PGHOST -e PGPORT -e PGUSER -e PGPASSWORD -e PGDATABASE -e PGSSLMODE \
  postgres:17-alpine "$tool" "$@"
```

#### Without client tools

Take the database part inside the database's own container, and keep it with a copy of the bucket:

```bash
docker exec <container> pg_dump --format=custom -U <user> <database> > database.dump
# restoring by hand: empty the schemas first, then restore all or nothing
docker exec <container> psql -U <user> -d <database> -c 'drop schema if exists drizzle cascade; drop schema if exists public cascade; create schema public;'
docker exec -i <container> pg_restore --single-transaction --exit-on-error --no-owner --no-acl -U <user> -d <database> < database.dump
```

By hand, the schemas are emptied first and the restore second. So a failure in between leaves the database empty. That is one more reason to use `tinyzoo restore`.

The container's own `pg_restore` is the server's version, so the settings problem does not arise there.

#### No automatic backup before migrations

The server applies migrations when it starts. It does not take a backup first. A dump from inside it would need `pg_dump` in the container image and a place to write the file. A failure there would also have to decide whether to start the new version anyway. That is too much to get right silently.

So take a backup before every deploy that changes the schema (`tinyzoo backup` takes seconds on a small site; in CI, before the deploy step).

### Restore drill

A backup nobody has restored is a hope. Do this once before launch and after big changes. Use a scratch database and bucket, never production:

1. Run `tinyzoo backup` against production. Note the size and the "missing media" line (it should be empty).
2. Create an empty Postgres database and a scratch folder or bucket. Point `DATABASE_URL` and `NUXT_CMS_STORAGE_*` at them.
3. Run `tinyzoo restore <file>`.
4. Start the site on them. Sign in (the accounts came with the dump), open an entry with pictures, check the page on the website, send a form.
5. Compare counts with production: entries per collection, media, accounts.
6. Write down how long it took and who did it. Then delete the scratch database and bucket.

## Privacy (GDPR)

tinyzoo keeps what a CMS must, for as long as you decide. It gives administrators the tools to answer a person's request.

This section is what a site owner needs for the privacy policy. It is not legal advice.

### What is stored

| What | Contents | How long |
|---|---|---|
| Accounts (Team) | email, name, role, admin language, a scrypt hash of the password, last sign-in; hashes of invitation, reset, email-change and undo links (7 days / 1 hour / 24 hours / 7 days); a requested new address until it is confirmed or cancelled, and after a change the old address with its undo link | until the person is removed or erased; a requested address and an undo link also go once their link has expired (the daily retention run) |
| Sign-in cookie | a sealed cookie holding the account id; nothing is kept on the server | until sign-out or expiry |
| Audit log | who did what and when (sign-ins, publishing, team changes, exports); a failed sign-in keeps the **email tried and the visitor's IP address**; a change of sign-in email keeps the **old and the new address** | `cms.retention.auditDays`, default **365 days**, then deleted daily (`0` keeps it) |
| Form messages | the fields of the form (name, email, text…) and their state; saved versions and search-index rows hold the same text | `defineForm(name, { retentionDays })`; without it, **until deleted**. Set it to what the policy promises |
| Notification emails | a message to the people in Forms settings, through the SMTP provider you configured | the provider's retention |
| Rate limits | visitors' IP addresses counted for minutes (memory or Redis) | the window (10–15 minutes) |
| Uploaded media | files, the uploader's account id | until deleted |
| Server log | request id, path without query, account id, error text without a failed query's values (a driver message can still name one, see [Logs](#logs)) | the platform's log retention |
| Cloudflare Turnstile, if on | Cloudflare sees the visitor's IP and a browser check | Cloudflare's terms |

Backups hold all of the above until they are rotated. Say how long backups live.

### Retention

Set how long form messages and audit entries are kept:

```ts
export const ContactForm = defineForm('contactForm', { /* … */ retentionDays: 180 })
```
```bash
NUXT_CMS_RETENTION_AUDIT_DAYS=365   # or retention: { auditDays: 365 } in nuxt.config's cms options
```

A scheduled task, `cms:retention`, runs daily at 03:17. It deletes:

- form messages older than their form's `retentionDays`, with their saved versions and search rows;
- audit entries older than `auditDays`.

It works in batches and on one instance at a time. It writes one audit entry, `retention.purge`, with the counts (never the content).

The admin says it under the form's list: "Messages are deleted automatically after 180 days."

To change the schedule, set `retention: { cron: '…' }` in nuxt.config's `cms` options. This is **at build time**: it is written into the build, so there is no runtime variable and a change needs a rebuild.

### One person's data

Go to **Settings → Privacy**. It is for administrators only (`/api/cms/_privacy/*`, rate limited, every action audited).

Enter an email address to see what is stored about it:

- form messages whose email fields match (any case);
- the account with that address;
- the audit entries made by or about it, including failed sign-ins with that address, and a change of sign-in email from or to it;
- a change of sign-in email waiting for that address, or an undo link back to it.

Where a change of address names a second address that is not this person's, the export shows `(another person’s address)` instead. That happens for the account that moved away from an address someone else has now, or an address of another account that was asked for.

Two actions are available:

- **Export as JSON.** Everything above in one file, without password hashes, to hand to the person (right of access).
- **Delete this person's data** (confirmation dialog). What it does:
  - The messages are deleted with their saved versions and search rows.
  - The account is **disabled and anonymised**. Name and email are removed (the address becomes `deleted-<id>@anonymised.invalid`). Password, invitation links, a pending change of email and undo links are removed. The person is signed out everywhere.
  - Audit entries about them lose email (old and new, after a change of address, but only the erased person's own addresses), name and IP address. They keep who-did-what.
  - A change of email waiting for the address, or an undo link back to it, of any account, is cancelled.
  - It never deletes your own account or the last active administrator.

Why anonymise rather than delete the account? The site's history ("saved by …", the audit trail, uploaded files) refers to the account by id. Deleting the row would leave that history pointing at nobody. Anonymising removes every personal detail and keeps the trail intact. The audit entry of the deletion itself records counts only, never the address.

Not covered, by design:

- text an editor wrote into entries and files they uploaded (site content, not data about a visitor);
- backups (rotate them).

## Pushbase, step by step

The repo's root `Dockerfile` builds the playground as a staging site. A client site is its own repo with the CMS as a dependency, and Pushbase's `nuxt` preset builds it as-is.

The image runs as the unprivileged `node` user. It keeps local media and file mail in `/app/data`. That is enough for a quick look but gone after every deploy, so give staging a bucket too.

1. Create the project. Its slug becomes `<slug>.pushbase.app`.
2. Provision Postgres and Redis and link both to the environment (`DATABASE_URL`, `REDIS_URL` are injected).
3. Set the environment above: `NUXT_APP_SECRET`, public URL, S3, SMTP and `NUXT_CMS_MIGRATIONS_ON_START=true`. Pushbase runs apps on a read-only filesystem with a writable `/tmp` (2 GiB per app), where uploads are staged ([Media](#media)). Leave `TMPDIR` unset.
4. Connect the GitHub repo (`--preset nuxt` for a site, `dockerfile` for this repo's staging build) or upload with `pushbase deploy`.
5. Open `/admin/setup`. A fresh database asks for the first administrator, and for the setup code. That is the line `Setup code: …` in the deploy log, or your `NUXT_CMS_AUTH_SETUP_TOKEN` if you set one ([First run](#first-run-the-setup-code)).
6. Add the custom domain and update `NUXT_CMS_PUBLIC_URL` to match.

Backups: Pushbase backs up its managed Postgres. The bucket needs its own policy. `tinyzoo backup` takes your own copy of both ([Backups and restore](#backups-and-restore)).

## Pushbase / private buckets

Pushbase Storage is S3-compatible and **private**. There is no public bucket and no bucket policy, so a file's own address in the bucket answers 403 to a browser.

tinyzoo serves the files itself, or signs a short-lived address for them. The setting is `cms.storage.s3.delivery` (`NUXT_CMS_STORAGE_S3_DELIVERY`).

### Set it up

1. Provision a Storage resource and link it to the environment. Rename the variables it injects to tinyzoo's with `--key NUXT_CMS_STORAGE_S3`.

   ```
   provision <project> media --type storage
   link <project> media --key NUXT_CMS_STORAGE_S3
   ```

   | Pushbase injects | tinyzoo reads |
   |---|---|
   | `S3_ENDPOINT` | `NUXT_CMS_STORAGE_S3_ENDPOINT` |
   | `S3_BUCKET` | `NUXT_CMS_STORAGE_S3_BUCKET` |
   | `S3_REGION` (`us-east-1`) | `NUXT_CMS_STORAGE_S3_REGION` |
   | `S3_ACCESS_KEY_ID` | `NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID` |
   | `S3_SECRET_ACCESS_KEY` | `NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY` |
   | `S3_FORCE_PATH_STYLE` (`true`) | `NUXT_CMS_STORAGE_S3_FORCE_PATH_STYLE`: accepted and ignored. The driver always uses path-style addresses (`endpoint/bucket/key`) |

2. Switch the driver on with `NUXT_CMS_STORAGE_DRIVER=s3`. Leave `NUXT_CMS_STORAGE_S3_PUBLIC_BASE_URL` unset. With no public address the delivery is `proxy`. Nothing else is needed. The first upload in the admin proves it.

### Which delivery

| `delivery` | The bucket | What browsers load | Choose it for |
|---|---|---|---|
| `proxy` (default without a public base URL) | private | `/api/cms/_media/raw/<key>`, streamed by the app | most sites: nothing to configure, the same origin, ranges for video, the safety headers (`nosniff`, a sandboxing CSP) |
| `redirect` | private | the same address answers `302` to a signed bucket address that lives 5 minutes | a lot of video or large files: the bytes no longer pass through the app |
| `public` (default with a public base URL) | public read, or a CDN in front | the bucket's or CDN's address, never touching the app | a public bucket with a CDN: the fastest, and what tinyzoo did before 0.2 |

### What `proxy` costs

Every file is read from the bucket by the app and handed on.

- It is streamed, never held in memory. A file larger than the pod's memory is fine.
- It honours `Range`, `If-None-Match` and a visitor who leaves.
- A busy site spends the app's bandwidth and CPU on it.
- Node lets the short-lived buffers of a fast transfer pile up a hundred megabytes or so before it collects them. On a small pod, a few large videos at once are what to watch.

Files are immutable and sent with `Cache-Control: public, max-age=31536000, immutable`. So a CDN or the browser's cache absorbs repeat visits.

Put a CDN in front of the site, or switch to `redirect` when video traffic is heavy.

### What `redirect` costs

The file comes from the storage's own address, not from yours. That is a different origin, which has three effects:

- The app's `nosniff` and sandbox headers do not reach it. The upload allowlist is what keeps hostile files out.
- A script on your site that reads the file with `fetch()` needs the bucket's CORS. An `<img>` or `<video>` does not.
- The signed address is visible in the browser for five minutes. The redirect itself is cached by the browser for four.

### Stored addresses

**The stored address never expires.** Under `proxy` and `redirect`, the database holds the app path `/api/cms/_media/raw/<key>`. The local driver uses the same path, so moving from local disk to S3 keeps old rows working.

So does everything built from it:

- the content API's media objects;
- rich-text images;
- the smaller copies of pictures (`/api/cms/_media/img/<id>/<width>.webp`);
- `tinyzoo export` / `import`. The archive holds keys, and an import writes the target's own address.

A signed address is made per request. It is never stored, returned by an API or put in cached HTML.

The address is relative to the app. A frontend on another origin prefixes the CMS's address, as it already does with the local driver.

### Switching delivery

Switching delivery changes the address of **new** files only.

- Rows made under `public` keep the bucket's address. They work for as long as the bucket is readable.
- Rows made under `proxy` or `redirect` keep the app path.
- `proxy` ⇄ `redirect` is a free switch.

Under `public` with a bucket that is in fact private, the first upload logs one line. It says that anonymous reads answer 403 and which setting to change.

`tinyzoo backup` / `restore`, `export` / `import` and the seed read and write the bucket with signed requests (or through the API). So they work on a private bucket in every mode.
