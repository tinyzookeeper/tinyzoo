# Multi-tenant tinyzoo: the design

**Status (2026-11-24):** the design was accepted and everything in its order of work is built on this branch and runs locally: the mode itself, the shared hosting driver, the account sign-in with the switcher, and the operations (the directory in Postgres, domains, plans, moving a site, PgBouncer, two instances). It is not released and not deployed. Section 2.14 says what is built, what the build showed, where it differs from the design, and what the platform in front of the sites still has to provide; 2.15 is the account's protocol. The rest of the document is the design as it was written, corrected where the build proved it wrong. The measurements were taken on this machine against Postgres 16.11; where a number is an estimate, it says so.

Part 1 is the ten-minute read. Part 2 holds the details behind each paragraph of part 1.

**Words.** A *site* is one website with its own content, people and files. An *app* is one running build (one content model, since the model is code). *Single* mode is today: one app, one site. *Multi* mode is new: one app, many sites.

---

# Part 1: the ten-minute read

## What is proposed

One switch with two values (as built: the environment variable `NUXT_CMS_TENANCY_MODE`). `single` is the default and behaves as today. In `multi` the same build serves many sites: each request is given its site from its host name, and everything a site owns (database, files, secrets, caches, sockets) is reached only through that site.

The two uses need different parts of it:

1. **The SaaS** runs one app per template in multi mode. A new site is a new database, a folder for files and a row in a directory; no build and no new process.
2. **A group of custom sites of one client** is mostly *not* a hosting question. The honest answer for 6dance and Studio Grand is below: keep two apps, and give them a shared sign-in and a switcher. That same sign-in and switcher serve a SaaS customer with several sites.

A client with one custom site keeps their own app and database, in single mode, unchanged.

## How separation is built in

Five mechanisms. Each makes a mistake fail with an error instead of showing another site's data.

1. **No site, no database.** In multi mode there is no global database handle. `useCms()` keeps its name and its 176 call sites, but it answers from the *current site*, which is carried by Node's `AsyncLocalStorage`. A request with an unknown host, or background work that did not say which site, has no current site, and `useCms()` throws. There is no default site in multi mode.
2. **A database user per site.** Each site's pool signs in as that site's own Postgres user, which may connect to that one database only. Verified locally: the user of site A is refused on site B's database, on the template database and on `postgres` (`User does not have CONNECT privilege`). A query sent to the wrong pool still cannot read another site.
3. **One helper for per-site memory.** Every cache is declared with `cmsSiteScoped(...)`, which stores the value on the current site. A unit test reads the server code and fails on any new module-level state that is not declared this way (or as `cmsProcessWide(...)` with a reason).
4. **Files and sessions belong to a site.** The storage driver is made per site and rooted at that site's place; with object storage each site has its own access key limited to its prefix. A session cookie is bound to the host (`__Host-` prefix, no `Domain`), and the sealed session names its site: the one function that turns a cookie into an account refuses a session of another site.
5. **A two-site test suite** that runs every route and every background path with two sites and asserts that nothing of one appears on the other (the list is in 2.12).

What this does **not** protect against: the app process itself holds the credentials of every site it serves, so a compromised process reaches all of them. That is true of any multi-tenant design short of one process per site.

## A request, start to end

`Host: novak-foto.example` arrives. One wrapper around every request, before any middleware, looks the host up in the **site directory** and gets the site: its id, public address, database address and user, storage place, secrets, mail settings and state. The rest of the request runs inside that site. An unknown host gets a plain 404 and never reaches a route. An alias (`www.`) is redirected to the site's main address.

The admin stays at `/admin` on the site's own address, as today. Custom domains are more rows in the directory; the platform in front must send every such name to the app and get its certificate.

Requests the app makes to itself (the MCP tools, server rendering) inherit the site of the request that made them and cannot name another.

## A database per site, in practice

Measured with 10 000 databases in one Postgres 16 (details and numbers in 2.3 and 2.7):

- **Making one** takes 30 to 40 ms: a role, then `CREATE DATABASE … TEMPLATE` from a prepared database that already holds the template's tables and `pg_trgm`, then handing the tables to the site's role. It took 30 ms with 10 000 databases already there.
- **Disk:** 8.5 MB per site before any content (7.5 MB is Postgres's own catalog, copied into every database). 1 000 sites are 8 GB, 10 000 are 83 GB.
- **Connections:** each site has a small pool (at most 3) that closes its connections after 10 s of quiet, so only sites that are being used hold any. An idle pool costs about 1 KB in the app. A connection costs about 2.5 MB in Postgres. The app has a hard cap on open connections over all sites; when it is reached, the longest-idle pool is closed. PgBouncer in front is the next step when several app instances share one Postgres; it is not needed to begin.
- **Migrations on a deploy:** each site is migrated the first time it is used after the deploy, and a background sweep goes through all of them so nobody waits. Checking a site that needs nothing takes 8 ms; 1 000 sites are checked in 2 s, 10 000 in 17 s. A site whose migration fails answers 503 by itself, is listed for the operator and is retried. The other sites carry on, and the process does not exit.
- **Backup, restore and moving a site** are the strong side of this choice: `pg_dump` of one database (0.3 s for a fresh site) and the existing `tinyzoo backup` and `restore` work per site, and restoring one site touches no other.

The cost of the choice is at the high end. With 10 000 databases one Postgres held 4 million files; left idle with default settings it used 7 to 8 % of a processor core on autovacuum alone, and a checkpoint took minutes because it syncs that many files (2.7). Both can be tuned, but the plan is to cap one Postgres at a few thousand sites and add another; the directory already says which server a site's database is on.

## Scale

| | 100 sites | 1 000 sites | 10 000 sites |
|---|---|---|---|
| Disk in Postgres, no content | 0.85 GB | 8.1 GB (measured) | 83 GB (measured) |
| Making a site's database | 25 ms (measured) | 35 ms (measured) | 30 ms (measured) |
| Checking every site for migrations | 0.2 s | 2 s (measured) | 17 s (measured on a sample of 2 000) |
| Idle pools in the app | 0.1 MB | 1.1 MB (measured) | 11 MB |
| Connections held | sites in use × up to 3, capped | the same | the same |
| App memory | one app, 309 to 399 MB (measured) | one app, about 300 MB plus roughly half a megabyte per site in use (from 300 sites measured: 400 to 470 MB) | several apps of the same template, each with a share of the sites (estimate) |
| Postgres instances | 1 | 1 | 3 to 5 (estimate) |

Today's alternative, one app per site, costs 170 to 360 MB of memory per site: 1 000 sites would be 170 to 360 GB of RAM.

The floor is one app per template that has sites. Twenty-one templates are twenty-one apps (about 6 GB), so multi mode pays for itself from the second site of a template.

## Deploys and crashes

A deploy replaces the app of one template, so **all sites of that template get the new build at the same moment**, including changes to the content model. A site cannot stay behind on an old version. With two instances the deploy rolls without downtime, as long as migrations stay compatible with the previous build (the rule that already holds for rolling deploys).

A crash takes down every site in that instance until it restarts. One site can also slow the others: server rendering and picture processing share one process. Two instances per template, per-site rate limits and a fair picture queue limit this; they do not remove it. This is the price of multi mode and the reason a client who pays for a custom site keeps an app of their own.

## The site group: 6dance and Studio Grand

Both sites were read (details in 2.9). The finding:

- Their content models barely overlap: 13 collections between them, only `redirect` has the same shape; four block types share a name and all four differ.
- Their frontends are two unrelated codebases (hand-written CSS against Tailwind utilities, different fonts, one Nuxt UI theme each) with colliding routes, component names, global CSS and `public/` files.
- One app for both would mean a merged model, a rewritten migration history, about two to three weeks of work in the two repositories, a full visual check of both, and from then on one deploy and one failure for both. Each site's editors would see the other's collections.
- It would not give them shared content (a database per site either way) and it would not remove the need for a shared sign-in.

**So the group is an identity question, not a hosting question.** The recommendation:

- **Sites stay separate apps** (or separate sites of one multi-mode app when they do share a model, as a SaaS customer's sites do). Separate apps can still live on one server and one Postgres, each with its own database and user; what they cannot share is a process, because their code differs.
- **A person's identity lives in one place outside the sites:** the tinyzoo account, held by the cloud app, which the SaaS needs anyway. It holds the e-mail, the password and the list of sites the person belongs to.
- **Roles stay per site, in the site's own database**, as today: each site has its own `cms_users` row for the person with that site's role. A person can be an administrator on one site and an editor on the other. A site stays complete by itself, which keeps moving it simple.
- **Sign-in:** the site sends the person to the account (OAuth authorization code with PKCE), gets back who they are, finds its own row for them and opens its own session. No cookie is shared between sites, so it works across unrelated domains (6dance.cz, studiogrand.cz) and across hosting kinds.
- **The switcher:** the site's name at the top of the admin becomes a menu with the person's other sites (name, logo, their role). Choosing one opens that site's admin; the sign-in round trip is silent because the account already knows them.

A site with no account service configured keeps today's sign-in.

## Moving a site between shared hosting and its own server

A site is four things: a database, a folder of files, its settings and secrets, and its host names. `tinyzoo backup` already packs the first two into one archive. Moving out: mark the site read-only, back it up, restore into the new app's database and storage, give the new app the site's settings as environment, point the host names at it, mark the directory row as moved. Moving in is the same in reverse. Both need the destination to run the same content model at the same or a newer migration. For a small site the read-only window is under a minute.

## What changes in `cloud/`

A third hosting driver, **`shared`**, beside `local` and `pushbase`:

- *database* step: create the role and an empty database; the app migrates it on first use (2.3).
- *start* step: write the site into the directory and wait until the template's app answers for that host. Nothing is built or started.
- *content* and *account* steps: unchanged; they talk to the site over HTTP.
- *remove*: take the site out of the directory, drop its database and role, delete its files.

The app of each template is deployed by a release, not by a sign-up. The `pushbase` driver (one project per site, written and never run) stops being the way SaaS sites are made. What survives of it is the part that deploys one site as its own project: that becomes the destination of "move this site to its own server". Recommendation: leave it parked and unfinished until that is built.

## Order of work

Each step can be merged and released alone, and single-mode sites behave the same after each:

1. **The site seam** (no behaviour change): `useCmsSite()`, `cmsSiteScoped()`, the settings helper; `useCms()` and `useCmsStorage()` answer through the one site built from the environment. The module-state test starts with today's list and may only shrink.
2. **Caches** move to `cmsSiteScoped` (about 40 places, listed in 2.5).
3. **Work outside a request** names its site: start-up, scheduled tasks, timers, sockets, queues; changes carry their site; migration state per site.
4. **Settings per site** instead of the environment: public address, secrets, mail, storage, webhooks, the admin's brand.
5. **Multi mode** behind `cms.tenancy.mode: 'multi'`: the directory, the request wrapper, pool limits, the session binding, the two-site suite in CI.
6. **`cloud/`:** the `shared` driver.
7. **Account sign-in and the switcher** (independent of 1 to 6; it can come first for 6dance and Studio Grand).
8. **Operations:** PgBouncer, custom domains, quotas, moving in and out.

All eight are built on the branch `feat/multi-tenant` and run locally (2.14). What is left is outside this repository: the platform in front of the sites, and a deployment.

## Decisions (2026-11-23)

1. **6dance and Studio Grand:** two apps with a shared sign-in and switcher. They can live on one server and one Postgres; they do not share a process.
2. **Where the identity lives:** the cloud app.
3. **Template updates:** every site of a template moves to a new build together. The rule that goes with it: a change to a template adds things or fixes them; a redesign ships as a new look. A customer's content is data in their own database and a deploy does not touch it.
4. **Files:** a key per site, limited to that site's files. Pushbase Storage already confines every key this way (2.4); it needs a way to issue one such key per site for an app that serves many.
5. **The first build** went ahead, then the rest: 2.14.

---

# Part 2: the details

## 2.1 How a request finds its site

**The wrapper.** A Nitro plugin replaces `nitroApp.h3App.handler` with a function that resolves the site and runs the original handler inside it. Nitro does the same for its own `asyncContext` option (`nitropack/dist/runtime/internal/app.mjs:139-145`), so the hook point is a supported one. It runs before every middleware, route rule and route, for requests from the network and for in-process requests alike.

**The host.** Lower-cased, port and trailing dot removed. `X-Forwarded-Host` is read only when the app is told it runs behind a proxy (`cms.auth.trustedProxies`, the setting that already governs the visitor's IP address). Today two places trust it without that check (`server/utils/cmsSession.ts:151`, `server/utils/cmsOAuth.ts:26`); in multi mode a forged forwarded host must not be able to choose a site, so both go through the same function.

**The directory.** An interface with three drivers:

| Driver | For | Source |
|---|---|---|
| `env` | single mode | one site built from today's environment variables; every host is that site |
| `file` | tests, a small fixed group | a JSON file read at start |
| `postgres` | the SaaS | a table in the cloud's database, read with a role that may only read it |

A directory entry:

```ts
interface Site {
  id: string                       // opaque, never the slug: database and role names are visible to every role in the cluster
  hosts: string[]                  // the first is the public address; the others redirect to it
  state: 'active' | 'paused' | 'read-only' | 'moved'
  database: { host: string, port: number, name: string, user: string, password: string }
  storage: { driver: 'local', dir: string } | { driver: 's3', bucket: string, prefix: string, accessKeyId: string, secretAccessKey: string, … }
  secrets: { app: string, setupCode: string, statusToken: string, contentToken?: string, webhookSecret?: string }
  mail: { fromName: string, replyTo?: string, smtp?: {…} }
  webhooks?: string[]
  limits?: { … }                   // plan: storage, upload size
}
```

Secrets and passwords are encrypted at rest (AES-256-GCM, as `cloud/server/utils/secret.ts` does today) with a key the app holds.

Lookups are cached in the process for 30 to 60 s, with a short, bounded negative cache so random host names cannot flood the directory's database. The cloud tells the apps about a change over the shared store (Redis) so a new site is known at once. The directory cache is the one piece of state that is global by nature.

**Answers without a site.**

| Case | Answer |
|---|---|
| Unknown host | 404, plain text, no route runs |
| Alias host | 308 to the same path on the main address |
| `paused` | 503 with a plain page |
| `read-only` | reads work; writes get 503 |
| `moved` | 308 to the new address, or proxied by the platform |

**Routes that need no site** are an explicit short list, registered with their own helper: `/api/health/live` and a process-level `/api/health/ready` (the platform's probes arrive by IP), and an operator status route behind an operator token that lists sites and their migration state. They run with no current site, so they cannot touch a database even by mistake.

**The admin** is `/admin` on the site's own address. Nothing changes for an editor.

**Custom domains.** The cloud records the domain, checks that its DNS points at the platform, and adds it to the site's hosts. The platform must (a) send a wildcard of the shared domain and every custom domain to the template's app and (b) issue certificates for custom domains on demand, asking the cloud whether a host is a known site before it does. This is a requirement on Pushbase, not on tinyzoo. Not built today (`cloud/README.md`, "Not built").

**In-process requests.** `useNitroApp().localFetch` and server-side `$fetch` send no `Host` (`server/utils/cmsMcp.ts:43,469`, `server/utils/cmsBrandSource.ts:88`, `app/composables/useCmsAdminTheme.ts:19`, the templates' `useCmsSite.ts`). The wrapper sees that a site is already current and keeps it. If such a request does carry a host that is another site, it is refused. This also closes the hole at `server/utils/cmsContent.ts:43-46`, where an in-process request skips the content token.

## 2.2 The current site

`server/utils/cmsSite.ts` (new), built on `AsyncLocalStorage`:

| Function | What it does |
|---|---|
| `useCmsSite()` | the current site, or throws `No site for this work` |
| `runInCmsSite(site, fn)` | runs `fn` with `site` current; used by the wrapper, sockets and tasks |
| `forEachCmsSite(fn, { concurrency })` | runs `fn` in every active site, a bounded number at a time; a failure in one site is logged with its id and does not stop the others |
| `cmsSiteScoped(init)` | a value per site, made on first use, dropped when the site is unloaded |
| `bindToCmsSite(fn)` | remembers the current site for a callback that runs later (queues, listeners) |
| `cmsProcessWide(value, reason)` | marks state that is shared on purpose (the test in 2.11 accepts it) |

What the async context carries by itself: everything awaited inside the request, promises left running after the response (`server/utils/cmsChanges.ts:243-251`, `server/api/cms/_auth/forgot.post.ts:27-37`) and timers started inside it.

What it does **not** carry, and where the site is therefore passed explicitly:

- Work chained from another site's work. The picture queue starts the next job from the previous job's `.finally` (`server/utils/cmsImageQueue.ts:44-55`), so without `bindToCmsSite` a job would run in the previous site. The media-sizes loop has the same shape (`server/utils/cmsImageSizes.ts:264-275`).
- Anything started at boot: intervals, Redis subscriber callbacks, Hocuspocus hooks, Nitro tasks. They start with no site and must use `forEachCmsSite` or `runInCmsSite`.
- Shared in-flight promises (`analytics/server/context.ts:76,114`, `consent/server/state.ts:37`): a second site would await the first site's load. `cmsSiteScoped` holds them per site.

In single mode `useCmsSite()` returns the one site without looking at the async context, so background code that names no site keeps working exactly as today. That is the only place with a default, and it is a different directory driver, not a fallback inside multi mode.

**A site's memory and the work under way (as built).** Each site loaded in the process is an *instance*: its row and what is kept for it. Work runs inside an instance and keeps it until it has finished; `event.waitUntil` work counts too. When the site's row changes, the instance is retired: new requests get a new instance made from the new row, the requests under way finish with what they started with (the old settings, the old pool), and only then is the old instance released, or after 30 s if something never finishes. So a change of the directory never cuts a request off, and a request that began under the old row cannot make the site's new memory from it. Work that outlives its instance goes on in the site as it is loaded now. When a site leaves the directory its work under way is told (`cmsSiteHasLeft()`), its storage refuses further writes, and late work fails instead of making a new pool or folder.

**Unloading idle sites (built).** A site nobody has used for 15 minutes gives its memory back: its caches, its pool, its live hub and its shared-editing engine with that engine's Redis connections (`NUXT_CMS_TENANCY_IDLE_MINUTES`, `0` for never). Background work (the start-up sweep, scheduled tasks) does not count as use, so the tasks do not keep every site loaded. The next request loads the site again.

## 2.3 A database per site

**Making one** (the cloud's `shared` driver, with an administrator connection the apps never hold). This is what the build does:

```sql
CREATE ROLE s_7f3a… LOGIN PASSWORD '…' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE s_7f3a… OWNER s_7f3a…;
REVOKE CONNECT ON DATABASE s_7f3a… FROM PUBLIC;
```

The database starts empty. The site's app migrates it the first time the site is used, as the site's own role: about 115 ms for the Photographer schema. `pg_trgm` is a trusted extension, so the owner of a database creates it without being a superuser.

Once per cluster: `REVOKE CONNECT ON DATABASE postgres, template1 FROM PUBLIC`, and the same for every other database on the server. Without it a site's role can connect to those databases (it finds no site's tables there, but it should have no business there).

Verified locally (Postgres 16.11):

- The site's role is refused on every other site's database, cannot create databases or roles, cannot install `dblink` or `postgres_fdw` (the two ways to reach another database from inside SQL), and cannot read or write server files with `COPY`.
- The site's role **can** see the names of all databases and roles (`pg_database`, `pg_roles` are cluster-wide), and that other sessions exist, but not their queries. Hence opaque ids, never slugs, in those names.

**A faster way, with a trap (not used by the build).** A new database can be copied from a prepared template database that already holds the tables (and the demo content): `CREATE DATABASE … TEMPLATE tpl_photographer` took 16 to 25 ms. The copy's tables then belong to the template's owner and must be handed to the site's role. The first version of this document did that with `REASSIGN OWNED BY tpl_owner TO <site role>` inside the copy. **That is wrong:** checked on Postgres 16, `REASSIGN OWNED` also hands over databases the old role owns, so the first site's role became the owner of the template database itself. If the copy is ever used, the template database must be owned by a role that owns nothing inside it, or the objects are handed over one by one (`ALTER TABLE … OWNER TO`), as the test helper does. A template database must also never hold accounts, tokens or invitations: every copy would carry them.

**Connecting.** `useCms()` returns the current site's drizzle instance, built on first use:

- `pg.Pool` with `max: 3`, `idleTimeoutMillis: 10 000`, and an `error` listener. Today's pool has none (`server/db/driver.ts:5-8`), so an idle-connection error on one site's pool would be an unhandled error for the whole process.
- A cap on the connections of all sites of the process together (`NUXT_CMS_TENANCY_MAX_CONNECTIONS`, default 30). At the cap, the pool of the site that has been quiet longest is closed to make room: one with no connection in use, nobody waiting for one and no request under way. When there is none, the query waits, and gives up with 503 after 10 s. Seen from Postgres the count can be over the cap for a moment (2.14).
- `instances × cap` is set below Postgres's `max_connections`, so the apps cannot exhaust it.
- The build showed why the cap is needed and not optional: without it, the first use of 100 new sites opened more connections than the local Postgres allows (100) within the pools' 10 s of idle time, and took 187 s with failed connections. With the cap it took 13 s and nothing failed (2.14).

Measured: 1 000 pools with no open connection add 1.1 MB to the app. An open connection adds about 60 KB in the app and 1.3 MB (fresh) to 2.5 MB (after a few queries) of private memory in Postgres; plan for 5 MB with tinyzoo's wider queries (estimate).

**A pooler in front.** PgBouncer in transaction mode helps when several instances and several templates share one Postgres: the apps' connections to it are cheap. It cannot share a connection between two sites (a connection belongs to one database and one user), so the saving is in connections duplicated across instances, not in the peak. **It does not cap the real connections in one place,** as the first version of this document said: PgBouncer keeps a pool per database and has limits per database and per user, none across databases. Measured (2.14): the app's cap then counts its connections to PgBouncer, and behind it one app held more real connections in a burst (50 to 86 for 50 sites) than without it (30). The pool per site at PgBouncer has to be small (1) and its idle time short. tinyzoo is compatible with transaction mode: locks are `pg_advisory_xact_lock`, settings are set per transaction (`server/utils/cmsSearch.ts:224-229`), there is no `LISTEN` and no named prepared statement in `server/`. Per-site users are handled with `auth_query`, so there is no user list to maintain. Adding it later is a change of the database host in the directory.

**Scheduled work must not wake every database.** Two tasks run every minute today (`module.ts:326-333`). Run naively over 10 000 sites they would open 20 000 connections a minute. The first build ran them the naive way (in every active site, five at a time, under the connection cap). They now work as designed (2.14):

- `cms:scheduled` (publishing at a set time): after each run the app remembers when that site's next entry is due and does not ask again before then; a change in the site that touches scheduling clears the memory. A slow rotation visits every site every 15 minutes as a safety net for another instance's restart.
- `cms:media-sizes`: runs for sites that had an upload in this instance, plus the same slow rotation for leftovers.
- `cms:retention` (daily): spread over the night, a few sites at a time.
- The advisory locks that pick one instance (`72011004`, `72011040`) are per database, so they keep working unchanged.

**Migrations.**

- State per site (`pending`, `running`, `done`, `failed`) replaces the single promise in `server/utils/cmsMigrate.ts:24-25`. The migration files are read and hashed once per process, not per site.
- A request for a site awaits that site's migration. A sweep after start goes through all sites, 20 at a time, so the wait is rare.
- The order on a deploy: the template database first; if that fails, the new build is not ready and the deploy stops with no site touched. Then the sweep.
- A failed site: nothing is left half-done (the whole run is one transaction), the site answers 503, the operator route lists it with the error, and it is retried with a growing pause. `process.exit(1)` (`cmsMigrate.ts:54-57`) stays for single mode only.
- Old and new instances overlap during a rolling deploy, so a migration must not break the previous build: add first, remove in a later release. A build that meets a database with migrations it does not know refuses that site, as today (`MigrationOrderError`).

Measured: a check that finds nothing to do is 8 round trips, 3 ms to connect and 4.5 ms of queries. Twenty at a time, 1 000 sites take 2 s and 10 000 take 17 s. A fresh Photographer database takes about 66 round trips.

**Extensions.** `pg_trgm` is already in the template database. For a site made the other way, the existing upgrade step (`src/upgrades.ts:121-133`) creates it as the owner.

**Backup and restore of one site.** `pg_dump --format=custom` of one database took 0.3 s and 45 KB for a fresh site. `tinyzoo backup` and `restore` (`cli/backup.ts`) take a database address and storage settings, so they work per site once they can be given a site instead of the environment. A whole-cluster base backup with WAL covers disaster recovery; to bring one site back to a point in time, the cluster backup is restored to a scratch server and that one database is dumped from it.

**Moving one site to another Postgres:** dump, restore, change the directory row. The read-only state covers the gap.

## 2.4 Files, sessions, secrets, e-mail

**Files.** `useCmsStorage()` returns the current site's driver.

- Local disk: `<data>/<site id>/uploads`. The driver already refuses a key that leaves its folder (`server/utils/cmsStorage.ts:136-142`).
- Object storage: one bucket per app, keys under `sites/<site id>/`, and the site's own access key limited to that prefix by the storage's policy. With `public` delivery the prefix is part of the address.
- The raw media route looks only in the current site's storage, and "is this key ours" asks the current site's database (`server/utils/cmsMediaKeys.ts`, cache per site).
- Uploads are staged in a shared temp folder under random names (`cmsStorage.ts:351,487`); that stays.

On one local disk the operating system does not separate the sites (one process, one user); the separation is the rooted driver. With object storage and scoped keys it is the credentials as well. **Pushbase Storage** (read in its source, not tried): one platform bucket behind a gateway. Every storage link has its own access key and a virtual bucket; the gateway checks the signature, refuses any other bucket and rewrites every key under the link's own prefix (`pushbase/apps/control-plane/server/utils/storage/gateway.ts`). So a key confined to one place exists. Today a key belongs to one service linked to one environment and is injected into that environment's deploy. A multi-mode app needs one key per site, handed to the cloud app instead: a small addition to Pushbase (decision 4). Whether its API can already return a link's keys was not checked.

**Sessions.** Facts today: the cookie has no `Domain`, so browsers send it to its own host only; it is sealed with a key derived from the process's app secret (nuxt-auth-utils 0.6.2); the payload is `{ user, cms: { uid, sv, iat } }` with no site; every `/api/*` and `/admin` request re-reads the account from the database (`server/middleware/cms-session.ts`). The danger is a cookie copied by hand from site A to site B when both databases hold the same user id, which is exactly what copying a template database produces.

In multi mode:

- The session payload gains `cms.site` and `cms.proof`, a keyed hash (HMAC-SHA256) of the account and the sign-in time made with the **site's own secret** from the directory. `activeAccountOf()` (`server/utils/cmsSession.ts`), the single function behind the middleware and both sockets, refuses a session whose site is not the current one or whose proof does not match. Built and tested: site A's cookie is refused on site B although the same account id exists there. Changing a site's secret signs everybody out of that site alone.
- The cookie itself is still sealed with the process's secret: nuxt-auth-utils 0.6.2 takes its key from the process and drops a per-call password (`dist/runtime/server/lib/session.js`). A sealing key per site would need a change there or tinyzoo sealing its own session. Not built.
- The cookie should be named with the `__Host-` prefix (`NUXT_SESSION_NAME`). Browsers refuse such a cookie with a `Domain`, so a script on one site cannot plant a session cookie for a sibling under the same parent domain. The app warns at start when multi mode runs without it, and the shared driver sets it with `NUXT_HOSTING_SHARED_SESSION_COOKIE`. Tried in Chromium on `http://<slug>.localhost` (sign-in, the switcher and signing out work with it); Firefox and WebKit were not tried (2.14).
- The shared domain of SaaS sites should be put on the Public Suffix List, which separates the sites for every other cookie as well.
- Personal access tokens, OAuth grants, invitations and reset links are rows in the site's database and need nothing more.

**Secrets and settings.** About 60 places read `useRuntimeConfig().cms` and a few read `useAppConfig().cms.admin`. A new helper, `cmsSettings()`, returns the process's settings with the current site's laid over them. Per site: public address, app secret, setup code, status token, content token, webhook addresses and secret, mail sender, storage, the forms' notification address, the demo account (off), the admin's name and logo. Per process: auth mode, proxies, limits, Redis address, cron lines. The full list with files is in 2.5.

`CMS_ALLOW_REQUEST_ORIGIN` (`server/utils/cmsAuth.ts:134`), which lets a request's host into e-mail links, is refused at start in multi mode. Links always use the site's main address from the directory.

**E-mail.** One transport per app by default: the service's sender domain, `From: "<site name>" <no-reply@…>`, `Reply-To` the site's contact address. A site may bring its own SMTP; transports are then kept per site with a small limit (today there is one, rebuilt whenever the settings differ: `server/mail/mailer.ts:6-22`).

## 2.5 Every place that assumes one site

Paths are under `packages/cms/`. "Per site" means it moves to `cmsSiteScoped` or a per-site resource; "site passed" means work outside a request that must be given its site; "setting" means it reads the site's settings instead of the environment. Schema-derived caches (the registry, block compilers, role rules, generated types) stay process-wide and are not listed.

**Database and start-up**

| Where | What | Needs |
|---|---|---|
| `server/utils/cmsDb.ts:5,12-23` | one memoized connection from the environment | per site |
| `server/db/driver.ts:5-8` | pool with defaults, no `error` listener, never ended | per site, capped, closed when idle |
| `server/utils/cmsMigrate.ts:24-25,37-61` | one migration promise and state; `process.exit(1)` on failure | per site, no exit in multi mode |
| `server/middleware/cms-0-migrate-gate.ts:9`, `server/api/health/*.ts`, `server/api/cms/_about.get.ts:14`, `server/utils/cmsStatus.ts:127,146` | read that one state | per site; health without a site is process-level |
| `server/plugins/cms-migrate.ts:4` | migrates the one database at start | site passed (sweep) |
| `server/plugins/cms-0-config-check.ts:29-70` | refuses to start without `DATABASE_URL`; checks one secret and one address | checks the directory instead |
| `server/plugins/cms-search.ts:4-12`, `server/utils/cmsSearch.ts:192-200` | builds the search index of the one database | site passed |
| `server/plugins/cms-setup-code.ts:3-15`, `server/utils/cmsSetupCode.ts:47-74` | makes and prints one setup code | per site, from the directory |
| `server/utils/cmsCollate.ts:7-14` | collations read once from the first database | per database server |

**Store, limits, changes, webhooks**

| Where | What | Needs |
|---|---|---|
| `server/utils/cmsStore.ts:61-72`, `server/store/redis.ts` | one key and channel prefix, from the one database's name | site in every key and message |
| `server/utils/cmsRateLimit.ts:9` and its callers (`login:`, `forgot:`, `setup:`, `search:`, `status:`, `upload:`, `analytics:`, `consent:`, `form:` …) | keys without a site: tries on site A lock the same address out of site B | site in the key |
| `server/utils/cmsChanges.ts:171-288`, `server/plugins/cms-changes.ts:15-53` | a change has no site; one listener set feeds the live hub | site on the change, on the channel message and on the three Nitro hooks |
| `server/utils/cmsWebhooks.ts:30-73` | addresses and secret from the environment: every site's changes would go to one endpoint | setting |

**Caches**

| Where | What | Needs |
|---|---|---|
| `server/utils/cmsRedirects.ts:8` | one redirect map: A's redirects would apply to B's visitors | per site |
| `server/utils/cmsSitemap.ts:13,16-24`, `server/plugins/cms-sitemap.ts:20-43`, `server/middleware/cms-sitemap-address.ts:8-22` | one sitemap memo, one address, one "is configured" flag | per site; the address from the directory |
| `server/utils/cmsMediaKeys.ts:21` | "is this file ours" by storage key | per site |
| `server/utils/cmsPreviewDraft.ts:18` | unsaved preview values by user and entry | per site |
| `server/utils/cmsAdminTheme.ts:25,36,48-82` | the admin's name read from content, kept 3 s; brand from the build | per site; setting |
| `server/utils/cmsBrandSource.ts:44-48,88` | logo bytes by address; in-process fetch | per site |
| `server/api/openapi.json.get.ts:18` | the document holds the site's address | per site |
| `server/utils/cmsStatus.ts:48-63,69-71,91-192` | error counters; one status token; collects from the one database | per site; setting |
| `server/api/cms/[entity]/_export.get.ts:47-50` | default language and time zone from the build | setting, if sites may differ |

**Files, pictures, mail**

| Where | What | Needs |
|---|---|---|
| `server/utils/cmsStorage.ts:508-558` | one driver: one folder or one bucket | per site |
| `server/utils/cmsImageSizes.ts:66,98-99,173-175,264-275` | "the table exists" remembered once; one worker run per process | per site; site passed |
| `server/utils/cmsImageQueue.ts:19-55` | one picture at a time for the whole process | stays shared; fair between sites; `bindToCmsSite` |
| `server/mail/mailer.ts:6-29`, `server/utils/cmsMail.ts:11-19` | one transport, one sender, one folder | setting; per site when a site brings its own |

**Sign-in, tokens, addresses**

| Where | What | Needs |
|---|---|---|
| `server/utils/cmsSession.ts:25-28,104-111`, `server/utils/cmsAuth.ts:119-121` | one cookie name, no site in the session | 2.4 |
| `server/utils/cmsSession.ts:140-160` | socket origin check trusts `X-Forwarded-Host` and one address | the site's hosts |
| `server/utils/cmsAuth.ts:131-138,177-179` | links from one address; one setup token | setting |
| `server/utils/cmsDemo.ts:10-35` | the demo account from the environment | off in multi mode |
| `server/utils/cmsAccessTokens.ts:179-209`, `server/utils/cmsMcp.ts:43,236,469` | in-process calls without a host; one address | inherit the site; setting |
| `server/utils/cmsOAuth.ts:24-65`, `server/api/mcp/oauth/authorize.get.ts:32` | issuer from one address or a forwarded host | the site's address |
| `server/utils/cmsContent.ts:43-46,57,96,114` | one content token; in-process requests skip it | setting; 2.1 |
| `server/utils/cmsEmails.ts:169-195` | image addresses from one address | setting |
| `server/plugins/cms-errors.ts:12-44` | log lines name no site | add the site id |

**Live editing** is in 2.6.

**Bundled plugins**

| Where | What | Needs |
|---|---|---|
| `analytics/server/ingest.ts:41-58,80-109` | one buffer of page views and one timer; a flush writes through one connection | a buffer per site; flush per site |
| `analytics/server/context.ts:34-52,67-94,100-137` | "collecting on", the day's salt, and the address-to-entry map, each one value | per site, including the in-flight promises |
| `consent/server/state.ts:28-70` | the banner's settings and version | per site |
| `analytics/server/startup.ts:13-22`, `consent/server/startup.ts:4-8`, `consent/server/choice.post.ts:68` | hooks without a site clear everything or act on one database | site on the hook |
| `analytics/server/collect.post.ts:38-90`, `consent/server/choice.post.ts:17-36`, `forms/server/form.post.ts:29-100` | origin checks and links from one address | the site's hosts |
| `forms/server/forms.ts:38,63-75,116-128` | notification address and Turnstile keys from the environment | setting |

**The Nuxt app**

| Where | What | Needs |
|---|---|---|
| `app/composables/useCmsSeo.ts:41-45` | canonical and `hreflang` from one address | the site's address |
| `app/composables/useCmsAdminTheme.ts:19`, templates' `useCmsSite.ts` | server-side `$fetch` without a host | nothing: in-process requests inherit the site (2.1) |
| `app/app.config.ts:28-49` | the admin's accent, logo, default language and time zone are build values | served per site by `/api/cms/_theme` |
| `module.ts:326-333` | three cron lines, once per process | 2.3 |
| `module.ts:478-480` | Turnstile key and demo flag in the public config | setting |
| templates' `server/routes/robots.txt.get.ts` | the sitemap line from one address | the site's address |

`@nuxtjs/sitemap` already keys its own cache by host, and `nuxt-site-config` is asked per request; tinyzoo only has to hand them the site's address from the request instead of the one from the environment.

**Not a problem.** Drizzle tables are not bound to a connection; `server/` has no prepared statements; raw SQL names tables without a schema, which is right for a database per site; advisory lock numbers are per database.

## 2.6 Work outside a request

| Work | Today | In multi mode |
|---|---|---|
| Start-up: migrations, search index, setup code | once, for the one database | per site: on first use and by the sweep |
| `cms:scheduled`, `cms:media-sizes` (every minute), `cms:retention` (daily) | once per process | per site with work due (2.3) |
| Publishing after the response: store message, hooks, webhooks | `useCms()` when it runs | keeps the request's site by itself |
| Webhooks | one endpoint for the process | the site's endpoints and secret, read when the change is made |
| Picture queue and media sizes | one chain, one run | jobs bound to their site; turns shared fairly between sites |
| Analytics flush (every 3 s) | one buffer | per site; only sites with pending views |
| Live hub (`/api/cms/_live`) | one map of sockets, topics `list:<entity>`; one 20 s timer checks all peers in one query | a hub per site, made when its first socket opens; the timer walks the hubs, each inside its site |
| Shared editing (`/api/cms/_collab/socket`) | one Hocuspocus, documents named `<entity>/<uuid>`; hooks call `useCms()`; one 30 s heartbeat and an hourly purge | one Hocuspocus per site, made when its first document opens and closed when the site is unloaded (15 minutes without use); its hooks run inside its site; Redis prefix includes the site |
| Redis messages between instances (`changes`, `live`) | no site in the message | the site is part of the channel |
| Logo re-read in the background | by address | per site |

**Sockets.** The site is decided at the upgrade request, which has the host and the cookie (`server/utils/cmsSession.ts:120-133`), and is stored on the peer. Every later hook runs inside it. A per-site Hocuspocus instead of site-prefixed document names means that two sites with the same entry ids (copies of one template database) can never meet in one document, by construction.

Without these changes the live hub would be a real leak today: editors of site B would see site A's editors as present on `list:posts` and receive A's change notices.

## 2.7 Measurements

Machine: this Mac, Postgres 16.11 in Docker (a container of its own, `max_connections = 400`, `shared_buffers = 128MB`), Node 24. The site database is the Photographer template: 23 tables, 39 indexes, `pg_trgm`.

| What | Result |
|---|---|
| Empty Postgres database | 7.5 MB |
| Photographer database, no content | 8.5 MB, 409 files |
| `CREATE DATABASE … TEMPLATE` (default strategy) | 16 to 25 ms |
| The same with `STRATEGY file_copy` | 74 ms |
| `REASSIGN OWNED` in the new database | 7 to 15 ms |
| Empty database plus the migration, as the site's role | 115 ms |
| Role + database + revoke, sites 1 to 1 000 | 25 to 44 ms each |
| The same, sites 1 001 to 10 000, made in one run | 34 to 90 ms each |
| 100 more with 10 000 already there and nothing else running | 30 ms each |
| 1 000 databases on disk | 8.1 GB, 410 000 files, plus 1 GB of WAL |
| 10 000 databases on disk | 83 GB, 4.09 million files |
| Migration check, nothing to do, new connection | 3.2 ms connect + 4.4 ms for 8 round trips |
| That check over 1 000 sites, 20 at a time | 2.0 s (491 sites a second) |
| That check over 2 000 of the 10 000, 20 at a time | 3.3 s (601 sites a second), so 17 s for all |
| First check of a new site (creates two bookkeeping tables) | 427 sites a second |
| `pg_dump --format=custom` of one fresh site | 0.3 s, 45 KB |
| App: 1 000 pools with no connection | +1.1 MB |
| App: one open connection | about 60 KB |
| Postgres: one connection, fresh | 1.3 MB |
| Postgres: one connection after 4 queries | 2.3 to 2.6 MB private |
| Postgres idle with 10 000 databases, `autovacuum_naptime` 1 min (the default) | 7 to 8 % of one core, all the time |
| The same with `autovacuum_naptime` 30 min | under 1 % |
| A checkpoint with 10 000 databases | 37 s to 6 min while the databases were being made, 3 min afterwards |

What the 10 000 run showed:

- **Making a database does not get slower.** The 34 to 90 ms during the bulk run was the run competing with its own checkpoints and autovacuum; a site made afterwards took 30 ms.
- **Autovacuum has to be told.** The launcher visits every database once per `autovacuum_naptime`. With 10 000 databases and the default of one minute it never rests. A longer interval fixes the idle load; the right value depends on how much the sites write.
- **Checkpoints sync every file that changed,** and here that was 100 000 to 2 million files per checkpoint. The times above are on this machine's Docker disk, where a sync is slow; on a server they will be shorter, but the number of files is the same. This, with backups that must walk 4 million files, is why one Postgres should stop at a few thousand sites.
- **A limit of the test, not of Postgres:** opening 10 000 new connections from the host in one burst failed with dropped connections while the Postgres log showed no error. This is taken to be Docker's port forwarding on this machine, which is not proven; the sweep was measured on a sample of 2 000 instead.

**Estimates, not measured:**

- **Memory of one multi-mode app** is no longer an estimate: the first build measured it (2.14). A Photographer app starts at about 300 MB and a site that has been used adds roughly half a megabyte; 300 sites ran in 400 to 470 MB. For comparison, a single-mode site runs at 167 to 174 MB on Pushbase (Keeper, 6dance and Studio Grand) and about 360 MB as a local hosted site (`cloud/README.md`).
- **Connections at 1 000 sites.** A small site makes a few hundred database-backed requests a day. A thousand such sites are a handful of requests per second in total, so a few dozen sites hold a connection at any moment: tens of connections, not thousands. The cap makes this a limit instead of a hope.
- **Processor.** Server rendering is one thread. One app renders tens to low hundreds of pages per second depending on the template; this, not memory, is what sets how many busy sites one instance can carry. Picture processing runs one at a time by design (`server/utils/cmsImageQueue.ts`).

## 2.8 Deploys, crashes, instances

**A deploy of a template**

1. The new build is released; the template database is migrated. A failure stops here.
2. Instances are replaced one at a time. Each new one starts the migration sweep.
3. Every site of the template now runs the new build. Per-site version pinning does not exist inside one app.

Consequences to accept or plan around:

- A change of a template's content model reaches every customer's data on the same day. Migrations must be safe for content nobody on the team has seen.
- A bad build breaks every site of the template at once. Guard: readiness of the new instance includes a real page of a canary site, and the previous build stays ready to roll back to (which is why migrations must stay compatible one release back).
- A tinyzoo upgrade is per template, not per site.

**A crash** stops every site in that instance. With one instance per template that is a few seconds of downtime for all of them; with two, the other instance carries on. What can take a process down or starve it: an endless loop in rendering, memory from many large uploads at once, a burst of traffic to one site. Limits already exist per request (`server/middleware/cms-limits.ts`); multi mode adds per-site rate limits (the keys already carry the site after 2.5) and fairness in the picture queue.

**How many instances.** One per template is enough to start: today every site already runs on exactly one. Two per template when the service has paying customers, which needs Redis for what instances share (rate limits, live editing between instances; the code path exists as `cms.redis.url`). More than two, or a second app of the same template with its own share of sites, when one template passes a few thousand sites or its traffic needs it. A template with no sites needs no app.

## 2.9 The site group

**What was read:** `6dance-web` and `studiogrand-web`, both on tinyzoo 1.11.0, Nuxt 4.6.4, Nuxt UI 4.12.

| | 6dance | Studio Grand |
|---|---|---|
| Collections | page, coach, venue, group, course, camp, news, album, four forms, redirect | page, coach, lesson, slot, event, service, redirect |
| Globals | siteSettings, navigation | siteSettings, navigation, schedule |
| Blocks | 20 | 13 |
| `page` | not localized | localized |
| Plugins | forms, consent, analytics | consent, analytics |
| Styling | hand-written CSS, scoped styles in 40 files | Tailwind utilities, no scoped styles |
| Migrations | 5 files, 42 tables | 5 files, 35 tables |
| Accounts | 1 | 1 |

- Same shape in both: `redirect` and the plugins' globals. Same name, different fields: `page`, `coach`, `siteSettings`, `navigation`, and the blocks `hero`, `pageHead`, `text`, `cards`. `hero` means two different things and would need a rename inside stored content and revisions.
- In one build these collide: `/`, the catch-all page, `/kontakt`, `robots.txt`, seven component names, three auto-imports, global CSS classes (`.btn`, `.section`, `.wrap` …) and tokens, the single `app.config.ts`, four `public/` files. Two Nuxt layers do not solve it by themselves: a layer's pages and layouts replace, they do not coexist.
- Both sites read their own address from one environment value in about 13 places.
- They link to each other but share no content as data. One coach appears in both seeds.
- Both are before launch on `pushbase.app` addresses with seeded content, so a merge would never be cheaper than now. It is still two to three weeks for a result that is worse to run.

**When one app for several custom sites is right:** when the sites are built on one model from the start, such as branches of one business with the same site. That is a private template: the client's own app in multi mode with a `file` or `postgres` directory. The machinery is the same as the SaaS's.

**Accounts.**

| Question | Answer |
|---|---|
| Where does a person live? | In the account service (the cloud app): e-mail, password, later a second factor |
| Where does membership live? | In each site's `cms_users`, as today, with two new columns: the account's issuer and subject |
| Where do roles live? | In each site's `cms_users.role`. Different per site. The account service does not decide rights |
| Who may invite? | A site's administrators, as today. The invitation is accepted by signing in with the account |
| What if the account service is down? | Existing sessions keep working (they are the site's own). New sign-ins wait. A site may keep password sign-in for its administrators as a way in |
| What about a site with no account service? | Today's sign-in, unchanged |

**Sign-in.** Authorization code with PKCE between the site and the account service. tinyzoo already contains an OAuth server for MCP (`server/utils/cmsOAuth.ts`); the site here is the client side. The account service keeps a list of the sites that may ask (address and client id), which is also the list the switcher shows. The site matches the returned subject to its own row; the first time, it links a row that was invited by the same verified e-mail. It then opens its normal session. No cookie crosses sites.

**The switcher.** The site's name in the admin's top-left becomes a menu: the person's other sites with name, logo and their role there, and "All my sites" leading to the account. The list comes from the account service, asked by the site's server for the signed-in subject and kept for a few minutes. Choosing a site opens `https://<that site>/admin`; it is not signed in yet, sends the browser to the account, which knows the person and sends it straight back. Two redirects, no form.

**People across a group.** The account service gets a page per group: people down, sites across, the role in each cell. It writes through each site's admin API with the service account the cloud already keeps on every site (`NUXT_SERVICE_EMAIL`).

**A smaller first step,** if 6dance and Studio Grand should have the switcher before the cloud app is deployed: the two sites trust each other directly. Each lists the other's address and a shared secret; "switch" hands over a signed, single-use token valid for 30 seconds, naming the person's e-mail, and the other site opens a session if it has an active account with that e-mail. Sign-in itself stays per site. It is less work and it is a dead end: every pair of sites needs the secret, and a broken-into site can sign in as anyone on its sister. Recommended only as a stopgap.

## 2.10 Moving a site

**Out of shared hosting, to its own server**

1. The new app exists: the template's source as its own project (or the client's custom project that started from it), in single mode.
2. The site's state becomes `read-only`.
3. `tinyzoo backup` for the site: the database dump and every file in one archive.
4. `tinyzoo restore` into the new app's database and storage.
5. The new app gets the site's settings as environment variables: status token, content token, mail, public address. As built, the archive carries them in `site.json`. Open sessions do not survive: in shared hosting the cookie is sealed with the secret of the template's process, which all its sites share and which is not handed to one owner; people sign in once more with the passwords they had (2.14).
6. The host names are pointed at the new app. The directory row becomes `moved`.
7. After a grace period the shared database, role and files are removed.

**Into shared hosting** is the same with the ends swapped: make the site in the directory with a new database and storage place, restore the archive into them, switch the host names.

Conditions:

- The destination runs the same content model, at the same migration or newer. Moving in is therefore only for sites whose model *is* a template's.
- A custom frontend cannot move in. A site that moved out and was then changed in code cannot move back.
- Archives hold password hashes and form messages; they are handled like the database.
- The template's source must be able to stand alone as a project. Today the templates depend on the workspace (`cloud/server/hosting/pushbase.ts`, known gaps).

## 2.11 The check on module-level state

A unit test parses every file under `packages/cms/server`, `analytics/server`, `consent/server` and `forms/server` with the TypeScript compiler and fails on:

- a module-level `let` or `var`;
- a module-level `const` whose value is `new Map`, `new Set`, `new WeakMap`, `new WeakSet`, an empty array or an empty object;

unless the value is made by `cmsSiteScoped(...)` or `cmsProcessWide(..., reason)`, or it is a constant set built from literals. The test starts with an allowlist of what exists today (about 60 entries from 2.5); each step of the work removes entries, and adding one fails the test. This is what keeps the next cache from being written the old way.

## 2.12 The two-site test suite

The built playground (it has every plugin) runs in multi mode with a `file` directory of two sites, A and B, each with its own database and user, and with the **same entry and user ids** in both (B is a copy of A's database with different content), since that is the hardest case. For every item the test acts on A and asserts on B.

| Area | What is proven |
|---|---|
| Hosts | an unknown host gets 404 from every route; a forged `X-Forwarded-Host` does not choose a site; an in-process request cannot name another site |
| Public content | every `/api/content/*` route, the page tree, globals, search, forms: A's entry is absent on B |
| Admin | every `/api/cms/*` route, called with A's session on B's host: refused |
| Sessions and tokens | A's cookie, access token, OAuth token, invitation and reset link on B: refused, although the user id exists there |
| Sitemap, robots, canonical, OpenAPI | each names its own host and its own entries |
| Media | a file uploaded to A is 404 on B by its key; A's storage folder holds only A's files; picture sizes are made in A's place |
| Preview | A's unsaved preview is not readable on B with the same user and entry id |
| Redirects | A's redirect does not act on B |
| Rate limits | exhausting sign-in tries on A leaves B open |
| Analytics and consent | a view counted on A is in A's database only, also after the timed flush; A's settings and salt do not apply to B |
| Webhooks | a change on A calls A's endpoint with A's secret only |
| Scheduled work | an entry scheduled on A is published on A; the task run without a site throws |
| Live editing | two editors on the same entry id on A and B: neither sees the other's presence, changes or document |
| E-mail | links and sender are the site's own |
| Database | A's role cannot connect to B's database |
| No site | `useCms()`, `useCmsStorage()` and a `cmsSiteScoped` value outside any site each throw |

A second, smaller run goes through the sign-up app: two Photographer sites made by the `shared` driver, the same assertions on what that template has.

## 2.13 What changes in `cloud/`

- `server/hosting/shared.ts`: the driver described in part 1. It needs an administrator connection to the sites' Postgres, a writer for the directory, and the storage's way to make a place and a key.
- `sites` gains nothing new: the directory can be a view over it, or a small table of its own written by the driver. The encrypted `secrets` column already holds what a site needs.
- `server/utils/provision.ts`: steps 3 and 4 stay. The cloud reaches a site at the template app's internal address with the site's host name, so `SiteClient` learns to send a host.
- Locally the template's app is one process per template (started by the driver the way the `local` driver starts a site's process today); a site's address is `http://<slug>.localhost:<the template's port>`.
- The template database (`tpl_<template>`) is made by `templates:build` or by the release: migrated, owned by `tpl_owner`.
- `describe()` reports the template app's health; memory is per app, not per site.
- Keeper keeps working per site: each site has its own status token and answers `/api/health/status` on its own host. The memory it reports is the whole app's.

## 2.14 The build: what exists and what it showed

Built on the branch `feat/multi-tenant`, local only: nothing is pushed, released or deployed. Single mode is the default. Its API tests pass unchanged, and a site that sets none of the new variables behaves as before.

### What exists

**In `packages/cms`: the mode**

- `server/utils/cmsSite.ts`: the seam. The mode (`NUXT_CMS_TENANCY_MODE=multi`), the site directory, the current site, per-site memory (`cmsSiteScoped`), the settings of a site laid over the process's (`cmsSettings()`), work in every site (`forEachCmsSite`).
- **A site's own content types** (experimental, built later on `feat/custom-types`; `docs/custom-types-plan.md`): `NUXT_CMS_CUSTOM_TYPES=on` beside the mode lets each site make types of its own, and a row's `config.customTypes` (`enabled`, `types`, `fields`, `options`) switches them off for one site or sets its limits.
- `server/plugins/cms-0-site.ts`: the wrapper that gives every request its site from its host name. `server/utils/cmsSocketSite.ts` does the same for sockets at the upgrade.
- **The site directory** is a JSON file (`NUXT_CMS_TENANCY_FILE`) or a table in Postgres (`NUXT_CMS_TENANCY_DATABASE_URL` and `NUXT_CMS_TENANCY_TEMPLATE`; the table is `tenant_sites`, asked once a second). With `NUXT_CMS_TENANCY_KEY` the database address and the secret of each site are stored encrypted (AES-256-GCM, written `enc:v1:…`); the table needs the key. A row that cannot be read is refused with its reason in the log, and the sites that were loaded keep running.
- **Hosts.** A site's first host is its address. Its other `hosts` redirect there (308). Its `alsoHosts` are served without a redirect: that is where a site with a customer's domain keeps answering at its service address.
- **States:** `active`, `paused` (503), `read-only` (reads work; writes, background tasks and the editing socket do not), `moved` (every request is redirected to `movedTo`, path and query kept).
- A database per site with its own user (`server/utils/cmsDb.ts`), with one cap on the connections of all sites together (`NUXT_CMS_TENANCY_MAX_CONNECTIONS`, default 30). Storage, sessions, secrets and e-mail per site.
- Every cache moved to per-site memory or declared process-wide (about 40 places), in the core and in the analytics, consent and forms plugins. `test/unit/module-state.spec.ts` refuses new module-level state in the server code that is neither.
- Work outside a request names its site: migrations, the search index and the setup code per site on first use; the picture queue runs each job in the site that queued it; the analytics buffer, the live hub and shared editing (one Hocuspocus per site) are per site.
- **Scheduled work by "next due"** (`server/utils/cmsBackground.ts`, `cmsScheduler.ts`). Each task first asks, in memory, whether a site has a reason to be looked at, and opens its database only then. Publishing at a set time remembers when the site's next entry is due; a change that touches scheduling clears that. Picture sizes run where an upload happened. Every site is looked at once in 15 minutes whatever the memory says, each at its own moment inside that quarter of an hour, so thousands of sites are not all visited on the same tick. Retention (daily) goes through the sites a few at a time with a pause between one site and the next.
- **Idle sites are unloaded** after 15 minutes without use (`NUXT_CMS_TENANCY_IDLE_MINUTES`): caches, pool, live hub, shared-editing engine. Background work does not count as use.
- **The operator's route:** `GET /api/health/sites` with `NUXT_CMS_TENANCY_OPERATOR_TOKEN` lists every site of the process (hosts, state, whether it is loaded, work under way, how long it has been quiet, its migration state, its connections) and the totals: sites loaded, failed migrations, connections against the cap, memory. Looking never loads a site. Without the token the route does not exist.
- **The session cookie:** the app warns at start when the cookie is not named with the `__Host-` prefix.

**In `packages/cms`: for single-site apps too**

- **Sign-in with the account and the website switcher** (2.15): `cms.auth.account`, three routes under `/api/cms/_auth/account/`, the button on the sign-in page, the site's name as a menu of the person's websites. Described in `docs/guide/admin.md`. Off without the three settings.
- **A place inside a bucket:** `cms.storage.s3.prefix`. **A limit for the whole site:** `cms.storage.maxBytes`, checked under a lock per site so parallel uploads cannot all see room. Described in `docs/guide/media.md`.

**In `cloud/`**

- **The `shared` hosting driver** (`server/hosting/shared.ts`): one process per template; a new site is a role, an empty database, a folder and a row in the template's directory. The directory is a file, or the table `tenant_sites` in the cloud's own database (`NUXT_HOSTING_SHARED_DIRECTORY=postgres` with `NUXT_HOSTING_SHARED_DIRECTORY_KEY`), which the template's process reads as a role that may `SELECT` that one table and nothing else.
- **The account service** (`server/routes/oauth/`, `server/utils/account.ts`): the issuer of 2.15. Every cloud-made site is a client; a website somebody runs themselves is connected on `/sites/connect` and gets three lines for its environment. "My websites" lists a person's own sites, connected websites and other owners' websites they work on.
- **Custom domains** (`server/utils/domains.ts`): add, check, make main, remove. A name is used once its DNS leads to `NUXT_HOSTING_DOMAIN_TARGET`. `GET /api/domains/ask?domain=<host>` answers 200 or 404: the question a certificate issuer asks before it issues.
- **Plans** (`shared/plans.ts`): the limits of a site's plan go into its row, and the site enforces them. One plan exists, `basic`: 20 MB an upload, 1 GB in all.
- **Moving a site out and in** (`server/utils/transfer.ts`): out is read-only, `tinyzoo backup`, reopen; the archive carries `site.json` (the site's settings) and is downloaded by its owner only. "It lives elsewhere now" makes the row `moved`; then its data here can be deleted while the redirect stays. In is an archive sent to `POST /api/sites/import`, which becomes a new site through the usual steps.
- **`postgres:close`** (`scripts/postgres-close.mjs`): revokes `CONNECT` from `PUBLIC` on every database of a named server, so a site's user can connect to its own database only. It lists what it would do and changes nothing without `--yes`. It is run once per server by whoever runs the server.

**Tests**

| | |
|---|---|
| `test/api/tenants*.spec.ts` | two sites in one process, the second database a copy of the first (same account ids, same entry ids): 16 files, 166 tests with Redis, about four minutes |
| `test/api/tenants-instances.spec.ts` | two processes on one directory with Redis: 13 tests (needs `TEST_REDIS_URL`) |
| `test/api/tenants-burst.spec.ts` | 24 new sites used at the same moment under a cap of 6 connections |
| `test/unit/cms-site.spec.ts`, `module-state.spec.ts`, `background-sites.spec.ts`, `db-driver.spec.ts` | the seam, no undeclared module-level state, the scheduling memory, the driver against the real pool |
| `test/api/account.spec.ts`, `storage-limits.spec.ts`, `s3-prefix.spec.ts` | the single-site side of the new settings |
| `pnpm --filter tinyzoo-cloud e2e:shared` | the sign-up app makes two Photographer sites with the shared driver: 81 checks |
| `… e2e:account` | the account protocol played from a website's side, every refusal: 163 checks |
| `… e2e:signin` | the cloud, real sites and a real browser (Chromium): 88 checks |
| `… e2e:ops` | the directory in Postgres, domains, limits, moving out and in, `postgres:close`: 180 checks |
| `test/pgbouncer/` | the PgBouncer set-up and how to run the suites through it |

The whole run on the finished branch (2026-11-24, against a Postgres of its own): the API project 1 006 tests in 84 files (seven minutes), the unit project 1 931 tests in 110 files, the type-check, and the four scripts of the cloud, all passing.

Run them (use a Postgres of your own for the cloud's scripts: they make and drop databases and roles):

```sh
TEST_DATABASE_URL=postgres://cms:cms@localhost:5434/<a database of your own>_test pnpm vitest run --project api test/api/tenants
TEST_REDIS_URL=redis://localhost:6383/11 TEST_DATABASE_URL=… pnpm vitest run --project api test/api/tenants-instances.spec.ts
pnpm --filter tinyzoo-cloud templates:build photographer
pnpm --filter tinyzoo-cloud e2e:shared && pnpm --filter tinyzoo-cloud e2e:account && pnpm --filter tinyzoo-cloud e2e:signin && pnpm --filter tinyzoo-cloud e2e:ops
NUXT_HOSTING_DRIVER=shared pnpm --filter tinyzoo-cloud dev     # the sign-up app with the shared driver, by hand
```

### What it showed

**One process, two Photographer sites, made through the sign-up app.** Both on one port and one process id; each with its own database and its own user, which is refused on the other's database and on the cloud's; each with its own name, look, content and files; a session of one refused on the other; an unknown host gets 404; deleting one leaves the other untouched. A site is made in about 3 s (database 35 ms, start 1.6 s, demo content 1.5 s, account 70 ms), against minutes for a process of its own.

**Memory of one Photographer app** (its resident memory; empty sites, each migrated and its home page and one API route asked for twice):

| Sites | After start | After every site was used |
|---|---|---|
| 1 | 301 MB | 320 MB |
| 2 | 302 MB | 321 MB |
| 20 | 302 MB | 320 to 324 MB |
| 100 | 303 MB | 309 to 399 MB |
| 300 | 303 MB | 397 to 469 MB |

The figures move from run to run (the ranges are several runs). A site that has been used costs roughly half a megabyte, between 0.3 and 1 MB in these runs, and a site in the directory that nobody visits costs nothing measurable. One process per site, as the local driver does it, is about 300 MB each: 300 sites would be 90 GB. With demo content and pictures in work, two sites ran at 440 to 530 MB. No connection stays open once the sites are quiet. These were measured before idle sites were unloaded; a used site now gives its half megabyte back after 15 minutes.

**Connections.** The first use of 100 new sites, each migrating its empty database: without a cap, 187 s with failed connections (the local Postgres allows 100 and other work was using a third of them). With the cap at 12 connections for the whole app: 13 s, no failure. 300 sites: 32 s, no failure. During those runs Postgres listed up to 19 connections of the sites at once, over the cap. That had a cause, found later with 50 sites under a cap of 30, where the app held 46 to 52 connections: the pool hands an idle connection out one tick after it is asked, and the driver gave the room back at once, so the same idle connection was promised twice and the pool opened one nobody had made room for (bug 10 below). With the fix, eight cold bursts of 50 sites peaked at exactly 30.

**Two instances with Redis.** Two processes on one directory, two sites with the same user ids and entry ids. Changes (the redirect list, the sitemap) reach the other instance inside their site, with one webhook delivery per change. Presence, "is editing" and change notices cross instances; site B's tabs on either instance were sent nothing of site A's. Shared editing carries text and cursors both ways, and the same document name on B is another document on both instances. Rate limits count across instances per site. Scheduled publishing announces once, not once per instance. Pausing a site answers 503 on both instances within a second. Every Redis key and message names its site. With four cross-site leaks put into a temporary build, 10 of the 13 tests failed.

**PgBouncer in transaction mode** (1.26.1). The two-site suite and the single-site API suite pass through it with no change to the app's SQL. The set-up that works: `auth_query` through a `SECURITY DEFINER` function in one lookup database, SCRAM pass-through, so PgBouncer holds no site's password and its own login may open no site's database (`test/pgbouncer/`). Two things to know:

- *The cap changes meaning.* It counts the app's connections to PgBouncer. Real connections at Postgres, 50 sites, one app, cap 30:

  | Most real connections at once | straight | PgBouncer, 2 per site, idle 5 s | 1 per site, idle 5 s |
  |---|---|---|---|
  | First use of all 50 at once | 30 | 86 | 50 |
  | All 50 again, migrated | 30 | 50 | 50 |
  | One round of the every-minute tasks (before "next due") | 29 | 84 | not measured |

  PgBouncer keeps a pool per site and closes a connection only after its idle time; it has no limit across databases. When the app closes a quiet site's pool to make room, that site's real connections stay open at PgBouncer. So with one instance PgBouncer costs connections. Its gain is that real connections stop multiplying with the number of instances.
- *A database with connections cannot be copied or dropped.* PgBouncer keeps real connections after the app let go of them. Whoever drops or copies a site's database behind it ends them first. `tinyzoo backup` and `restore` use `pg_dump` and need the direct address.

**The directory in Postgres.** A change of the table reaches the running process in under a second (0.85 to 0.96 s in the runs, for a paused row and for a removed one). The table holds no password and no secret in plain text; the process's command line and environment hold no secret of a site. What the process holds of its own: the directory key, the reader's password, its operator token.

**The account, in a browser.** An owner makes an account, confirms the e-mail, makes two sites and gets into the first with *Open the admin*, having typed no password for the site. The switcher takes them to the second site without a form (two redirects). An invited colleague with no account makes one and is accepted as an editor; they see that site and no other. A person with no invitation gets the no-access notice and is listed nowhere. Roles changed and people disabled on the site show in the account at once. With the cloud app stopped, open sessions keep working and a password still signs in. Two websites that run as their own processes are connected with three lines each and behave the same.

**Domains.** A site with its own domain as the main address answers there; its service address still answers without a redirect (the cloud keeps reaching it); the sitemap and the links in its e-mails use the domain; sign-in through the account works at the domain and a sign-in that would come back to the old address is refused.

**Moving.** A site moved into shared hosting as a new site has the same content, people (with their passwords) and media, its own database, user and folder, and nothing connects it to the original. A site moved out runs as an ordinary single-site process from the same archive. What does not carry over is the open sessions: in shared hosting the cookie is sealed with the secret of the template's process, shared by all its sites, so it is not in the archive. People sign in once more. A move also needs the website connected to the account again (it gets a new client).

**Bugs the tests found, all fixed.** None of these was visible from reading the code:

1. A health check by IP with a session cookie answered 500 (the session middleware asked for a site).
2. A hook of the sitemap module fires on every request, also the ones without a site.
3. After a site's row changed, a request that began under the old row could make the site's new settings from the old row, for every request after it.
4. A request under way when its site's row changed failed with 500: the site's pool was closed under it.
5. Page views waiting in memory were thrown away when the site's row changed.
6. Picture work of a deleted site went on and wrote its files into the deleted site's folder again.
7. Without a cap, the first use of many sites ran the Postgres server out of connections.
8. With the cap in place: work that is not a request (a page's own request left running after the page was sent, a search index being built) held a handle to a pool the cap then closed, and its next query failed. A handle to a closed pool now takes its connection from the site's current pool, a pool with callers waiting is never closed, and a page's in-process requests count as work of their site.
9. A page asked for before its new site's database was migrated looked for tables that were not there yet. Pages now wait for the site's migrations, as API requests always did.
10. The cap let a pool open connections nobody had made room for (above). Found by counting the process's sockets, not by any test that existed; `tenants-burst.spec.ts` now fails against the old driver.
11. Presence between instances arrived up to one heartbeat late (20 s in production; the tests' 1 s heartbeat hid it): a site's hub that starts on one instance had not been listening. It now asks the other instances who is there.
12. The per-user upload quota was a select followed by an insert, so parallel uploads could all pass it. It is checked under the same lock as the new total now. This one is in single mode too.

Numbers 3, 4 and 6 led to how a site's memory is held now (2.2, "as built").

### Where the build differs from the design

- **The switch** is an environment variable, not the module option `cms.tenancy.mode`: the option list is part of the frozen public surface, and the mode is experimental.
- **Making a database:** empty and migrated by the app, not copied from a template database (2.3, with the trap that was in the first version of this document).
- **Sessions:** bound to the site by a proof made with the site's secret; the cookie's sealing key is still the process's (2.4). That is why sessions do not survive a move.
- **PgBouncer** does not cap real connections in one place (2.3, corrected).
- **Shared editing:** a site's engine closes when the site is unloaded, not when its last editor leaves. Until then it holds about 3 Redis connections per instance.
- **The account** (2.15): a person is listed as a member of a website only once that website confirmed them, not as soon as they signed in. An invitation is accepted by the account's verified e-mail also after its link ran out.
- **A verified domain that is not the main one** redirects to the site's address, and the certificate question says yes for it.
- **Other databases on the server:** the driver closes the cloud's own database to the sites' users. Closing `postgres`, `template1` and anybody else's databases is `postgres:close`, run on purpose by whoever runs the server; it was run on a Postgres of its own only.

### What the platform in front must provide

None of this is in this repository; nothing was changed on Pushbase.

1. **Routing by host.** Every service address (`<slug>.<service domain>`) and every verified domain goes to the template's process with its `Host` header kept, or with `X-Forwarded-Host` and `NUXT_CMS_TENANCY_FORWARDED_HOST=true`.
2. **Certificates.** A wildcard certificate for the service domain. For a customer's domain, a certificate issued only after `GET <cloud>/api/domains/ask?domain=<host>` answered 200. The platform is reachable at `NUXT_HOSTING_DOMAIN_TARGET`.
3. **A storage key per site.** Pushbase Storage confines every key to its own files already (2.4); it needs a way to issue one such key per site for an app that serves many, or a prefix policy per key. The app side is ready: a site's row takes a bucket, keys and a prefix of its own.
4. **One long-running process per template**, started with the directory's address and key, restarted on a release, with the health routes that need no site (`/api/health/live`, `/api/health/ready`).
5. **Postgres:** `postgres:close` once per server; `autovacuum_naptime` raised when databases are counted in thousands (2.7).

### Not built, not tried

- Any deployment. Everything ran on one machine.
- A sealing key per site for the session cookie (it needs a change in nuxt-auth-utils, or tinyzoo sealing its own session).
- Firefox and WebKit with the `__Host-` cookie: their browser builds were not installed. WebKit keeps no `Secure` cookie on `http://localhost`, which is a matter of local runs only.
- A page in the cloud to pause a site or to change its plan; rechecking a domain that was verified once; importing a plain `tinyzoo backup` that has no `site.json`.
- A live DNS lookup of a domain that leads to the target (the comparison is unit-tested; the live run was of a name that does not resolve).
- The export waits one second after the site turns read-only. A write that began before and runs longer than that could miss the dump.
- The backup spec with a storage prefix could not run on this machine (no `pg_dump` on the host); the storage side of it is covered against a stand-in bucket.
- Keeper's copy of the status type has no `media.limitBytes` yet. The field is optional.
- Memory and connections were measured up to 300 sites, with empty sites. Nothing was measured with thousands, or with real traffic.

### What to do next, in order

1. Merge this branch with the templates' branch and release the package (three changesets, all experimental or additive).
2. On Pushbase: the five things above. The storage key per site and the certificate question are the two that need new work there.
3. Deploy the cloud app and one template's process for real, with a handful of sites, behind the operator's route and Keeper.
4. Connect 6dance and Studio Grand to the account as two websites that run by themselves (*Connect a website you already run*): this needs the cloud app deployed and nothing else.

## 2.15 The account: the protocol between the cloud app and a site

This is the contract the two sides are built against. The **issuer** is the cloud app (the account service). A **client** is one site: a site made by the cloud, or a site somebody runs themselves and connected to their account. A **subject** (`sub`) is the id of a person's account at the issuer.

### What the issuer keeps

- **Clients:** `client_id`, a hash of `client_secret`, the account that owns the client (the *owner*), the site's name and address, and for a cloud-made site its site id. The secret is shown once.
- **Codes:** one-time, 60 seconds, bound to the client, the redirect address, the PKCE challenge and the person.
- **Members:** which person has signed in to which client, with the role the site last reported and whether the site still lets them in.

### The issuer's endpoints (all under the issuer's address)

| Endpoint | Who calls | What |
|---|---|---|
| `GET /oauth/authorize` | the person's browser, sent by a site | `response_type=code`, `client_id`, `redirect_uri`, `state`, `code_challenge`, `code_challenge_method=S256`, optional `prompt=none`. The `redirect_uri` must be exactly the client's address + `/api/cms/_auth/account/callback`. Signed in: answers 302 to `redirect_uri?code=…&state=…` at once (no consent page: the clients are the person's own websites). Not signed in: 302 to the issuer's sign-in page, which comes back here afterwards; with `prompt=none` it answers 302 to `redirect_uri?error=login_required&state=…` instead. A wrong client or redirect address gets an error page, never a redirect. |
| `POST /oauth/token` | the site's server | JSON `{ grant_type: "authorization_code", code, redirect_uri, client_id, client_secret, code_verifier }`. Answers `{ user: { sub, email, email_verified, name, locale } }`. The code works once; a wrong secret, verifier, redirect address or an old code gets 400 `{ error: "invalid_grant" }` (401 `invalid_client` for the secret). On success the person becomes a member of the client. |
| `POST /oauth/sites` | the site's server | `Authorization: Basic base64(client_id:client_secret)`, JSON `{ sub }`. Answers `{ sites: [{ id, name, url, role, current }], account: "<issuer>/sites" }`: the clients **of the same owner as the asking client** that the person is a member of (or owns), the asking one marked `current`. A site never learns about websites of other owners. |
| `POST /oauth/membership` | the site's server | Basic auth as above, JSON `{ sub, role, active }`: the site says which role the person has there, or that it no longer lets them in. Answers `{ ok: true }`. |
| `GET /.well-known/tinyzoo-account` | anybody | `{ issuer, authorization_endpoint, token_endpoint, sites_endpoint, membership_endpoint }`. |

### What a site does

Settings: `cms.auth.account = { issuer, clientId, clientSecret }` (`NUXT_CMS_AUTH_ACCOUNT_ISSUER`, `_CLIENT_ID`, `_CLIENT_SECRET`; per site in multi-tenant mode). Without them nothing below exists and sign-in is as it always was. With them, password sign-in stays as well.

| Route | What |
|---|---|
| `GET /api/cms/_auth/account/start?next=<path>&silent=1` | Makes a state and a PKCE verifier, keeps them in a short-lived sealed cookie, and sends the browser to the issuer's `authorize` (`prompt=none` when `silent=1`). `next` must be a path of this site. |
| `GET /api/cms/_auth/account/callback?code&state` | Checks the state, exchanges the code, and finds the person's account **on this site**: (1) the one linked to this `issuer` + `sub`; else (2) when `email_verified`, the account with that e-mail: an active one is linked, an invited one is accepted (it becomes active, with the account's name, without a password) and linked; else (3) nobody: the browser goes to `/admin/login?account=no-access`. Then it opens the site's normal session, tells the issuer the person's role (`membership`), and goes to `next`. |
| `GET /api/cms/_auth/account/sites` | For the signed-in person: their other websites, asked from the issuer's `sites` and kept for a minute. Empty when the person is not linked to an account. |

- **Roles stay on the site.** The issuer only knows that a person is a member and what the site last said their role was, for showing it in the switcher.
- **The link** between an account and a site's user is kept on the site, in `cms_state` (no change of the schema): `account:<sha256(issuer + "\n" + sub)>` → `{ userId, issuer, sub }` and `account-of:<userId>` → `{ issuer, sub }`. Both go when the user is deleted.
- **The switcher** is the site's name at the top of the admin: with other websites in the list it opens a menu (name, role, the current one marked, "All my websites" leading to the issuer). Choosing one opens `<that site>/api/cms/_auth/account/start?next=/admin&silent=1`; the issuer knows the person, so they land in that admin without a form. When the issuer answers `login_required` the site shows its sign-in page.
- **A disabled account, a removed role, "sign out everywhere"** work as before: the session is the site's own and is checked on every request.

### Settled when the two sides met

Built on both sides and run together in a browser (`e2e:signin`). Where the text above left something open, this holds:

- **Listed once confirmed.** A person becomes known to the issuer at a client when a code is exchanged there. They are *listed* (in "My websites" and in other websites' switchers) only once that website has sent `membership` with `active: true`, so a person the site turned away shows up nowhere. Only the site can set `active` back to true. The asking client is always in its own `sites` answer as `current`. `role` may be `null`: a website that has not said a role yet is listed by its name alone.
- **A site may report only people who signed in to it.** `membership` for a person who never exchanged a code at that client answers 404 `{ error: "not_found" }`, so a connected website cannot push itself into a stranger's list. `active` left out means true; `role` left out or unusable keeps the role the issuer had.
- **The site reports before the browser goes on** (two seconds at most), so the list of websites is right on the next page. It reports again on a role change, when a user is disabled, removed, or erased with the privacy tools.
- **An invited user is accepted by the verified e-mail,** whether or not the invitation's link still works (7 days), as long as the user is still invited. An account whose e-mail is not confirmed is linked to nobody and gets its own notice.
- **Addresses.** The issuer keeps a client's address as an origin: lower-case host, no default port, no trailing slash. The site builds `redirect_uri` from the same form of its public address (`server/utils/cmsAccountAddress.ts`, tested against the issuer's own function). A connected website is https, or http for `localhost`, `*.localhost` and the loopback addresses. When a site's main address changes (a domain), the cloud changes its client's address in the same step.
- **`authorize`.** Once the client and the redirect address are right, other problems go back to the site as `error=invalid_request` or `error=unsupported_response_type`; the site treats any `error` on its callback like `login_required`. `state` is required (at most 512 characters); `code_challenge` is exactly 43 base64url characters. The error page is HTTP 400.
- **`token`.** A code is spent by the first try of its own authenticated client, even a failed one; a wrong secret or another client does not spend it. `code_verifier` is 43 to 128 unreserved characters. `sub` is a lower-case uuid; `locale` is `cs` or `en`.
- **Limits.** Fifty failures from one address in ten minutes block that address on the three POST routes. Thirty bad codes sent with a client's right secret block that client's exchanges. A wrong secret is not counted against the client it names: the client id is public, and counting it would let anybody lock a site's sign-in out. On the site, 60 sign-ins from one address in 15 minutes.
- **When the issuer is down.** The site asks the issuer's discovery address before it sends a browser there. With no answer the person stays on the site's sign-in page with a notice; open sessions keep working and a password still signs in.
- **Somebody with no password on the site** (accepted through the account) is told so on their account page and can have the forgotten-password e-mail sent to set one.
- **Ids and secrets.** Client ids are uuids, secrets 32 random bytes; the issuer keeps secrets and codes as SHA-256. The issuer handed to sites is the cloud's public address without a trailing slash. An account can connect at most 50 websites.
- **Beyond the protocol:** `/signup` at the issuer (an account without a website, for a person invited to somebody else's site) and `GET /api/auth/continue` (the sign-in page asks which website the person is going to).
