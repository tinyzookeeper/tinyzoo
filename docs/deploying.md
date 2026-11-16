# Deploying

How a site built on the CMS runs in production, with Pushbase as the worked
example. The same applies to any container host: only the build output
(`.output/`) ships, the database and Redis are services next to it, and media go
to object storage.

## What runs

One Node process per replica: `node .output/server/index.mjs`, listening on
`PORT` (Pushbase: 3000, `HOST=0.0.0.0`). It serves the website, `/admin`, the
admin API and the public content API.

| Needs | Why | On Pushbase |
|---|---|---|
| Postgres 16+ | all content, accounts, audit log | managed Postgres, linked → `DATABASE_URL` |
| Redis (or Valkey) | rate limits shared by replicas, change fan-out (caches, realtime) | managed Redis, linked → `REDIS_URL` |
| S3-compatible bucket | media (containers have no lasting disk) | external — see [Media](#media) |
| SMTP | invitations, password resets | external (any provider) |

Without Redis everything still works on **one** replica; with several, each would
count rate limits on its own and see other replicas' content changes only after
its caches expire (redirects: 30 s, sitemap: 1 min).

## Environment

Generate secrets (`openssl rand -base64 32`) and set them on the platform, never in
the repo. Everything below is read at runtime — no rebuild to change it.

| Variable | Required | |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection (`NUXT_CMS_DATABASE_URL` overrides) |
| `NUXT_SESSION_PASSWORD` | yes | seals the sign-in cookie, ≥ 32 characters. Changing it signs everyone out |
| `NUXT_CMS_PUBLIC_URL` | yes | the admin's public address, e.g. `https://www.example.cz` — links in emails |
| `NUXT_CMS_MIGRATIONS_ON_START` | recommended | `true`: apply bundled migrations at start (below) |
| `REDIS_URL` | with > 1 replica | `NUXT_CMS_REDIS_URL` overrides |
| `NUXT_CMS_REDIS_PREFIX` | optional | namespace for keys and channels; default `cms:<database name>`, so environments sharing one Redis stay apart |
| `NUXT_CMS_STORAGE_DRIVER` | yes | `s3` (or `r2`) in production; `local` is for development |
| `NUXT_CMS_STORAGE_S3_ENDPOINT`, `_REGION`, `_BUCKET`, `_ACCESS_KEY_ID`, `_SECRET_ACCESS_KEY` | with s3 | bucket credentials |
| `NUXT_CMS_STORAGE_S3_PUBLIC_BASE_URL` | with s3 | where browsers load media from (bucket's public URL or a CDN in front) |
| `NUXT_CMS_MAIL_TRANSPORT` | yes | `smtp` in production (`log` prints emails to the console) |
| `NUXT_CMS_MAIL_FROM`, `NUXT_CMS_MAIL_SMTP_HOST`, `_PORT`, `_SECURE`, `_USER`, `_PASS` | with smtp | |
| `NUXT_CMS_WEBHOOKS_URLS`, `NUXT_CMS_WEBHOOKS_SECRET` | optional | publish webhooks (below) |
| `NUXT_CMS_CONTENT_TOKEN` | optional | require a token on the public content API |
| `NUXT_CMS_AUTH_SETUP_TOKEN` | optional | a code of your choosing that first-run setup needs (`/admin/setup?token=…`). Without it the server makes a one-time code and prints it in the log — see [First run](#first-run-the-setup-code) |
| `NUXT_CMS_RETENTION_AUDIT_DAYS` | optional | delete audit-log entries older than this many days (default 365, `0` = keep). See [Privacy](#privacy-gdpr) |
| `NUXT_CMS_AUTH_TRUSTED_PROXIES` | optional | proxy hops in front of the app (default 1 — Pushbase's ingress). Too few and rate limits count the proxy instead of visitors; too many (e.g. 1 with no proxy at all) and visitors can fake their address in `X-Forwarded-For` to dodge limits. Set `0` when the app is reached directly |

`playground/.env.example` lists them with local-development values.

## First run: the setup code

A new deploy has no administrator, and `/admin/setup` is reachable by anyone who
knows the address. So in production first-run setup always asks for a **setup
code**:

- With `NUXT_CMS_AUTH_SETUP_TOKEN` set, that is the code (open
  `/admin/setup?token=<value>` to have it filled in).
- Without it, the server **makes a one-time code when it starts** and prints one
  line in its log:

  ```
  [cms] No administrator yet. Setup code: K7QM-2XVD-R9TE-HC4Y — open https://www.example.cz/admin/setup
  ```

  Open the project's log (Pushbase: the deploy/runtime log), find the line, type the
  code into the setup page. Capitals, dashes and spaces do not matter.

The code is 16 characters from an alphabet without look-alikes (80 bits). With several
replicas it is shared: the replica that stores it first prints it, the others say it
was issued; only its hash is kept in the database (`cms_state`, key `setup_code`). It
is deleted in the same transaction that creates the first account. A restart while
there is still no account prints the code again if it is older than five minutes (a
new one replaces it, the old one stops working), and leaves a fresh one alone. Wrong
codes are answered `403`, counted by the rate limit (10 attempts per quarter hour per
visitor) and written to the audit log (`auth.setup_failed`).

Development (`nuxt dev`, `NODE_ENV=development` or `test`) needs no code. Anything else
counts as production, so an unset `NODE_ENV` does not leave a deploy open.

### Seeding a deployed site

`tinyzoo seed` (see the README, *Seeding*) works against a deployed site from your own
machine: it needs only the site's address and an administrator, never the database.
Use the setup code to create the first account from the seed itself:

```sh
SEED_URL=https://www.example.cz SEED_EMAIL=you@example.cz SEED_PASSWORD='…' \
SEED_SETUP_CODE=K7QM-2XVD-R9TE-HC4Y   pnpm seed            # a new site: creates the account, then seeds
SEED_URL=https://www.example.cz SEED_EMAIL=you@example.cz SEED_PASSWORD='…'   pnpm seed --dry-run   # an existing one: what would change
```

Use `https://` (the command warns when the password would travel unencrypted), and send
only what belongs on a live site: `s.upsert` brings pages up to the seed, `s.create` leaves
what editors have written alone.

## Migrations

The platform has no release step, so the app migrates itself: with
`NUXT_CMS_MIGRATIONS_ON_START=true` the server applies the bundled migrations
(the host app's `server/db/migrations`, generated by `pnpm tinyzoo generate`) when it
starts. API requests wait for it; a Postgres advisory lock makes concurrent
replicas take turns, so the first one migrates and the rest find nothing to do.
The bookkeeping is drizzle's own (`drizzle.__drizzle_migrations`), so running
`drizzle-kit migrate` by hand stays compatible. The same start also runs tinyzoo's
**upgrade steps** (the data work of an upgrade that a migration cannot express,
recorded in `cms_upgrades`) in the same transaction; `tinyzoo up` does exactly the
same from the command line (`DATABASE_URL` from the environment or the site's
`.env`), and `tinyzoo status` tells what is still pending (exit code 1 when
something is — handy as a deploy check). A migration that was never applied but is
older than one that was (two branches each generated one) stops the start with an
error naming the file, instead of being skipped. See [upgrading.md](upgrading.md).

If the database does not accept connections yet (freshly provisioned,
restarting), the instance retries for about a minute and a half. A migration that
fails is logged, the API answers 503 instead of running on a half-migrated
schema, `/api/health/live` fails, and in production the process exits so the
platform restarts it. Pushbase's readiness check is the open port, so watch the
deploy log after a schema change. Destructive changes
(dropping a column the running version still reads) need two deploys: stop
using it, then drop it ([the two-step rule](upgrading.md#the-two-step-rule)).
To restore after a failed upgrade, restore the database backup taken before it.

## Health

- `GET /api/health/live` — the process is up (liveness); fails when start-up
  migrations gave up.
- `GET /api/health/ready` — migrations done and the database answers (readiness).

## Media

Production media belong in object storage in the EU (GDPR): Hetzner Object
Storage (Falkenstein/Nuremberg/Helsinki) or Cloudflare R2 with the EU
jurisdiction. Create a bucket with public read for objects, a key limited to that
bucket, and set the `NUXT_CMS_STORAGE_S3_*` variables. Uploaded files are
immutable (new upload = new key), so a CDN in front can cache them forever.

The bucket is not covered by the platform's database backups: turn on its
versioning or a lifecycle copy if losing an upload matters (see [Backups and
restore](#backups-and-restore)).

## Publish webhooks

Saving content of a public collection that visitors can see — before or after
the save, judged by the collection's `content.published` rule (the same one the
content API applies) — is POSTed to each URL in `NUXT_CMS_WEBHOOKS_URLS`, so the
website can purge its cache: entries created, changed, published, unpublished or
deleted, translations, globals. Drafts stay quiet.

```json
{ "delivery": "…", "type": "entry.published", "entity": "post", "id": "…", "locale": null,
  "public": true, "paths": ["/blog/hello", "/en/blog/hello"], "version": "…", "at": "2026-11-13T10:00:00.000Z" }
```

`paths` are the addresses from `content.path` that visitors could reach before or
after the change, in every language (a renamed slug gives both; a translation
change only that language's). `delivery` is unique per change and the same on
every retry — deduplicate on it; it is inside the signed body. Each request
carries `X-CMS-Event`, `X-CMS-Delivery` and `X-CMS-Signature: t=<unix>,v1=<hex>`, an
HMAC-SHA256 of `` `${t}.${rawBody}` `` with `NUXT_CMS_WEBHOOKS_SECRET`. In production
nothing is sent without a secret. Up to three attempts (the second 1 s after the
first fails, the third 5 s later); failures are logged (and reported through the `cms:error` hook, see [Error reporting](#error-reporting)) with the address shortened to its origin and a hash of the path, because a webhook's secret often sits in the path.

Not reported (yet): media edits (alt text, deletion), and changes that show on
a page only through a relation (renaming an author shown on their posts) — purge
by time for those.

Verifying in a Nuxt site:

```ts
// server/api/cms-hook.post.ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const raw = (await readRawBody(event)) ?? ''
  const [, t, sig] = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(getHeader(event, 'x-cms-signature') ?? '') ?? []
  const expected = createHmac('sha256', process.env.CMS_WEBHOOK_SECRET!).update(`${t}.${raw}`).digest('hex')
  if (!sig || Math.abs(Date.now() / 1000 - Number(t)) > 300
    || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw createError({ statusCode: 401 })
  }
  const change = JSON.parse(raw)
  // e.g. purge the route cache for change.paths
  return { ok: true }
})
```

In-process code can listen too, with no network involved (it runs after the
response, on the instance that saved):

```ts
// server/plugins/on-change.ts in the host app
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('cms:change', (change) => { /* … */ })
})
```

## Logs

Server errors (5xx) are written to stderr as one JSON line each, with the request
id the browser got in `X-Request-Id` (an incoming `X-Request-Id` from the proxy is
kept) and without query parameters (no emails or content in logs). Expected
errors (validation, permissions) are not logged; sign-ins, invitations and
content changes are in the audit log instead.

### Error reporting

Besides the log line, every server error runs a Nitro runtime hook, **`cms:error`**,
so a site can send it to an error tracker (Sentry, GlitchTip, a Slack message…). The
package depends on no vendor: subscribe in a server plugin of the site.

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

The hook gets a `CmsErrorReport` (typed through `NitroRuntimeHooks`; exported from
`tinyzoo`):

| Field | |
|---|---|
| `source` | `request` (a 5xx answer), `task` (a scheduled task threw: `cms:scheduled`, `cms:retention`, `cms:search-reindex`) or `webhook` (a publish webhook gave up after its retries) |
| `error`, `message` | `error` is an `Error` that is safe to send: its message is `message` (a failed database query is reduced to what the driver said, without the query's bound values), its stack frames are kept, and its causes are scrubbed the same way. `message` is the same text |
| `rawError` | the error exactly as thrown. **May contain personal data** (a failed query's message carries emails, form text, password hashes) — use it inside the process, for instance to read a status code, and never send it to a third party |
| `status`, `requestId`, `method`, `path`, `userId` | for requests: the status, the `X-Request-Id` the browser got, the path **without its query string**, the signed-in person's id; `null` otherwise |
| `task` / `webhook` | the task name / `{ url, type, delivery }` — `url` is the webhook's origin and a short hash of its path (`https://hooks.slack.com/…#3f9a1c20`), never the path or query, since Slack, Discord and similar services keep their secret there; the hash tells two hooks on one host apart |

It runs after the response, never waits for your code and never breaks anything: a
hook that throws is logged (`cms:error hook failed`) and ignored. Expected errors
(4xx) and the 503s of a migration in progress are not reported.

Why `error` is a copy: the message of a failed database query (`Failed query: …
params: …`) carries the bound values, which can be emails or text from a form, and
the web framework copies that message into the error it throws. `report.error`,
`report.message` and the log line leave them out. The driver's own message is kept
(`Query failed: relation "post" does not exist (42P01)`); in rare cases such a
message names a value too (`invalid input syntax for type uuid: "…"`), so treat
your tracker as a place where a few such details can land, and keep `rawError` out.

## Realtime

The admin keeps one WebSocket per tab (`/api/cms/_live`, same port) for presence
("Jana is editing") and live updates. Redis carries them between replicas. If a
proxy blocks WebSockets the admin works as before, without them. Saves are
protected either way: an editor saving over a version someone else saved in the
meantime gets a choice instead of silently overwriting it.

## Security

- The admin and its API answer with `X-Frame-Options: DENY`,
  `frame-ancestors 'none'`, `Referrer-Policy: same-origin` and `nosniff`; the API
  with `Cache-Control: no-store`.
- Uploaded files are served with `Content-Security-Policy: sandbox` and
  `nosniff`.
- The session cookie is `Secure` in production and `SameSite=Lax`; state-changing
  API calls must be JSON from the same origin.
- A script CSP for the website itself is the host app's call (Nuxt needs nonces
  for its inline hydration script); `nuxt-security` does it well.
- HTTPS is terminated by the platform; send HSTS from there or from the app.

## Backups and restore

What holds what, and who is responsible:

| Data | Lives in | Backed up by |
|---|---|---|
| content, accounts, form messages, audit log, saved versions, the search index | Postgres | Pushbase backs up its managed Postgres. `tinyzoo backup` takes your own copy as well |
| uploaded media | the S3 bucket | **you**: turn on the bucket's versioning or replication; `tinyzoo backup` also copies the files |
| secrets and settings | the platform's environment | **you**: keep them in a password manager |

### `tinyzoo backup` and `tinyzoo restore`

Run them from the site's folder (or anywhere with the production settings in the
environment): they read `NUXT_CMS_DATABASE_URL` / `DATABASE_URL` and
`NUXT_CMS_STORAGE_*` the way the server does — environment first, then `.env`, then
the `cms:` options of `nuxt.config`.

```bash
tinyzoo backup                              # tinyzoo-backup-<database>-<time>.tar here
tinyzoo backup backups/before-0.3.tar
tinyzoo restore backups/before-0.3.tar      # asks you to type the database's name
tinyzoo restore backups/before-0.3.tar --yes     # no question (scripts)
tinyzoo restore backups/before-0.3.tar --force   # the database already has tables: replace everything in it
```

**The archive** is one plain tar (list it with `tar -tf`): `manifest.json` (tinyzoo
version, time, the media list), `database.dump` (`pg_dump --format=custom`) and
`media/<key>` for every file `cms_media` refers to — read from the local upload folder,
or downloaded from the bucket with the same signed requests the app uses (the
resized copies under `_w/` are not included; the site makes them again). Files the
database refers to but storage no longer has are listed as missing, not silently
dropped. The archive holds password hashes, form messages and every upload: it is
created readable by its owner only (before the first byte is written); keep it as
private as the database.

**Restore** replaces the whole database with the backup's. In one transaction it
drops and recreates the `public` and `drizzle` schemas (the tables, the migration
journal and the `pg_trgm` extension go with them and come back from the dump), then runs
`pg_restore --single-transaction --exit-on-error --no-owner`, then writes the media into
the configured folder or bucket. Dropping everything, and not just what the dump
contains, is what makes an **older backup over a database that was upgraded since**
come out exactly as the backup was (no renamed tables beside the old ones, no newer
journal): the restored journal lets the site start on it, and a newer version applies
its migrations itself. The restore is all or nothing: if `pg_restore` fails, the
database is empty — never half old, half new — and the message says so; fix the cause
and run it again. Stop the site first (a connection that holds a lock stops the
drop with a clear message).

It refuses a database that is not empty — any table in `public`, or applied migrations
in `drizzle.__drizzle_migrations` (so an external-sign-in site with no accounts is
protected too) — unless you add `--force`; a site that has run its migrations once has
tables, so restoring over it needs `--force`. It always asks (type the database's name)
unless you add `--yes`. Before it changes anything it checks the whole archive: that
`pg_restore` can read the dump, that no media path leaves the media folder, that
nothing in the archive is a link (the restore unpacks with its own reader: plain files
only, so a symbolic link to `~/.ssh/id_rsa` can never be copied into public media), and
that it does not unpack to more than 20 GiB (`TINYZOO_MAX_ARCHIVE_BYTES` changes the cap).

**TLS to the database.** `pg_dump` / `pg_restore` connect with the TLS settings of the
connection string, mapped to what the app (node-postgres) does: `sslmode=require`,
`prefer`, `verify-ca`, `verify-full`, `ssl=true` and any of `sslrootcert` /
`sslcert` / `sslkey` mean an encrypted connection with the certificate **and** the host
name verified (libpq `verify-full` — libpq's own `require` would accept any
certificate); `sslmode=no-verify` is encrypted without checking (libpq `require`);
`sslmode=disable` is no TLS. The certificate files are passed on, and `PGSSLMODE`,
`PGSSLROOTCERT`, `PGSSLCERT`, `PGSSLKEY` of the shell are kept when the URL says
nothing. With `uselibpqcompat=true` in the URL, libpq's own meanings are used.

**Tools.** Both commands need `pg_dump` and `pg_restore` of the server's major
version or newer (`brew install libpq`, `apt install postgresql-client`). Point
`TINYZOO_PG_DUMP` / `TINYZOO_PG_RESTORE` at a binary or a wrapper script to use
another one. Without client tools, take the database part inside the database's own
container and keep it with a copy of the bucket:

```bash
docker exec <container> pg_dump --format=custom -U <user> <database> > database.dump
# restoring by hand: empty the schemas first, then restore all or nothing
docker exec <container> psql -U <user> -d <database> -c 'drop schema if exists drizzle cascade; drop schema if exists public cascade; create schema public;'
docker exec -i <container> pg_restore --single-transaction --exit-on-error --no-owner --no-acl -U <user> -d <database> < database.dump
```

**No automatic backup before migrations.** The server applies migrations when it
starts, but a dump from inside it would need `pg_dump` in the container image and a
place to write the file, and a failure there would have to decide whether to start the
new version anyway — too much to get right silently. Take a backup before every deploy
that changes the schema (`tinyzoo backup` takes seconds on a small site; in CI,
before the deploy step).

### Restore drill

A backup nobody has restored is a hope. Do this once before launch and after big
changes, into a scratch database and bucket — never over production:

1. `tinyzoo backup` against production; note the size and the "missing media" line (it should be empty).
2. Create an empty Postgres database and a scratch folder or bucket; point `DATABASE_URL` and `NUXT_CMS_STORAGE_*` at them.
3. `tinyzoo restore <file>`.
4. Start the site on them. Sign in (the accounts came with the dump), open an entry with pictures, check the page on the website, send a form.
5. Compare counts with production: entries per collection, media, accounts.
6. Write down how long it took and who did it, then delete the scratch database and bucket.

## Privacy (GDPR)

tinyzoo keeps what a CMS must, for as long as you decide, and gives administrators
the tools to answer a person's request. What follows is what a site owner needs for the
privacy policy; it is not legal advice.

### What is stored

| What | Contents | How long |
|---|---|---|
| Accounts (Team) | email, name, role, admin language, a scrypt hash of the password, last sign-in; hashes of invitation and reset links (7 days / 1 hour) | until the person is removed or erased |
| Sign-in cookie | a sealed cookie holding the account id; nothing is kept on the server | until sign-out or expiry |
| Audit log | who did what and when (sign-ins, publishing, team changes, exports); a failed sign-in keeps the **email tried and the visitor's IP address** | `cms.retention.auditDays`, default **365 days**, then deleted daily (`0` keeps it) |
| Form messages | the fields of the form (name, email, text…) and their state; saved versions and search-index rows hold the same text | `defineForm(name, { retentionDays })`; without it, **until deleted** — set it to what the policy promises |
| Notification emails | a message to the people in Forms settings, through the SMTP provider you configured | the provider's retention |
| Rate limits | visitors' IP addresses counted for minutes (memory or Redis) | the window (10–15 minutes) |
| Uploaded media | files, the uploader's account id | until deleted |
| Server log | request id, path without query, account id, error text — never emails or form content | the platform's log retention |
| Cloudflare Turnstile, if on | Cloudflare sees the visitor's IP and a browser check | Cloudflare's terms |

Backups hold all of the above until they are rotated: say how long backups live.

### Retention

```ts
export const ContactForm = defineForm('contactForm', { /* … */ retentionDays: 180 })
```
```bash
NUXT_CMS_RETENTION_AUDIT_DAYS=365   # or retention: { auditDays: 365 } in nuxt.config's cms options
```

A scheduled task (`cms:retention`, daily at 03:17; `CMS_RETENTION_CRON` at build time
changes it) deletes form messages older than their form's `retentionDays`, with their
saved versions and search rows, and audit entries older than `auditDays`, in batches
and on one instance at a time. It writes one audit entry, `retention.purge`, with the
counts (never the content). The admin says it under the form's list: "Messages are
deleted automatically after 180 days."

### One person's data

**Settings → Privacy** (administrators only; `/api/cms/_privacy/*`, rate limited,
every action audited): enter an email address and see what is stored about it — form
messages whose email fields match (any case), the account with that address, and the
audit entries made by or about it (including failed sign-ins with that address).

- **Export as JSON** — everything above in one file, without password hashes, to hand to the person (right of access).
- **Delete this person's data** (confirmation dialog) — the messages are deleted with their saved versions and search rows; the account is **disabled and anonymised**: name and email removed (the address becomes `deleted-<id>@anonymised.invalid`), password and invitation links removed, signed out everywhere; audit entries about them lose email, name and IP address but keep who-did-what. Not your own account, never the last active administrator.

Why anonymise rather than delete the account: the site's history ("saved by …",
the audit trail, uploaded files) refers to the account by id. Deleting the row would
leave that history pointing at nobody; anonymising removes every personal detail and
keeps the trail intact. The audit entry of the deletion itself records counts only,
never the address.

Not covered, by design: text an editor wrote into entries and files they uploaded
(site content, not data about a visitor) and backups (rotate them).

## Pushbase, step by step

The repo's root `Dockerfile` builds the playground as a staging site; a client
site is its own repo with the CMS as a dependency, and Pushbase's `nuxt` preset
builds it as-is. The image runs as the unprivileged `node` user and keeps
local media and file mail in `/app/data`, which is enough for a quick look but
gone after every deploy — give staging a bucket too.

1. Create the project (its slug becomes `<slug>.pushbase.app`).
2. Provision Postgres and Redis and link both to the environment
   (`DATABASE_URL`, `REDIS_URL` are injected).
3. Set the environment above (session password, public URL, S3, SMTP,
   `NUXT_CMS_MIGRATIONS_ON_START=true`).
4. Connect the GitHub repo (`--preset nuxt` for a site, `dockerfile` for this
   repo's staging build) or upload with `pushbase deploy`.
5. Open `/admin/setup`: a fresh database asks for the first administrator, and for
   the setup code — the line `Setup code: …` in the deploy log, or your
   `NUXT_CMS_AUTH_SETUP_TOKEN` if you set one ([First run](#first-run-the-setup-code)).
6. Add the custom domain and update `NUXT_CMS_PUBLIC_URL` to match.

Backups: Pushbase backs up its managed Postgres; the bucket needs its own policy,
and `tinyzoo backup` takes your own copy of both ([Backups and
restore](#backups-and-restore)).
