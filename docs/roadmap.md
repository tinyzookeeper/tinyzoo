# Roadmap: from the pilot (0.x) to 1.0

**Decision (2026-11-16):** before tinyzoo runs a real client site, a site on one
version must be able to move to the next one without losing content, and a
breaking change must come with a way through it. Then the pilot ships as **0.2**,
and **1.0** follows with a stability promise.

This plan follows `production-plan.md` and `pilot-plan.md` (both done or folded in
here). Same way of working: waves of slices, each slice on its own branch, each
wave ends green (`pnpm check`) and is written up under its heading, with an
independent review before anything touching auth, access or the public API is
merged.

Sizes: **S** ≤ 1 day · **M** 2–4 days · **L** 1–2 weeks.

## Decisions locked for 0.2

| Decision | Choice |
|---|---|
| Table names | **snake_case** (`site_settings`, `site_settings_locales`, enums too). Columns already are. One rename migration for every existing database. |
| Fields required by default | **Kept.** `f.text()` is required, `.optional()` opts out. A missing value gets a clearer error instead. |
| Node | **`engines: { node: ">=22" }`** (Pushbase runs 22; development 24). |
| Registry | **npm**, packages `tinyzoo` and `@tinyzoo/client`. The npm org and token come from Vojtěch. |
| Staging | **Pushbase**, access from Vojtěch. |

## Why upgrades come first

Found while checking how a site moves from one tinyzoo version to the next
(2026-11-16):

| Gap | Example |
|---|---|
| Data steps of an upgrade are not shipped with the package | `cms_media.in_library` needed `UPDATE cms_media SET in_library = true`; `tinyzoo generate` produces only the `ALTER TABLE`. The backfill was typed by hand into the playground and the Tábor site. A site that forgot it would delete library files when an image is removed from rich text. |
| Data loss the migration tool allows without a warning | Renaming a field (drizzle-kit asks; the wrong answer drops the column), removing `.localized()` (the translations column is dropped). Nothing warns before a `DROP`. (Making a field `.localized()` is safe: the default language stays in the entry's own row.) |
| JSON inside columns has no migrations | Blocks are checked with `z.object`, which strips unknown keys: renaming a block field drops the old values on the next save; removing a block type or adding a required block field makes old entries unsaveable. Saved versions in `cms_revisions` keep old shapes. |
| Migrations skipped silently | `applyMigrations` skips any migration older than the last applied one (drizzle's rule). Two branches → one migration never runs. |
| Rolling deploys | Migrations run at start while the old version still serves; a dropped column breaks it during the rollout. |
| No release process | 0.1.0, vendored `.tgz`, no changelog, no deprecations. |
| The content API is an unguarded contract | Site frontends depend on its shape; nothing flags a change. |

---

## 0.2: the pilot

### Wave 0: a clean base (sequential)

| # | Slice | Size |
|---|---|---|
| 0.1 | `pnpm check` green, then commit the search work and the website (uncommitted since 2026-11-16 morning). | S |
| 0.2 | **snake_case table names** and `engines >=22`. Emitter, runtime tables, locales tables, junctions and enum names; every raw-SQL use of a table name. A rename migration (`ALTER TABLE … RENAME`, constraints and indexes renamed, no data touched) for the playground, the website and the Tábor site; the starter's migrations squashed into a fresh `0000` (no sites made from it exist). | M |

### Wave 1: upgrades and operations (parallel)

**A. Upgrade machinery (L)**
- *Upgrade steps* shipped in the package: versioned, idempotent steps (SQL or a
  function) with an id, the tinyzoo version that introduced them and a
  description, recorded in a new `cms_upgrades` table and run after the site's
  migrations, in the same lock: at start (`NUXT_CMS_MIGRATIONS_ON_START`) and by
  `tinyzoo up`. The pg_trgm special case becomes a step.
- *Order guard*: an unapplied migration older than the last applied one stops
  the start with a clear error (instead of being skipped).
- *Breaking-statement guard*: `tinyzoo generate` lists every `DROP`, `RENAME` and
  type change in the new migration and refuses to keep it without `--allow-drop`
  (or an interactive yes), naming the two-step alternative.
- *Non-interactive generate*: in CI (no terminal) drizzle-kit's rename question
  can't be answered; `tinyzoo generate` says so and points at the rename recipe
  in `docs/upgrading.md` instead of hanging.
- `tinyzoo upgrade`: peer versions → regenerate the schema → generate the
  migration → list pending upgrade steps and migrations → regenerate the typed
  client. `tinyzoo status`: what the database has and hasn't applied.
- `docs/upgrading.md`: the version policy, the two-step rule for breaking
  schema changes, what a site does on each upgrade, and how the package authors
  write an upgrade step.

**B. Releases and contracts (M)**
- Changesets for both packages, a `CHANGELOG.md` per package with an
  **Upgrade** section whenever a site must do something, a GitHub Actions
  release workflow publishing to npm with provenance (`NPM_TOKEN` secret).
- Version policy in code: `cmsDeprecated(id, message)` warns once per process;
  `@deprecated` JSDoc on the API; deprecated options kept one minor.
- *Contract snapshots*: the playground's OpenAPI document and generated client
  types as committed golden files; a unit test fails on any difference, and the
  changeset says whether it's breaking.
- Sites install from the registry: the Tábor site's `vendor/*.tgz` replaced by a
  version range once 0.2 is out (the switch is done in Wave 3).

**C. Versioned JSON content (M)**
- `defineBlock(name, { version, upgrade })` and the same for `f.list`: stored
  items carry their version; older items run through `upgrade` when read (content
  API, admin, search index, revision restore), so nothing has to be rewritten on
  deploy.
- Unknown block types are kept, shown in the admin as "This block no longer
  exists" with a remove button, and skipped by the content API, instead of
  blocking the save.
- `tinyzoo content:migrate` rewrites stored JSON to the current versions (and
  reports what it couldn't).

**D. Operations and privacy (M)**
- *Setup code always on in production*: `NUXT_CMS_AUTH_SETUP_TOKEN` exists but
  is optional, so a fresh deploy without it can be claimed by anyone. In
  production without it, the app makes a one-time setup code and prints it in
  the log while no account exists; `/admin/setup` asks for it.
- *Backup and restore*: `docs/deploying.md` recipe plus `tinyzoo backup` /
  `tinyzoo restore` (pg_dump/pg_restore and the bucket), and a backup before
  migrations when `NUXT_CMS_BACKUP_BEFORE_MIGRATE` points somewhere.
- *Error reporting*: a `cms:error` hook with request id and context, documented
  with a Sentry example; nothing vendor-specific in the package.
- *Privacy (GDPR)*: retention for form submissions and the audit log (config,
  enforced by a scheduled task), and for one email address: export everything
  stored about that person, or delete it, from the admin.

**E. Content between environments (M)**
- `tinyzoo export <file>` and `tinyzoo import <file>`: entries with their
  translations, relations, globals, menus and media files, in one archive that
  records the tinyzoo version and the config's fingerprint. Import into an empty
  or matching database, upgrade steps applied to older archives. Also the
  escape hatch when a migration goes wrong.

### Wave 2: what the pilot site needs (parallel)

| Slice | What | Size |
|---|---|---|
| F | `f.group({ fields })`; **links that follow their target**: a picked page or entry stored as a reference (entity, id) plus its address, resolved on read in every language, so renaming a page no longer breaks menus and links | M |
| G | **Page tree**: pages with a parent, nested addresses (`/o-nas/tym`), breadcrumbs in the content API, a tree view in the admin; a sitemap hook for a site's fixed pages | M |
| H | **Plugin API**: `defineCmsPlugin({ entities, singletons, adminPages, navItems, fields, serverHooks, i18n, upgrades })`, Forms moved onto it as the first plugin, plugin upgrade steps through A | L |
| I | **Seeding**: `tinyzoo seed` from a typed seed file (the way the Tábor site seeds through the API today); the starter gets demo content | M |
| U | **Upgrade test in CI**: start from the starter at a given git ref, seed it, then install the current build, `tinyzoo upgrade`, migrate, and run the API smoke tests. Runs on every pull request against the last release tag | M |

### Wave 3: ship 0.2

| Slice | What | Size |
|---|---|---|
| J | Docs: getting started (starter → first entity → deploy), recipes for the ten common requests, the editors' manual in Czech, the upgrade guide checked against a real upgrade | M |
| K | Release 0.2.0 to npm; the Tábor site on the registry version; a staging site on Pushbase with a backup **and a tried restore**; upgrade test against the 0.2.0 tag from then on | M |
| L | Final audit (Track C of the pilot plan): six auditors, a verify pass, all High and Medium fixed, failed scenarios re-run | M |

**0.2 is done when:** the pilot can be built from the docs alone, the staging site
survived an upgrade and a restore, and the audit has no open High or Medium.

---

## 1.0: the stability promise

From 1.0 the **content API, the `@tinyzoo/client` types and the config API**
(`defineEntity`, `f.*`, presets, plugins) follow semver: a breaking change waits
for 2.0, and anything removed was deprecated for at least one minor first.

### Wave 4 (parallel)

| Slice | What | Size |
|---|---|---|
| M | **Custom roles and per-field permissions**: roles defined in config on top of admin/editor/author; per field `read`/`edit` by role; media access per role | L |
| N | **Per-language publishing**: each translation has its own state and schedule; the content API and webhooks follow it | M |
| O | **`pnpm create tinyzoo`**: a `create-tinyzoo` package wrapping `tinyzoo init` with questions (languages, which presets, demo content) | S |
| P | **API review before the freeze**: list the public surface of each API, remove what's deprecated, mark internals as internal, typed-config golden tests | M |

### Wave 5: ship 1.0

| Slice | What | Size |
|---|---|---|
| Q | Docs on the tinyzoo website (cs/en/de): guides, API reference from the OpenAPI document, the plugin API, upgrading | L |
| R | Final audit (as L), security review of M and N, upgrade test 0.2 → 1.0 | M |
| S | Release 1.0.0; the pilot and the Tábor site upgraded to it | S |

**1.0 is done when:** a site goes from 0.2 to 1.0 by following `docs/upgrading.md`,
and the audit has no open High or Medium.

---

## How the work is run

- One branch per slice (`feat/0.2-<slice>`), made by a separate agent in its own
  worktree, with its own databases (`cms_<slice>`, `TEST_DATABASE_URL=…/cms_test_<slice>`),
  so parallel slices never share data.
- Schema changes in parallel slices collide in the drizzle journal: a slice
  keeps its migration, and at merge time it is regenerated on top of `main`.
- Each slice ends with `pnpm check` green and a short write-up appended to its
  heading below.
- Each wave ends with an independent review of the merged diff; findings are
  fixed before the next wave starts.

## Progress

_Write-ups land here as slices merge._

### 0.2 D — Operations and privacy

Branch `feat/0.2-ops`. `pnpm check` green: 46 test files passed, 1 skipped; 416 tests
passed, 3 skipped (the skips were already there).

**Setup code.** In production without `NUXT_CMS_AUTH_SETUP_TOKEN`, first-run setup needs
a generated code: 16 characters from a 32-letter alphabet without look-alikes (80 bits,
`XXXX-XXXX-XXXX-XXXX`). It is stored as a SHA-256 hash in `cms_state` (key `setup_code`),
written insert-if-absent so replicas share it; only the instance that wrote it prints
`No administrator yet. Setup code: … — open <publicUrl>/admin/setup`. A start with no
account and a code older than five minutes replaces it and prints the new one (a younger
one is left alone, so a rolling deploy does not invalidate the printed code). The code is
deleted in the setup transaction. A wrong code gives 403 and an `auth.setup_failed`
audit entry; once an account exists setup answers 409. The status endpoint tells the page
where to look (`codeIn: 'config' | 'log'`, present only while setup is open), and the
setup page always shows the field and explains it. A configured token still wins.
"Production" means a built server unless `NODE_ENV` is `development`/`test`, so an unset
`NODE_ENV` does not leave a deploy open (slightly wider than "NODE_ENV=production").

**Backup and restore** (`cli/backup.ts`). One tar: `manifest.json`, `database.dump`
(`pg_dump --format=custom`, written from stdout, connection through `PG*` variables so
the password never shows in `ps`) and `media/<key>` for every `cms_media` row, read from
the local folder or from the bucket with aws4fetch (path-style, as the app's S3 driver).
Resized copies (`_w/…`) are left out; missing files are listed in the manifest. The
archive is mode 0600. Restore validates the archive (manifest, every media path inside
the folder, every listed file present) before touching anything, refuses a database with
accounts unless `--force`, asks you to type the database name unless `--yes`, runs
`pg_restore --clean --if-exists --no-owner --no-acl --no-comments`, then writes the
media. `TINYZOO_PG_DUMP` / `TINYZOO_PG_RESTORE` select other binaries (used to run the
tests through Docker here; also a documented escape hatch). `docs/deploying.md` has the
"Backups and restore" section with the responsibility table and the restore drill.
*Deviation:* no `NUXT_CMS_BACKUP_BEFORE_MIGRATE`. A dump from inside the server needs
`pg_dump` in the image and somewhere to write, and a failure would force a decision
about starting the new version anyway; the docs say to run `tinyzoo backup` before a
deploy that changes the schema.

**Error reporting.** `cms:error` (typed in `NitroRuntimeHooks`, `CmsErrorReport` exported
from `tinyzoo`) fires for the same 5xx the JSON log line covers, for scheduled tasks that
threw (`cms:scheduled`, `cms:retention`, `cms:search-reindex`, with `source: 'task'`) and
for webhook deliveries that gave up (`source: 'webhook'`, URL without query). It runs on
the next tick, never awaited by the request, and a throwing hook is logged only. Reports
carry `message` without query values (drizzle's "Failed query" text includes bound
values); the docs say so and show a Sentry plugin. The playground has a test-only sink
plugin (`CMS_ERROR_SINK_FILE`) the specs read.

**Retention.** `defineForm(name, { retentionDays })` (positive integer; default keep),
`cms.retention.auditDays` (365, 0 = keep; env `NUXT_CMS_RETENTION_AUDIT_DAYS`). Task
`cms:retention`, daily 03:17 (`CMS_RETENTION_CRON` at build time), one instance at a time
(advisory lock 72011040), batches of 500, deletes submissions together with their saved
versions, search rows and shared-editing documents, and writes `retention.purge` with
counts only. The admin shows "Messages are deleted automatically after N days" under the
form's list (cs/en/de). The playground's contact form uses 180 days.

**One person's data.** Settings → Privacy (admin only), `POST /api/cms/_privacy/{lookup,
export,delete}` (email in the body, not the URL; rate limited per administrator and per
IP: 60 reads / 10 deletes per 10 minutes; `privacy.export` / `privacy.delete` audited
with counts, never the address). Matching: form text fields with `format: 'email'`,
lower-cased and trimmed, exact; the account with that email; audit entries made by the
account, about it (`user.*` on its id) or whose `meta.email` is the address. Export is a
JSON download without password hashes. Delete removes the submissions (with versions,
search rows), **anonymises** the account (address becomes
`deleted-<id>@anonymised.invalid`, name/language/last sign-in/password cleared, role
`author`, disabled, sessions revoked, invitation and reset links deleted) and strips
`email`, `ip` and `name` from the audit entries touching the person. Why anonymise
instead of delete: entries, revisions, uploads and the audit trail refer to the account
by id; deleting the row would orphan that history, anonymising removes every personal
detail and keeps who-did-what. It refuses your own account (409) and goes through the same
last-administrator guard as Team; because the asker is always another active
administrator, that guard cannot be tripped through the API, so it is not tested
separately. Not covered, and said so in the docs: text editors wrote into entries, their
uploads, and backups. `docs/deploying.md` lists what a privacy policy should say.

**Other changes.** `test/setup/database.ts` accepts test database names with a `test`
word anywhere (`cms_test_ops`; it required a `_test` suffix). `test/helpers/server.ts`
starts extra instances of the built playground on scratch databases (setup-code and
error-hook specs). Lock numbers 72011040 (retention). The API specs do not run the backup
spec without `pg_dump`/`pg_restore` (or the two env variables).

**Left.** The admin pages (Privacy, the retention line, the setup hint) type-check,
render, and have their strings in all three languages, but I did not click through them
in a browser. Whether CI's runner has `pg_dump`/`pg_restore` of the server's version is unchecked: if not, the backup spec skips
itself there.
