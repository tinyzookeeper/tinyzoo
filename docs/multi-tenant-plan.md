# Multi-tenant tinyzoo: the design

**Status (2026-11-23):** the design was accepted and a first working version is built on this branch (local only, not released). Section 2.14 says what is built, what the build showed and where it differs from the design; the rest of the document is the design as it was written, corrected where the build proved it wrong. The measurements were taken on this machine against Postgres 16.11; where a number is an estimate, it says so.

Part 1 is the ten-minute read. Part 2 holds the details behind each paragraph of part 1.

**Words.** A *site* is one website with its own content, people and files. An *app* is one running build (one content model, since the model is code). *Single* mode is today: one app, one site. *Multi* mode is new: one app, many sites.

---

# Part 1: the ten-minute read

## What is proposed

One switch with two values (in the first build it is the environment variable `NUXT_CMS_TENANCY_MODE`). `single` is the default and behaves as today. In `multi` the same build serves many sites: each request is given its site from its host name, and everything a site owns (database, files, secrets, caches, sockets) is reached only through that site.

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

- *database* step: create the role and the database from the template's prepared database.
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
6. **`cloud/`:** the `shared` driver and the template database.
7. **Account sign-in and the switcher** (independent of 1 to 6; it can come first for 6dance and Studio Grand).
8. **Operations:** PgBouncer, custom domains, quotas, moving in and out.

## Decisions (2026-11-23)

1. **6dance and Studio Grand:** two apps with a shared sign-in and switcher. They can live on one server and one Postgres; they do not share a process.
2. **Where the identity lives:** the cloud app.
3. **Template updates:** every site of a template moves to a new build together. The rule that goes with it: a change to a template adds things or fixes them; a redesign ships as a new look. A customer's content is data in their own database and a deploy does not touch it.
4. **Files:** a key per site, limited to that site's files. Pushbase Storage already confines every key this way (2.4); it needs a way to issue one such key per site for an app that serves many.
5. **The first build** went ahead: 2.14.

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

**Unloading idle sites** (not built): a site that has not been used for a while could drop its caches. Its connections already close by themselves, and the measured memory per site is small (2.14), so this can wait.

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

**A pooler in front.** PgBouncer in transaction mode helps when several instances and several templates share one Postgres: the apps' connections to it are cheap, and the real connections are capped in one place. It cannot share a connection between two sites (a connection belongs to one database and one user), so the saving is in idle and duplicated connections, not in the peak. tinyzoo is compatible with transaction mode: locks are `pg_advisory_xact_lock`, settings are set per transaction (`server/utils/cmsSearch.ts:224-229`), there is no `LISTEN` and no named prepared statement in `server/`. Per-site users are handled with `auth_query`, so there is no user list to maintain. Adding it later is a change of the database host in the directory.

**Scheduled work must not wake every database.** Two tasks run every minute today (`module.ts:326-333`). Run naively over 10 000 sites they would open 20 000 connections a minute. The build runs them the naive way (in every active site, five at a time, under the connection cap), which is fine for tens of sites and is the first thing to change before hundreds. The design:

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
- The cookie should be named with the `__Host-` prefix (`NUXT_SESSION_NAME`). Browsers refuse such a cookie with a `Domain`, so a script on one site cannot plant a session cookie for a sibling under the same parent domain. Not set by the build and not tried: the local sites run on `http://*.localhost`.
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
| Shared editing (`/api/cms/_collab/socket`) | one Hocuspocus, documents named `<entity>/<uuid>`; hooks call `useCms()`; one 30 s heartbeat and an hourly purge | one Hocuspocus per site with open documents, closed when the last leaves; its hooks run inside its site; Redis prefix includes the site |
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
5. The new app gets the site's settings as environment variables: app secret (so sign-ins survive), status token, content token, mail, public address.
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

## 2.14 The first build: what exists and what it showed

Built on the branch `feat/multi-tenant`, local only: nothing is pushed, released or deployed. Single mode is the default and its 789 existing API tests pass unchanged.

### What exists

**In `packages/cms`**

- `server/utils/cmsSite.ts`: the seam. The mode (`NUXT_CMS_TENANCY_MODE=multi`), the site directory (a JSON file, `NUXT_CMS_TENANCY_FILE`, reread when it changes), the current site, per-site memory (`cmsSiteScoped`), the settings of a site laid over the process's (`cmsSettings()`), work in every site (`forEachCmsSite`).
- `server/plugins/cms-0-site.ts`: the wrapper that gives every request its site from its host name. `server/utils/cmsSocketSite.ts` does the same for sockets at the upgrade.
- A database per site with its own user (`server/utils/cmsDb.ts`), with one cap on the connections of all sites together. Storage, sessions, secrets and e-mail per site.
- Every cache moved to per-site memory or declared process-wide (about 40 places), in the core and in the analytics, consent and forms plugins. `test/unit/module-state.spec.ts` refuses new module-level state in the server code that is neither.
- Work outside a request names its site: migrations, the search index and the setup code per site on first use; the three scheduled tasks in every active site; the picture queue runs each job in the site that queued it; the analytics buffer, the live hub and shared editing (one Hocuspocus per site) are per site.
- States of a site: `active`, `paused` (503), `read-only` (reads work; writes, background tasks and the editing socket do not).

**In `cloud/`**: the `shared` hosting driver (`server/hosting/shared.ts`). One process per template; a new site is a role, an empty database, a folder and a row in the template's directory file.

**Tests**

| | |
|---|---|
| `test/api/tenants*.spec.ts` | two sites in one process, the second database a copy of the first (same account ids, same entry ids): 114 tests in 9 files, about two minutes |
| `test/unit/cms-site.spec.ts` | the seam by itself: 38 tests |
| `test/unit/module-state.spec.ts` | no undeclared module-level state |
| `pnpm --filter tinyzoo-cloud e2e:shared` | the sign-up app makes two Photographer sites with the shared driver: 81 checks, half a minute |

Run them:

```sh
TEST_DATABASE_URL=postgres://cms:cms@localhost:5434/<a database of your own>_test pnpm vitest run --project api test/api/tenants
pnpm --filter tinyzoo-cloud templates:build photographer && pnpm --filter tinyzoo-cloud e2e:shared
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

The figures move from run to run (the ranges are several runs). A site that has been used costs roughly half a megabyte, between 0.3 and 1 MB in these runs, and a site in the directory that nobody visits costs nothing measurable. One process per site, as the local driver does it, is about 300 MB each: 300 sites would be 90 GB. With demo content and pictures in work, two sites ran at 440 to 530 MB. No connection stays open once the sites are quiet.

**Connections.** The first use of 100 new sites, each migrating its empty database: without a cap, 187 s with failed connections (the local Postgres allows 100 and other work was using a third of them). With the cap at 12 connections for the whole app: 13 s, no failure. 300 sites: 32 s, no failure. During those runs Postgres listed up to 19 connections of the sites at once. The app counts every connection it opens and gives room only under the cap; I take the difference to be connections the app had already closed that Postgres still listed while it was busy, which is not proven. During the measurements the shared local Postgres was at its own limit of 100 connections from other work on this machine.

**Bugs the two-site tests found, all fixed.** None of these was visible from reading the code:

1. A health check by IP with a session cookie answered 500 (the session middleware asked for a site).
2. A hook of the sitemap module fires on every request, also the ones without a site.
3. After a site's row changed, a request that began under the old row could make the site's new settings from the old row, for every request after it.
4. A request under way when its site's row changed failed with 500: the site's pool was closed under it.
5. Page views waiting in memory were thrown away when the site's row changed.
6. Picture work of a deleted site went on and wrote its files into the deleted site's folder again.
7. The connections, above.
8. With the cap in place: work that is not a request (a page's own request left running after the page was sent, a search index being built) held a handle to a pool the cap then closed, and its next query failed. A handle to a closed pool now takes its connection from the site's current pool, a pool with callers waiting is never closed, and a page's in-process requests count as work of their site.
9. A page asked for before its new site's database was migrated looked for tables that were not there yet. Pages now wait for the site's migrations, as API requests always did.

Numbers 3, 4 and 6 led to how a site's memory is held now (2.2, "as built").

### Where the build differs from the design

- **The switch** is an environment variable, not the module option `cms.tenancy.mode`: the option list is part of the frozen public surface, and the mode is experimental.
- **The directory** has the `file` driver only. Database passwords are in that file in plain text, readable by its owner only. The `postgres` driver and encryption at rest are not built. A row's `state` must be one of the three words; anything else is refused.
- **Making a database:** empty and migrated by the app, not copied from a template database (2.3, with the trap that was in the first version of this document).
- **Sessions:** bound to the site by a proof made with the site's secret; the cookie's sealing key is still the process's; the `__Host-` cookie name is not set (2.4).
- **Scheduled tasks** run in every active site every time; the "next due" memory is not built (2.3).
- **The operator's status route** and the `moved` state are not built. A failed migration is visible on the site itself (503, and its `/api/health/ready`) and in the log.
- **Object storage:** a site can be given a bucket and keys of its own through its settings, untested; a prefix per site inside one bucket is not built. The tests use a folder per site.
- **Several instances with Redis:** the code carries the site in every key and message, but no test ran it in multi mode.
- **Other databases on the server:** the driver closes the cloud's own database to the sites' users; `postgres`, `template1` and anybody else's databases stay open to them until whoever runs the server revokes that (2.3).

### Not built, as planned

The account sign-in and the switcher, PgBouncer, custom domains, quotas, moving a site in and out, and any production deployment.

### What to do next, in order

1. The account sign-in and the switcher (step 7 of the order of work): the part 6dance and Studio Grand need.
2. Before more than tens of sites: scheduled work by "next due", the `postgres` directory with encrypted secrets, the `__Host-` cookie, the operator's status route.
3. Before production: the storage keys per site on Pushbase, the cluster-wide revoke, a run with two instances and Redis, and the template's process management on the platform.
