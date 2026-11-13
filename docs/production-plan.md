# Production plan: proof of concept → a CMS clients run on

**Decision (2026-11-13):** take my-cms from proof of concept to something that
runs client sites in production, the way Plaine went from prototype to the tool
the team runs on. Same way of working: one phase at a time, each written down
here, each ending green, each shipped before the next one starts.

**Target:** small and mid-sized clients, mostly Czech and European, many of them
multilingual, nothing that rules out clients elsewhere. Production runs on
**Pushbase** (Node 22 on Kubernetes, managed Postgres + Redis). Node only:
Cloudflare Workers support was dropped on 2026-11-13 (it ruled out realtime and
co-editing, and nobody plans to deploy there) — the history below still mentions it.

**Done means:** a client signs in with their own account, builds a page out of
blocks in two languages, uploads images, schedules or publishes it, and the live
site shows it without a developer in the loop. Then a test client site is
built on the published package and deployed to Pushbase (Phase 6).

## What exists today (the proof of concept)

Solid, and kept:

- Code-first content model (`defineEntity`, `defineSingleton`, `f.*`) with exact
  inferred types, a generated Drizzle schema and drizzle-kit migrations.
- Generic CRUD with entity- and row-level access rules; generated admin
  (list, form, globals, media library, TipTap rich text, slug auto-fill,
  publish/unpublish, draft preview, unsaved-changes guard).
- Headless delivery API (`/api/content/*`), OpenAPI 3.1, a typed client
  (`@my-cms/client`), rich-text sanitising on write and on render.
- Media pipeline: local or S3/R2, MIME allowlist, dimensions, quota, rate limit,
  reference-counted cleanup.
- Two security review passes, fixed.

Missing for production (what this plan is about):

| Gap | Why it blocks production |
|---|---|
| No tests, no CI | The package will be versioned into many client apps; a regression ships to all of them. |
| Users are hardcoded in the host (`playground/server/utils/users.ts`) | A client needs their own account, invites, password reset. |
| Not installable | `extends` points at a folder; by package name it resolves to `src/`. A client site in its own repo cannot use it. |
| No localization | Most target sites need cs + en, often de/sk too. |
| No page building | Clients can edit a blog, not their pages. |
| No revisions, no scheduling | Clients will overwrite things and want them back; campaigns go out on a date. |
| Generic admin UI, English only, no name | Clients judge the product by the admin. |
| In-memory rate limit/quota, local-disk media | Breaks with more than one replica; Pushbase containers keep nothing on disk across deploys. |
| No health checks, migrations by hand | Pushbase ships only `.output/`; migrations must run at start. |

## Ground rules (carried over from Plaine and the dual-runtime notes)

- **Each phase ends green:** `pnpm test`, `pnpm typecheck`, and a build of both
  Nitro presets (`node-server`, `cloudflare_module`). The next phase does not
  start on a red tree.
- **Each phase gets a short write-up** under its heading below (what landed,
  what was traded off), like `management/docs/redmine-wrapper-migration.md`.
- **Tests against a real Postgres**, in its own `<db>_test` database, no ORM
  mocking, `fileParallelism: false` (Plaine's setup, proven).
- **Feature branches, Conventional Commits**, merge to `main` per phase or slice.
- **Dual-runtime discipline stays:** no env reads at module scope, no native
  addons in shared code, Web streams at every seam, per-request DB clients on
  the edge path.
- **An adversarial review pass** before a phase that touches auth, access or the
  public API is merged.

## Phases

### Phase 0 — Safety net ✅ *done*

Lock in what already works before changing it.

- Vitest + `@nuxt/test-utils`, isolated test database created and migrated on
  first run (`test/setup/database.ts`, as in Plaine).
- Suites around today's behaviour:
  - descriptor → Zod / Drizzle column / UI name, golden-file test of the emitted
    schema;
  - CRUD handlers: create/update/delete, m2m diffing, 422 shape, access rules
    (admin vs editor, row-level);
  - content API: published filter, `hidden`, populate depth, sort/filter
    allowlists, draft preview authorisation;
  - drift test: `buildContentModel` vs what `/api/content` actually returns;
  - rich-text sanitiser, media MIME allowlist, media GC reference counting;
  - singleton write-lock and upsert.
- `pnpm typecheck` across the workspace (vue-tsc), and the existing
  `cms.types-check.ts` folded into it.
- CI (GitHub Actions): install → typecheck → test (Postgres service) → build
  both presets.
- A git remote for the repo (it has none today).

#### How it landed

- **Harness.** `vitest.config.ts` has two projects. `unit` covers the
  framework-free core and needs no database (under a second).
  `api` production-builds the playground into `node_modules/.cache/cms-test`,
  starts it on a free port against a fresh `cms_test` database (migrated from the
  playground's migrations) and a throwaway upload directory, and the specs drive
  it over HTTP with the demo accounts. That is closer to production than
  importing handlers with mocked Nitro globals, and it needs no mocking at all.
  100 tests across 12 files; a full `pnpm check` (typecheck, tests, both builds)
  takes about two minutes locally.
- **Suites:** codegen drift (schema, typed client, served bindings), entity
  definitions and validation, rich-text sanitiser, rate limiter, typed client,
  OpenAPI, auth, CRUD, row-level access, content API (published filter,
  population, hidden fields, filters/sort allowlists, preview), globals, media
  (MIME allowlist, size cap, serving headers, path traversal, reference-counted
  cleanup).
- **`pnpm typecheck` was never green before.** The playground had no
  `tsconfig.json`, so `nuxt typecheck` could not run, and the core's
  type-level assertions (`cms.types-check.ts`) were outside every tsconfig. They
  had gone stale when `seo()` was added. Both now run: a root `tsconfig.json`
  (core, client, config, tests) and `nuxt typecheck` (layer + playground). Fixing
  the ~20 errors meant typing a few `useFetch`/`$fetch` calls, dropping a
  React-only TipTap option (`immediatelyRender`; Vue's `useEditor` already creates
  the editor on mount), and `noUncheckedIndexedAccess`-safe count queries.
- **CI** is `.github/workflows/ci.yml`: typecheck, tests against a Postgres
  service, and a build matrix (`node`, `edge`) on Node 22, the runtime Pushbase
  deploys on.

Bugs the suites found, fixed in this phase:

| Found | Fix |
|---|---|
| A unique clash (e.g. an author's email) and deleting a row that is still referenced (`onDelete: 'restrict'`) answered **500** | `rethrowDbError`: unique → 409 with a field-level issue (the form shows it inline), FK on delete → 409, FK on write → 422 |
| A non-uuid id in `/api/cms/:entity/:id` and `/api/cms/_media/:id` answered **500** (Postgres cast error) | `getIdParam` → 404 |
| The playground's demo user ids were not valid UUIDs, so the documented "editors edit their own posts" rule could never match a real author row | valid v4 ids |
| Generated artifacts depended on the module namespace's key order (Node sorts exports, Vite keeps declaration order) | `buildRegistry` sorts entities by name; outputs unchanged |
| `playground` imported `tailwindcss` without depending on it; builds worked only through pnpm's hoisting, depending on the working directory | declared the dependency |

Noted for later phases, not changed here:

- Table names are the raw entity name (`"siteSettings"`) while column names are
  snake_case. Changing it needs a migration; worth deciding before the first real
  client database exists (Phase 3 touches the schema anyway).
- The playground's `nuxt.config.ts` bakes `DATABASE_URL` from the build
  environment into `runtimeConfig`. On Pushbase the build has no env (so it is
  empty and the runtime value wins), but a build elsewhere would embed the
  connection string in the server bundle. Phase 5 makes runtime-only config the rule.
- `@nuxt/icon` (a dependency of `@nuxt/ui`) is also resolved through pnpm's hidden
  hoisting. Fine for now; revisit when the package is consumed from a registry
  (Phase 5).

### Phase 1 — Name, brand and UI foundation 🚧 *foundation done; name, logo and package rename deferred*

The admin is the product the client sees, so it gets an identity and a design
system before more screens are built on the scaffold.

- Pick a name; rename packages (`@<scope>/core`, `@<scope>/client`), CLI,
  route prefixes stay stable (`/admin`, `/api/cms`, `/api/content`).
- Logo, mark, favicon (`brand/`, as in Plaine).
- `docs/ui-foundation.md`: tokens, density, typography, primitives, written
  from the Mobbin research (`docs/research/admin-ux-references.md`).
  Direction: calmer and friendlier than Plaine's dense tool, still crisp.
- Token layer the host can re-skin (per-client accent colour and logo in the
  admin, through `app.config`).
- Shared primitives (`CmsPageHeader`, `CmsListRow`, `CmsEmptyState`, skeletons,
  `CmsSection`), with component tests.
- **Admin UI translations** (cs + en at launch). A small `useCmsI18n()` with
  message catalogues inside the layer, not `@nuxtjs/i18n`, so it cannot collide
  with the host site's own i18n setup. Field labels and help in `cms.config.ts`
  accept a per-locale map.
- A `/admin/styleguide` route, as in Pushbase.

#### How it landed (foundation, 2026-11-13)

The name is deferred on purpose; everything brand-specific reads from
`cms.admin.name`, so naming is a one-line change plus the package rename.

- **Tokens** in `app/assets/css/cms-admin.css`, scoped to `html[data-cms-admin]`
  so the admin and the client's website never share a theme. **Modern and
  neutral:** true greys, black primary ("mono"), one sans-serif (Geist), flat cards
  with hairline borders. Colour accents (`indigo`, `blue`, `violet`, `emerald`) are
  opt-in per client via `cms.admin.accent`.
  *A first pass with warm "paper" greys, a serif for titles and a coloured accent
  was reviewed and rejected the same day ("not modern and neutral") and replaced.*
- **Shell** on Nuxt UI's dashboard components; navigation named by task (Home /
  Content / Settings / View website); account menu with appearance and language.
- **Building blocks:** `CmsPage`, `CmsSection`, `CmsEmptyState`, `CmsStatusBadge`,
  `CmsTime`; `useCmsForm` shared by the entry editor and the settings form.
- **Admin in Czech and English** (`useCmsI18n`, catalogue parity test, Czech
  plurals). Config text (`label`, `labelSingular`, `description`, field
  `.label()`/`.help()`, select option `labels`) accepts per-locale maps; entities
  gain `icon` and `description`.
- **Home page** (`GET /api/cms/_overview`): per-collection counts and recently
  edited items, access rules applied.
- **`/admin/styleguide`**, and `docs/ui-foundation.md`.
- Tests: translation parity and placeholders, `resolveText`, the overview
  endpoint, server-rendered Czech/English, cookie over browser language, list
  headers from labels, styleguide page, admin time-zone conversion.

Bugs found and fixed along the way:

| Found | Fix |
|---|---|
| Date fields never showed a saved value (`datetime-local` cannot read ISO-with-Z), and an edited date was read in the **server's** time zone — off by 1–2 h on a UTC host | Edited as wall-clock time in `cms.admin.timeZone` (Europe/Prague), stored as the exact instant; DST-safe, unit-tested |
| List dates used the machine's locale and zone (`toLocaleDateString`) — a server/browser hydration mismatch | `formatDate` in the admin's locale and zone |
| A failed Publish left the badge saying "Published" | the status is reverted when the save is refused |
| TipTap registered `link` twice (StarterKit v3 bundles it), so the configured link options could be ignored | the bundled one is turned off |
| List headers showed raw keys ("publishedAt"); entity icons were hardcoded by name in the layer | headers use field labels; icons come from the config |

Still open in this phase: the name, logo/mark, and the package rename.

### Phase 2 — Real users and auth (owned by the CMS) ✅ *done*

Move auth from the host into the package.

- `cms_users` table: email, name, role, status (invited/active/disabled),
  password hash (scrypt, compatible with `nuxt-auth-utils`, as in Plaine;
  no native addon so Workers still works), locale preference.
- First-run bootstrap: no users → the login page creates the first admin.
- Invite by email (token link, expiry), password reset, change password,
  sign out other sessions (session version on the user row).
- Mailer seam: SMTP on Node (Pushbase allows egress), a fetch-based provider
  for Workers. Email templates in cs/en.
- Roles: `admin`, `editor` (+ `author` = own entries only) with the role
  re-read from the database on every request, as Plaine does. Hooks for custom
  roles later.
- Per-field permissions (`fieldMode` read-only/hidden by role).
- Media access scoping (today any signed-in user can delete any file).
- Login and reset rate limiting; audit log (`cms_audit`: who changed what, when).
- Users screen: list, invite, change role, disable.
- Host override seam kept: a host can still provide its own user lookup
  (e.g. SSO) through the existing `event.context.cmsUser` contract.

#### How it landed (2026-11-13)

- **Tables:** `cms_users`, `cms_tokens` (invite/reset, SHA-256 of a 256-bit
  secret, expiring, single-use), `cms_audit`; `created_by` / `updated_by` on every
  entity table. Migration 0003, additive. The CMS's runtime tables and the source it
  emits into the host schema are checked identical by a unit test.
- **Sessions:** nuxt-auth-utils sealed cookie, CMS identity under `session.cms`
  (so a host's own sign-in never collides), re-validated against the database on
  every API request (status, role, session version). Password change, reset,
  disabling and role changes bump the version. 14-day lifetime.
- **Flows:** first-run setup (advisory lock), sign-in (generic failures, equal-cost
  verification, rate limits per address and per client IP behind trusted proxies),
  forgot/reset (answered before any work happens), invite/resend/accept, account
  (name, language, password). Links come from `cms.publicUrl`, never the Host header.
- **Roles:** admin / editor / author, applied before the entity's own `access` rules
  (AND). Authors: own entries only, no publishing (create, update, delete or racing
  an editor's publish), no settings, no writes to public content without a publish
  step, own media only.
- **Mail:** `log` (bodies kept out of production logs) | `file` | `smtp` (Node build
  only, via the `#cms/mailer` alias). Czech/English invite and reset emails.
  Mailpit in compose.
- **Admin:** sign-in, setup, forgot, reset, invitation, Team and Account screens.
- **Host seam kept:** `cms.auth.mode: 'external'`.

**Independent security review** (separate agent, given the code, not my
conclusions): no privilege escalation to admin and no account takeover without a
prior foothold. 12 findings, all fixed, each with a regression test
(`test/api/security.spec.ts`, `test/unit/rate-limit-ip.spec.ts`):

| Severity | Finding | Fix |
|---|---|---|
| Medium | A stolen session could survive the owner's password change by re-signing itself via `PATCH /me` in the gap | writes that re-sign the session are conditional on the session version the request was authorised with |
| Medium | Per-IP limits read the first X-Forwarded-For entry (client-controlled); limiter memory unbounded | client IP read `trustedProxies` hops from the end (or a trusted edge header); limiter keys capped and swept |
| Medium | CSRF: h3 parses urlencoded/multipart form posts, so a same-site page could invite an attacker as admin | `/api/cms/**` writes must be JSON (multipart only for media) and same-origin per Sec-Fetch-Site |
| Low–Med | An author could get another person's unused file deleted via a draft and media cleanup | cleanup triggered by an author only removes their own uploads |
| Low–Med | A host's own nuxt-auth-utils sessions (non-UUID ids) made every `/api/` request fail | CMS identity under `session.cms.uid`, UUID-checked |
| Low | Reset/invite links printed to logs in production by the default `log` transport | bodies never logged in production |
| Low | `forgot` was slower for existing accounts (enumeration by timing) | work happens after the response (`event.waitUntil`) |
| Low | An author could delete their own live entry, or edit one an editor published between check and write | delete checks publication; updates by non-publishers carry a "not live" condition |
| Low | A reset/invite link could be used twice by simultaneous requests | the link is claimed atomically (`used_at is null` in the update) |
| Low | Two admins could remove each other at the same moment | the last-admin check and the change run under one advisory lock |
| Low | Sessions never expired | 14-day max age |
| Low | Authors could publish via public entities with no publish step; non-UUID external user ids broke writes | authors cannot write such entities; `createdBy` only stores UUIDs |

Accepted for now: the per-address sign-in limit lets someone who knows an address
delay that person's sign-in for 15 minutes (the usual trade-off of per-account limits);
limits are per instance until Phase 5 adds a shared store; Workers can only `log`
mail until an HTTP mail provider is added.

### Phase 3 — Content model for real sites ✅ *done (manual ordering deferred)*

- **Localization.**
  - `locales: ['cs', 'en', …]`, `defaultLocale`, per-locale fallback chain in the
    config.
  - `f.text().localized()` per field.
  - Storage, recommended: a `<entity>_locales` table holding the localized
    columns (typed Drizzle columns, `unique(locale, slug)`); shared fields,
    relations and media stay on the base row. This keeps types, indexes and
    per-locale slugs, unlike one jsonb blob per field; it avoids keeping
    duplicated rows in sync, unlike one row per locale.
  - Publish state per locale (a page can be live in cs and still a draft in en).
  - Content API: `?locale=`, fallback, and each item lists its available locales
    (for `hreflang` and language switchers). Typed client and OpenAPI follow.
- **Blocks (page builder).** `f.blocks({ hero: defineBlock({...}), … })`,
  stored as validated jsonb (Zod discriminated union), blocks may nest one level,
  media and relations inside blocks count for GC and get populated by the
  content API. Typed per block in the generated client.
- **Site essentials as presets:** `pages()` (slug path, parent for nested URLs,
  SEO, blocks), `navigation()` (menus with internal/external links),
  `redirects()`, sitemap and robots endpoints driven by the content.
- Manual ordering (drag to sort) for collections that need it.

#### How it landed (2026-11-13)

Three slices, each tested and committed:

1. **Blocks** — `f.blocks({ type: defineBlock(...) })`, jsonb validated per type
   (discriminated union), sanitised rich text inside, media resolved by the content
   API and counted by cleanup, exact per-type unions in the typed client and OpenAPI.
   Admin: collapsible block cards with summary and error marker, insert anywhere via a
   searchable picker (or directly when a field has one block type), move / duplicate /
   remove from a "…" menu (no drag needed).
2. **Languages** — `defineLocales`, `.localized()` on text, slug, rich text, blocks.
   Storage as planned: `<entity>_locales` with typed columns, per-language unique
   slugs; the base row is the default language; per-field fallback. Admin and content
   API take `?locale`; globals (navigation) too. Editor translation mode shows only
   translatable fields with the default text as reference and "copy from".
   **Publishing applies to all languages** (per-language publishing deferred; the UI
   says so).
3. **Site essentials** — `definePages`, `defineNavigation`, `defineRedirects` (server
   middleware, cache invalidated on change, 30 s TTL across replicas, path-only
   sources), `content.path` + `/sitemap.xml` with hreflang and `/api/content/_sitemap`.

Found and fixed on the way: server-rendered field labels pointed at ids the browser
regenerated differently (Vue `useId` under pages that await data) — labels now use
stable ids from the field key; globals' saves did not clean up images removed from
rich text.

**Independent review** of the public-API changes (separate agent): no draft or
hidden-field leaks, the translation subqueries are parameterised and correctly
scoped. 10 findings, all fixed with regression tests:

| Severity | Finding | Fix |
|---|---|---|
| High | Authors could create redirects, which go live at once (whole-site redirect off-domain) | entities can be marked `live`; authors cannot write them (redirects are) |
| Medium | Translation writes/deletes checked "not live" before, not at, write time | the entry is touched under `notLiveCond` inside the transaction first |
| Medium | Redirects with Czech characters never matched; a non-ASCII target made a 500 | paths decoded for lookup; Location header percent-encoded |
| Medium | `/sitemap.xml` read whole rows (page bodies) for up to 50k items per request | reads only id, updatedAt and path columns; memoised for a minute |
| Medium | Menu links accepted `javascript:` URLs | `f.text({ format: 'link' })` (path, #, http(s), mailto, tel) for menu and redirect targets |
| Low | `/sitemap.xml` ignored the content token; base URL could come from Host | private API → no sitemap; base only from `cms.publicUrl` in production |
| Low | Removed languages kept appearing in the sitemap | only configured languages are read |
| Low | Fields named `locale`, `locales`, `parentId`… collided with CMS columns/keys | reserved names refused in `defineEntity` |
| Low | Redirect sources with `?`, `#` or a trailing slash collided after normalisation | sources have exactly one spelling |
| Hardening | Block types looked up on plain objects; duplicate block ids allowed | `Object.hasOwn` lookups; unique block ids per field |

Deferred: manual ordering (drag to sort) for collections — moves to Phase 4 with the
list work; nested pages (parent / full paths); relations inside blocks.

### Phase 4 — Editorial experience ✅ *done*

Built on the Phase 1 foundation and the Mobbin references.

- ✅ **Simplification pass done (2026-11-13).** A second Mobbin study
  (`docs/research/admin-ux-calm.md`; Linear, Attio, Notion, Plane…) found the cause:
  equal weight, duplication, boxes everywhere. Shipped: two-column editor (title as
  heading, content left, properties right, collapsed groups), one status display and
  one primary action, quieter list (thumbnail + URL in the title cell, status tabs,
  *Updated*, one "…" menu), home reduced to *Continue editing* + *Create*, one field
  convention, image field without file data, uploads no longer default alt text to
  the file name. Rules recorded in `docs/ui-foundation.md`. Already done from the list
  below: the editor sidebar and status tabs.

- Dashboard: recent edits, my drafts, scheduled items, quick create.
- Lists: status tabs, filters per field type, saved columns, bulk publish /
  unpublish / delete, pagination that survives reloads.
- Editor: main column + sidebar (status, locale, publish date, SEO, meta),
  field groups and tabs from the config (`admin.layout`), sticky header with
  save / publish, keyboard save.
- Revisions: snapshot on every save (`cms_revisions`), timeline, compare,
  restore.
- Scheduled publishing: `publishAt` in the future = published from that moment.
  The published filter checks the date, so no job runner is needed for content
  to appear; a Nitro scheduled task only fires webhooks and cache purges
  (Redis or Postgres advisory lock, so one replica runs it).
- Live preview: the site in a side panel next to the form, refreshed on change.
- Media library v2: grid, folders/tags, drag-and-drop upload, focal point and
  alt text per locale, usage ("used in 3 pages").

#### How it landed (2026-11-13)

Five slices, each tested, checked in the browser and committed:

1. **Revisions** — every save stores a snapshot of the entry (or one translation)
   as the editor loads it, with the changed fields and who saved it
   (`cms_revisions`, newest 50 per entry and language). The editor's History panel
   (pattern from Canva, Plane and Descript on Mobbin: versions on the right, the
   difference highlighted) shows the fields that differ from the form now, word by
   word. Restore loads a version into the form; saving it goes through the normal
   write path.
2. **Scheduled publishing** — a published entry with a publish date ahead is
   scheduled: every visibility check now requires the date to have come, so it
   appears on time with no job. A Nitro task (every minute, one replica via an
   advisory lock, catching up after downtime) only announces it: webhooks, live
   updates, `cms:change`. Admin: "Schedule", a Scheduled status, a list tab.
3. **Lists** — filters by field type (`filter.<field>`), search/tab/filters/sort/page
   in the address, hideable columns, bulk publish / take off / delete (each through
   the entry's own endpoint and rules), manual order (`admin.list.orderField`,
   drag or arrows, one transaction; the content API returns that order).
4. **Dashboard, tabs, preview** — home adds your drafts and what goes live next;
   long forms can use tabs (`admin.tabs`); the site's preview beside the form,
   reloaded after saves, with the unsaved values posted to the page (`cms:preview`).
5. **Media library** — a Media page (grid, folders, search, type filter, drop to
   upload), descriptions per content language, a focal point (the content API
   returns both), file names, and where each file is used.

Found on the way: Nitro skips scheduled tasks when the server inherits Vitest's
`TEST` flag (the test setup no longer passes it); the relation picker's options
ignored row-level read rules; admin search treated `%`/`_` as wildcards; a "dirty"
form stayed dirty after editing a field back (now: dirty = differs from saved).

**Independent review** (separate agent): no High findings — scheduling hides
future entries everywhere public, access checks held. Fixed:

| Severity | Finding | Fix |
|---|---|---|
| Medium | Entries saved < 30 s before their publish time went live unannounced; "publish now" used the browser's clock | the server stamps a missing publish date (database clock); the scheduler announces any entry saved before its date |
| Medium | Restoring a version also restored status, publish date and position (could unpublish a live entry) | restore brings back content only; the position is never sent by the editor |
| Medium | A restored version could point at files deleted since | restore checks which files still exist, leaves the rest out and says so |
| Medium | Revisions never recorded for external-auth users (non-UUID ids) | `actorId` |
| Medium | Manual order had no tie-breaker: pages repeated or skipped entries | every list sorts empties last, then by creation and id |
| Medium | Authors could change the public description/focal point of their file while it is on the website; the site was not told | refused for people who may not publish; media edits report the entries showing the file (webhooks) |
| Low | Reordering filled the history and could fire 100 revisions | reorders record no revisions |
| Low | Arranging > 100 entries saved a partial order | not offered beyond 100 |
| Low | Bulk publish could overwrite a schedule from a stale row | the client never sends a publish date |
| Low | A hidden order field flipped the public default to oldest-first | only when that field is the sort |
| Low | Decimal order fields | must be whole numbers |
| Low | Fast clicks could restore or show the wrong version / file usage | stale answers ignored |
| Low | Preview posted the whole form state (could throw, leaked internals) | a JSON copy of the field values only |
| Low | Translation revisions outlived the translation | deleted with it |
| Hardening | Usage lookup unbounded; preview opened itself; reorder did work before the access check and could deadlock; non-object media PATCH → 500; media edits unaudited; first scheduler run started from "now" | rate limit; opens on demand; check first, lock in id order; 422; audited; first run looks back 10 min |
| Adjacent | List relation labels ignored the related collection's read rules; signed-in preview ignored row rules | both apply the read rules |

### Phase 5 — Production operations on Pushbase ✅ *done (registry publishing and a workerd smoke test deferred)*

- **Installable package:** fix layer resolution by package name, build step,
  publish to GitHub Packages (or npm), Changesets for versions and
  changelog, `engines` and peer ranges pinned.
- **Migrations at start:** the CMS's own tables ship as migrations in the
  package; a Nitro plugin applies them on boot (opt-in env flag, advisory lock),
  following Pushbase's `migrate-on-start` recipe.
- **Health:** `/api/health/live`, `/api/health/ready` (DB).
- **State shared between replicas:** rate limit and quota in Redis (Pushbase
  provides it), with in-memory fallback for dev.
- **Media in production = S3-compatible object storage** (Pushbase has no
  persistent app disk). EU provider by default for GDPR (Hetzner Object
  Storage or Cloudflare R2 with EU jurisdiction). Image resizing decided here:
  `@nuxt/image` + IPX on the site (sharp ships musl builds for Node 22 alpine)
  or an image proxy.
- **Publish webhooks:** configurable URLs, signed payload, retries; the client
  site uses them to purge its route cache.
- Logging: structured logs to stdout (Pushbase indexes them), request ids,
  errors with context. Error pages for the admin.
- Security headers for the admin (CSP, frame-ancestors), cookie flags behind
  Pushbase's TLS proxy, documented backups (Postgres is backed up by the
  platform; the bucket needs its own policy).
- A `starter` template (host app wired for Pushbase: `deploy.yml`, env example,
  migrate-on-start) deployed to a staging environment.

#### How it landed (2026-11-13)

Five slices, each tested and committed:

1. **Installable package** — `@my-cms/core/layer` subpath export (a bare
   package-name `extends` silently loaded `src/`), `cms` bin, and a consumer check
   that installs the packed package into a fresh app and builds it.
2. **Migrations at start and health** — bundled drizzle-kit migrations applied on
   boot with drizzle's own bookkeeping under an advisory lock; API requests wait;
   `/api/health/live` and `/ready`.
3. **Shared store** — Redis (ioredis) for rate limits and pub/sub, memory
   fallback; keys namespaced per environment.
4. **Changes, webhooks, headers, container** — every content write reports one
   change: local caches cleared, other replicas told, `cms:change` hook, and signed
   publish webhooks (HMAC-SHA256, retries, addresses in every language). Admin
   security headers, request ids, JSON error logs. A root `Dockerfile` builds the
   playground for Pushbase; running it showed the build had baked the build
   machine's `DATABASE_URL` into the output — the URL is now read at runtime only.
   `docs/deploying.md` covers environment, services, EU object storage, backups.
5. **Realtime** (below).

**Independent review** (separate agent, committed diff only): 2 High, 7 Medium, 8
Low, 6 hardening — all fixed except the ones marked deferred:

| Severity | Finding | Fix |
|---|---|---|
| High | `crypto.randomUUID()` at module load: a Worker would refuse to start | instance id made on first use |
| High | A boot migration that hit a not-yet-ready database failed for good: API 503 forever while liveness said OK | retries for ~90 s on connection errors, then liveness fails and the process exits in production |
| Medium | Migration SQL lost every `$N` token (`'costs $5'`, function bodies) | SQL without params passes through untouched; unit tests |
| Medium | Migrate-on-start would do I/O in a Worker's global scope | refused on the edge driver with a clear log line |
| Medium | Webhook "live" used the publish field, not `content.published` (scheduled or hidden rows announced) | visibility queried with the collection's own rule, before and after |
| Medium | Old translated slugs and other languages' addresses missing from webhooks | addresses in every language; tests for rename and delete |
| Medium | A down Redis held up every save and sign-in | 500 ms command timeout, no offline queue, publish off the request path |
| Medium | A wrong or down `REDIS_URL` switched rate limiting off (fail-open) | counts locally when Redis cannot answer |
| Medium | A replica that booted before Redis never heard other replicas | subscriber waits and re-subscribes; handler registered only on success |
| Low | Admin headers skipped `/ADMIN/…` and base URLs | case-insensitive, base-aware |
| Low | A malformed webhook URL could crash the failure log | URLs validated up front, logged without query |
| Low | Environments sharing one Redis shared counters and messages | prefix, default `cms:<database name>` |
| Low | Docs said stdout; overstated what webhooks cover; trusted-proxy pitfall | corrected |
| Low | Webhooks went out unsigned | not sent without a secret in production |
| Low | Image could not write local media | writable `/app/data` |
| Low | Redis connections never closed | `close()` on shutdown |
| Hardening | Failed-query logs carried parameters (emails, hashes) | stripped |
| Hardening | Raw emails in Redis keys; null counter = allowed | hashed keys; null is an error |
| Hardening | Replica messages forwarded unchecked | rebuilt field by field |
| Hardening | Delivery id not signed; user ids sent to sites | id inside the signed body; `by` dropped |
| Hardening | Host hooks slowed every save | run after the response |
| Deferred | Fresh deploy exposes an unclaimed `/admin/setup` | optional setup token — Phase 6 checklist |

Found on the way: Nitro's auto-import scanner silently skipped a whole file
because of a `/` inside a template-literal expression (runtime "is not defined").

Deferred: publishing to a registry with Changesets (decide with the name), a
workerd smoke test in CI (needs wrangler in CI), the setup token.

### Phase 5b — Realtime collaboration (like Postyard)

**Stage 1 ✅ (2026-11-13): presence, live updates, overwrite protection.** One
WebSocket per admin tab (`/api/cms/_live`, crossws on the app port). Unlike
Postyard's channels, identity is the signed session checked at the upgrade and
re-checked every 20 s heartbeat (disabled account, password change or role change
drops the socket); the upgrade must come from the site's own origin; watching a
list or entry needs read access (row rules included). Presence and changes cross
replicas through the Redis store; presence entries expire if a replica stops
repeating them.

In the admin: avatars of who else has an entry or global open, a dot for unsaved
changes; a newer version saved elsewhere reloads quietly when nothing is unsaved,
otherwise a notice offers to load it; saves send `X-CMS-Version` and get a 409
with who saved in between — the editor loads the newer version or saves over it.
Lists refresh when their collection changes. Translations keep their own version.

**Independent review** of stage 1 (separate agent): no High findings — socket
auth, origin check, topic access and the version check itself held. Fixed:

| Severity | Finding | Fix |
|---|---|---|
| Medium | First socket on a replica waited for Redis; its first messages were dropped, and with Redis down realtime hung | peers registered at once, replica listening started in the background |
| Medium | A tab's own translation save came back as "someone else's"; translators overwrote each other | translations have their own version, checked on save (409) |
| Medium | Edits typed during a save or a quiet reload could be dropped | edit counter: a save leaves later edits unsaved; reloads fetch first, then decide |
| Medium | "Save mine anyway" re-sent the whole stale form (could unpublish a post published meanwhile) | "Save my changes on top": newest version + only the fields changed in this tab |
| Medium | On Workers a socket cannot be written to from other requests | realtime refused on the edge build; the admin works without it |
| Medium | No keepalive: proxies closed idle sockets, dead sockets lingered as "editing" | ping every 20 s, silent sockets dropped after 65 s, resync after reconnect |
| Low | Messages handled concurrently (editing flag lost on reconnect, topic cap bypassable) | one message at a time per socket; `editing` travels with `watch` |
| Low | Relation-only saves did not change the version; equal versions under clock skew | every save bumps; versions computed in SQL and strictly increasing |
| Low | 409 re-read ignored row rules; emails shown as names | row rule applied; names fall back to the email's local part |
| Low | Watches outlived lost row access; sockets lived forever | row-ruled watches re-checked each heartbeat; sockets re-open every 12 h |
| Low | Conflict only shown at the page top; presence not accessible | toast too; `role=alert`; keyboard-focusable presence with screen-reader text and a pencil badge |
| Low | Socket URL ignored the base URL; stale socket events | both fixed |
| Hardening | Unlimited sockets/messages; log floods while Redis is down | 10 tabs per person, 60 messages / 10 s, throttled logs, timers stopped on shutdown |
| Hardening | Two first saves of a global could both insert | advisory lock per global |

Deferred: `maxPayload` for the socket (Nitro does not expose the `ws` option yet;
messages over 1 KB are ignored after parsing).

**Stage 2 ✅ (2026-11-13): co-editing rich text.** Several people type in the
same text at once, each cursor labelled with its owner's name.

- One Yjs document per entry and language (`post/<id>`, `post/<id>/en`), one shared
  fragment per top-level rich-text field (text inside blocks is edited alone).
  Hocuspocus runs on the app's own port (`/api/cms/_collab/socket`, the raw `ws`
  socket behind the crossws peer, as in Postyard); Redis carries edits between
  replicas.
- The shared document is everyone's working copy; Save stores its content in the
  entry exactly as before (content API, versions, webhooks unchanged). Its state
  lives in `cms_collab`, so replicas and reconnecting browsers share one history. An
  `epoch` names that history: the document starts afresh from the saved entry when
  nobody has it open and the entry was saved some other way, or after a week; a
  browser holding an older history is refused and starts over instead of merging
  stale text back in. Saves made from the document (`X-CMS-Collab`) keep it current.
- Identity: the signed session at the upgrade (same check as `_live`); per document,
  edit rights → write, read rights → read-only (sees the others typing); re-checked
  every 30 s.
- Editors: form state follows the shared text; another person's save now merges
  field by field against what this tab loaded (3-way), so a notice appears only when
  both changed the same field differently. Comparisons ignore key order (Postgres
  reorders jsonb keys — that alone made every shared form look unsaved).
- Not shared yet: globals, rich text inside blocks. A document whose entry was
  changed through the API while people have it open keeps their text; the next save
  from it wins.

**Independent review** of stage 2 (separate agent): live XSS, read-only
enforcement, access mapping and sanitising on save held. Fixed:

| Severity | Finding | Fix |
|---|---|---|
| High | Opening a document took a second pooled connection inside a transaction holding the first: ~10 concurrent opens froze every database request | everything in the transaction goes through it; 5 s lock timeout; the pool gives up after 10 s |
| High | A disabled or demoted account kept a shared-editing socket (re-auth used the identity from the upgrade; listen-only sockets were never re-checked) | the account is read fresh at every authentication; every connection re-checked every 30 s; failures close the whole socket |
| Medium | Saving a translation stored an empty document, hiding the default-language text on the site | empty rich text stays "no value"; the server treats an empty document as untranslated |
| Medium | Stored text the editor cannot hold was seeded empty and wiped on the next save | such fields are edited alone (left out of the shared fields) |
| Medium | A field in a collapsed group counted as shared, so a colleague's save to it was dropped | only fields with a mounted shared editor merge as shared; the save marker is sent only when all are mounted |
| Medium | "Load newer version" and "copy from default language" were silently undone on shared fields | both write through the shared editor, for everyone |
| Medium | A server-side close left a tab typing into nothing | failures close the socket, so the browser reconnects and is authorised afresh |
| Medium | A restarted document could merge with an old copy loaded elsewhere | epoch checked at authentication and load; a stale copy is unloaded; a store that matches no row closes it; times on the database clock |
| Medium | No limits on documents, messages or sockets | 10 documents per socket, 1 MiB per message (2 MiB frames), 8 MiB per document, 10 sockets per person, rate-limited sessions |
| Low | A failed store could unload unsaved text | the error propagates, so the document stays loaded and is stored again |
| Low | Restart counter never reset | reset after each successful sync |
| Low | Stateless messages fanned out from any connection | refused (the admin never sends them) |
| Low | Deleted entries kept their shared text | deleted with the entry or translation; month-old documents purged |
| Low | First connection after boot could miss its handshake | the engine starts with the server |
| Low | Links in shared text could carry any class/target | links render with fixed target/rel and no class |
| Low | Shutdown left Redis clients open | extensions are told to close |
| Low | Everyone's form looked unsaved while one person typed | other people's typing updates the form quietly |
| Hardening | Non-canonical names, messages racing a re-check, listen-only tabs keeping a document "active" | canonical names only, messages wait for a running check, only writers keep it active |

Follow-ups done (2026-11-13): cursor updates are checked on the server (a cursor
carries its account's name; other people's cursors can only be echoed, never moved
or removed); text typed offline that a restarted document cannot take back is
offered back instead of dropped; "Discard changes" in the editor's menu (shared
text goes back for everyone, after a confirmation); site settings share their rich
text too; an optional setup code (`NUXT_CMS_AUTH_SETUP_TOKEN`) guards first-run
setup on a fresh deploy. A form is now "unsaved" exactly when it differs from the
saved version. Still not shared: rich text inside blocks (needs the block list
itself in the shared document — a larger piece).

### Phase 6 — The test client site 🚧 *site built; publishing and deploy wait on the GitHub org and Pushbase credentials*

Proves the package from the outside: **Triathlon Team Tábor**
(triatlon-tabor.cz), built after the club's mockup (home, news, article, desktop
and mobile) in its own repository, `../triatlon-tabor-web`.

- ✅ Own repo, installs `@my-cms/core` and `@my-cms/client` from packed tarballs
  (`vendor/`) — no workspace links. GitHub Packages once the org exists.
- ✅ Czech + English: Czech addresses unprefixed, English under `/en` with English
  words (`/aktuality/…` ↔ `/en/news/…`, `/galerie/…` ↔ `/en/gallery/…`); the
  sitemap lists both with `hreflang`. A third language was not added — the club needs
  two, and nothing in the CMS is two-language specific.
- ✅ Content model: club details, home page (opening, figures, main event of the
  season, about, call to action), news with sections, race facts and photos, the
  calendar (upcoming / past), gallery albums, partners (hand-ordered), pages from
  blocks (text, photo, training schedule, call to action, contacts), menus, redirects.
- ✅ Demo content seeded through the CMS's own API (`pnpm seed`: account, photos with
  alt text in both languages and focal points, 8 articles, 7 events, 3 albums, 4 pages).
- ✅ Light-only site in club red with Barlow Condensed + Inter; the admin keeps its own
  look and the visitor's dark mode.
- ⏳ Deploy to Pushbase (Postgres, Redis, EU bucket, SMTP, custom domain) — needs the
  platform token and the club's bucket and mail account.
- ⏳ Publish the packages to GitHub Packages — needs the org and a `write:packages` token.

**What was awkward, fixed in the CMS** (each with tests):

| Found while building the site | Fix |
|---|---|
| A translated address (`/aktuality/x` vs `/en/news/x`) could not be expressed | `content.path`, `publish.preview` and `definePages({ path })` take one template per language; sitemap, webhooks and preview use it; invalid maps fail at startup |
| "Upcoming events" and "articles from 2025" were impossible on the public API | date ranges (`startsAt.from` / `.to`, a bare date covers the day) and yes/no filters; typed in the client and OpenAPI |
| A perex in a one-line input | `f.text({ multiline: true, max })` — a growing text box with a counter |
| Site settings and the home page had no generated types | typed globals: `GlobalSchema`, `cms.global(name, { locale })`, OpenAPI paths |
| The packed client had no code (its publish config points at `dist/`, never built) | `prepack` builds it |
| The site's typecheck failed inside the CMS (`process`, `Buffer`, `pg` types; route types too deep) | core ships `@types/pg` / `@types/nodemailer`; admin calls with computed addresses use an untyped `cmsFetch`; the consumer check now typechecks |
| The CMS's rich-text styles beat the site's own | defaults are zero-specificity (`:where`) |
| Internal links in rich text opened a new tab | only external links do |

**Independent review** (separate agent, no High findings). Fixed:

| Severity | Finding | Fix |
|---|---|---|
| Medium | Rich-text defaults were unlayered, so they still beat a Tailwind host's utilities | defaults moved to `@layer base` |
| Medium | OpenAPI `CmsGalleryItem` was `allOf` a closed `CmsMedia` → every gallery item failed validation | spelled out as one closed object |
| Medium | A gallery on a related (embedded) item leaked its raw `{ mediaId, caption }` list | embedded projections skip galleries, like media and blocks |
| Low | Date filters accepted anything `Date` parses (`from=1`), extreme years gave a 500, offset-less times used the server's zone | ISO dates/times only, offset-less read as UTC, out-of-range → 400 |
| Low | Preview of a translation whose language has no address fell back to another language's | no preview for that language |
| Low | A gallery over 60 files showed no thumbnails past the 60th | thumbnails load in chunks of 60 |
| Nit | Loose uuid check, `cmsFetch` bound at import, `//host` links treated as internal, `a.from.junk` accepted, `@types/node` pinned to one major | all fixed |

A collection named `global`, `collection` or `openapi` is reachable only through
`client.collection(name)` (documented behaviour, unchanged).

**Noted, not changed:**

- A field without `required` is still required unless `.optional()` — easy to miss
  (the first seed failed on it). Making optional the default changes every existing
  schema; decide with the rename.
- The sitemap lists only collections with an address; a site's fixed pages (`/aktuality`,
  `/zavody-a-akce`) need a hook to be added.
- Content API items do not carry their address in the other language, so the language
  switch on an article goes to the other language's list.
- Admin icons load on first use (a short pop-in in a fresh browser).

## Open decisions

| Decision | Recommendation | Status |
|---|---|---|
| Product name and npm scope | — | to pick (Phase 1) |
| Git remote / CI | GitHub + GitHub Actions | decided |
| Package registry | GitHub Packages (private) or npm | deferred — decide with the name |
| Object storage for production media | EU S3-compatible (Hetzner or R2 EU) | decided — documented in deploying.md, bucket per site |
| Localization storage | `<entity>_locales` table | proposed (Phase 3) |
| Admin UI languages at launch | cs + en | proposed |
