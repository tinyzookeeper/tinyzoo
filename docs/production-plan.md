# Production plan: proof of concept → a CMS clients run on

**Decision (2026-11-13):** take my-cms from proof of concept to something that
runs client sites in production, the way Plaine went from prototype to the tool
the team runs on. Same way of working: one phase at a time, each written down
here, each ending green, each shipped before the next one starts.

**Target:** small and mid-sized clients, mostly Czech and European, many of them
multilingual, nothing that rules out clients elsewhere. Production runs on
**Pushbase** (Node 22 on Kubernetes, managed Postgres + Redis). Cloudflare
Workers stays a supported target (the build already works) but is not the one
we optimise for.

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

### Phase 3 — Content model for real sites

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

### Phase 4 — Editorial experience

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

### Phase 5 — Production operations on Pushbase

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

### Phase 6 — The test client site

Proves the package from the outside.

- Its own repo, installs the published package (no workspace links).
- Multilingual (cs + en, a third locale to prove it scales), pages built
  from blocks, navigation, SEO with `hreflang`, sitemap, redirects.
- Sections designed from Mobbin references, one block = one section type.
- Deployed to Pushbase with Postgres, Redis, EU object storage and a custom
  domain; publish → webhook → page updates.
- Everything that was awkward while building it becomes an issue against the
  CMS before calling it done.

## Open decisions

| Decision | Recommendation | Status |
|---|---|---|
| Product name and npm scope | — | to pick (Phase 1) |
| Git remote / CI | GitHub + GitHub Actions | decided |
| Package registry | GitHub Packages (private) or npm | to confirm (Phase 5) |
| Object storage for production media | EU S3-compatible (Hetzner or R2 EU) | to confirm (Phase 5) |
| Localization storage | `<entity>_locales` table | proposed (Phase 3) |
| Admin UI languages at launch | cs + en | proposed |
