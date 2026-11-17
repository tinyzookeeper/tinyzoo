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
| V | **Visual pass and log privacy**: the Wave 1 screens nobody has looked at (block cards, the editor's refusals, Privacy, retention line, setup code) at phone and desktop, light and dark, cs/en; Nitro's own error log without query parameters | S |

### Wave 3: ship 0.2

| Slice | What | Size |
|---|---|---|
| J | Docs: getting started (starter → first entity → deploy), recipes for the ten common requests, the editors' manual in Czech, the upgrade guide checked against a real upgrade | M |
| K | Release 0.2.0 to npm; the Tábor site on the registry version; a staging site on Pushbase with a backup **and a tried restore**; upgrade test against the 0.2.0 tag from then on | M |
| L | Final audit (Track C of the pilot plan): six auditors, a verify pass, all High and Medium fixed, failed scenarios re-run | M |

**Deploy order once the 0.2 work is merged** (set by Vojtěch, 2026-11-16; this is
slice K's staging part):

1. The private-file change in tinyzoo.
2. Provision storage (buckets) for both Pushbase projects: the tinyzoo website
   and the demo.
3. Link the storage and set the driver (`NUXT_CMS_STORAGE_DRIVER=s3` and the
   bucket variables, see `docs/deploying.md`).
4. Deploy both from `main`.
5. Seed the website (its admin account already exists), then set up and seed
   the demo.

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

#### Decisions locked for Wave 4 (2026-11-17)

| Decision | Choice |
|---|---|
| Role model (M) | A custom role **extends a built-in** (`from: 'editor'` or `'author'`) and narrows it or adds grants per entity (`read`/`create`/`update`/`delete`), plus `publish` and `media: 'all' \| 'own' \| 'none'`. Only `admin` manages people; a custom role can never become one. Per field: `read`/`edit` by role. |
| Role removed from config (M) | **Fails closed**: the account signs in to a "your role no longer exists, ask an administrator" screen with no access; the Team page flags it and `tinyzoo status` warns. |
| Per-language publishing (N) | **Opt-in per entity** (`publish: { perLocale: true }`). A translation's state is nullable and `null` follows the default language, so turning it on changes nothing on the website by itself and needs no data step (amended at implementation: a copy could not cover entries without a translation row, which are served through fallback). Not for page trees yet. |
| A translation that is not published (N) | **Not there in that language**: `404` for the item, left out of that language's lists, sitemap and `hreflang`; webhooks report the language. Per-field fallback to the default language stays, inside a published translation only. **The default language gates** (decided after review A, 2026-11-17): a translation is live only while the default language is live too; unpublishing the default language takes every language off, and a language can still be unpublished on its own. A translation of a draft would show the draft's shared fields and fallback text. |
| What 1.0 freezes (P) | Besides the content API, the `@tinyzoo/client` types and the config API: the **webhook payload and Nitro hooks**, the **CLI commands and flags, `cms.*` module options and `NUXT_CMS_*` variables**, and the **admin extension points** (`cms.fields` in `app.config`, the component names it resolves, their props). Everything else is marked `@internal`. Database tables are not promised: tinyzoo migrates them, with an upgrade step. |
| `cms` naming (P) | **Kept** (`cms.config.ts`, `NUXT_CMS_*`, `cms_*`, `Cms*`, `cms` in `nuxt.config`). |
| Releases | 0.5.0 released before the wave; **Wave 4 ships as 0.6.0**, the last minor before 1.0 (P's removals land there). |
| `create-tinyzoo` (O) | Unscoped `create-tinyzoo` (`pnpm create tinyzoo`). Vojtěch publishes a `0.0.0` placeholder by hand once, then ticks the trusted publisher on npmjs.com; releases go through the workflow after that. |

Every schema or behaviour change in the wave comes with an upgrade step (where data
must move) and a changeset whose **Upgrade** section says what a site has to do.
Branches `feat/1.0-<slice>`, test databases with `test` in their names.

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

### 0.2 — snake_case table names

Every SQL identifier the CMS derives from an entity name is now `snake(name)`:
the table (`site_settings`), its translations table and that table's index names
(`site_settings_locales`, `site_settings_locales_parent_locale_unique`,
`…_<field>_unique`), generated junctions (`blog_post_to_post_tag`) and pg enums
(`contact_form_status`). A relation's `through` name is used exactly as given.
Everything that is not SQL keeps the entity name: API paths, the graph, the
`entity` column of `cms_search` / `cms_revisions` / `cms_audit`, the schema keys and
the camelCase TS export names in the emitted `schema.ts` (`export const siteSettings
= pgTable('site_settings', …)`). The `Junction` descriptor gained `tableName`
(`name` stays the schema key). `cmsCrud`'s unique-violation mapping matches the new
constraint names. `engines: { node: ">=22" }` is set on `tinyzoo`, `@tinyzoo/client`
and the starter.

Migrations (renames only, no row is touched; each has a snapshot generated from a
fresh migration of the new schema, so `drizzle-kit generate` reports no changes):

| Host | Migration | Renames |
|---|---|---|
| playground | `0018_snake_case_tables` | 3 tables, 2 enums, 3 primary keys, 3 foreign keys |
| site | `0004_snake_case_tables` | 3 tables, 3 primary keys, 1 foreign key, 1 index |
| starter | squashed to one `0000_init` (with `CREATE EXTENSION pg_trgm`) | – |
| Tábor site | none needed | every entity name is already lowercase |

Verified against Postgres: the old migrations (playground 0000–0017, site 0000–0003)
applied to a scratch database, rows inserted into every renamed table (including a
translation row, a junction row and enum values), the new migration applied, and all
rows, foreign keys, enum values and unique indexes were intact. The catalog of
table, index, constraint and enum names after the migration equalled that of a
database built from a fresh migration of the new schema.

Traded off / to know:
- The Tábor site (`feat/snake-case-tables` in its repo) only gets the repacked
  packages. Its schema has no camelCase names, so nothing is renamed; its next
  `tinyzoo generate` will still offer the unrelated migration for `cms_search`
  (the search work), as any upgrade does.
- A site that has camelCase entities and a relation without `through` gets its
  junction renamed (`blogPost_to_tag` → `blog_post_to_tag`) by its own generated
  migration; the two hosts here have none, so that path is covered by a unit test
  of the names (`test/unit/table-names.spec.ts`), not by a database run.
- drizzle-kit would turn such a rename into a drop and create. Hand-write the
  `ALTER … RENAME` statements as in `0018_snake_case_tables.sql`; the future
  upgrade machinery (Wave 1 A) should do this for the site.
- The test database name must end in `_test` (`TEST_DATABASE_URL=…/cms_tables_test`).

### 0.2 B — Releases and contracts

Branch `feat/0.2-release`. What landed:

- **Changesets** (`@changesets/cli` 3) for `tinyzoo` and `@tinyzoo/client`, versioned
  together (`fixed`); `playground`, `tinyzoo-web` and `tinyzoo-starter` are ignored.
  The changelog format (`.changeset/changelog.cjs`) keeps Changesets' grouping by
  bump (Major / Minor / Patch) and turns a changeset's `### Upgrade` section into
  a bold **Upgrade** block under its entry. Both packages have a seeded
  `CHANGELOG.md` (0.1.0), and two changesets for what is already merged: search,
  and the snake_case table rename (an Upgrade note that describes the companion
  slice; the file says so in a comment and must be checked against what that slice
  generates, or deleted). `pnpm changeset version` was run on a copy of the tree:
  both packages go to 0.2.0, the lockfile stays valid (`--frozen-lockfile`).
- **Convention** in `CONTRIBUTING.md`: a changeset for every change to a package,
  `### Upgrade` with exact steps when a site must act, a breaking change is a minor
  bump on 0.x (major from 1.0), the deprecation policy, the contract rule, and the
  release flow. CI has a `changeset` job that fails a pull request that changes a
  package without one (skipped for the release pull request).
- **Release workflow** (`.github/workflows/release.yml`): on push to `main`,
  `changesets/action` opens or updates the "Version packages" pull request; when it
  is merged, `pnpm release` (`scripts/release.mjs`) skips when both versions are
  already on npm, otherwise builds `@tinyzoo/client` (`dist` by unbuild), runs the
  consumer check on the packed tarballs of both packages, and publishes with
  `changeset publish` (pnpm per package, provenance through
  `NPM_CONFIG_PROVENANCE=true` and `id-token: write`, token from the `NPM_TOKEN`
  secret, git tags and GitHub releases from the action). `tinyzoo` needs no build
  step: it ships TypeScript source, the Nuxt layer and the CLI (run by `tsx`).
  `pnpm release:dry-run` does the same steps with `pnpm publish -r --dry-run`.
- **Package metadata**: `license`, `repository` (with `directory`), `homepage`,
  `bugs`, `keywords`, `publishConfig.access: public`, `engines.node >=22` on
  `tinyzoo`; peer ranges raised to what the lockfile and CI test (`nuxt ^4.4`,
  `@nuxt/ui ^4.9`, `nuxt-auth-utils ^0.5.29`, `@internationalized/date ^3.12.2`).
- **Deprecations**: `cmsDeprecated(id, message, { removeIn })` in
  `packages/cms/src/deprecate.ts`, exported from `tinyzoo` with `cmsDeprecations()`
  and `resetCmsDeprecations()`. One `[tinyzoo] deprecated: …` per id and process;
  silent under `NODE_ENV=test` unless `TINYZOO_DEPRECATIONS=1` (`0` silences it
  always); always recorded.
- **Contract snapshots** in `test/contracts/`: `openapi.playground.json` and
  `client-types.playground.ts`. `test/unit/contracts.spec.ts` fails with the
  differing lines and `pnpm contracts:update` (same test, `UPDATE_CONTRACTS=1`).
  The admin graph is internal and has no snapshot.

Tarballs (`pnpm pack`, 0.1.0 as it stands):

| Package | Files | Size | Contents |
|---|---|---|---|
| `@tinyzoo/client` | 6 | 6 kB | `package.json` (with `publishConfig` exports applied: `dist` entries), `README.md`, `dist/index.mjs`, `dist/index.d.ts`, `dist/index.d.mts`, `src/index.ts` |
| `tinyzoo` | 304 | 369 kB | `package.json`, `module.ts`, `nuxt.config.ts`, `cli/index.ts`, `src/` (20), `shared/` (2), `server/` (108), `app/` (139: components, pages, composables, layouts, i18n, assets, brand SVGs), `starter/` (31: the site template with its migrations, `gitignore.txt`, `.env.example`; no `node_modules`, `.nuxt` or `.output`) |

No tests, `node_modules`, `.nuxt`, `.output`, source maps or `.DS_Store` are in either.

Left for the owner (see the hand-off): the npm organisation and token, the GitHub
repository and its settings, the licence, and switching the Tábor site from
`vendor/*.tgz` to a version range (Wave 3).
### 0.2 A — Upgrade machinery

Branch `feat/0.2-upgrades`. Guide for site developers: [upgrading.md](upgrading.md).

- **Upgrade steps** (`packages/cms/src/upgrades.ts`): versioned, idempotent steps
  (`id`, `since`, `description`, `phase: 'before' | 'after'`, optional `when` and
  `freshInstall`), recorded in `cms_upgrades`. The runner creates that table itself
  and it is *not* emitted into host schemas (it must exist before the first host
  migration; a host dropping it would re-run every step). They run inside
  `applyMigrations`' transaction and advisory lock (`runUpgrade` also returns which
  steps ran); the step list is a parameter, so plugins (slice H) can add theirs. On
  an empty database steps are recorded without running unless `freshInstall: 'run'`.
  A step with `when` runs whenever the condition holds (idempotent), otherwise once.
  The pg_trgm special case is now the `enable-pg-trgm` step; the CLI still prepends
  `CREATE EXTENSION` to new migration files.
- **Same runner everywhere:** the app's start-up migration and `tinyzoo up` (now via
  `pg`, `DATABASE_URL` from the environment or `.env`; no longer `drizzle-kit migrate`).
- **Order guard:** an unapplied journal entry whose `when` is older than the newest
  applied `created_at` stops the run with `MigrationOrderError` (file, snapshot and
  journal entry to delete, then `tinyzoo generate` again; the message also says that a
  migration that already ran elsewhere needs its regenerated SQL made idempotent, and
  upgrading.md has the checklist step "run `tinyzoo status` against production first").
  Matched by `created_at`,
  not hash.
- **Breaking-statement guard** in `tinyzoo generate` (`cli/breaking.ts`,
  `cli/generate.ts`): `DROP TABLE/COLUMN/TYPE`, type changes and table, column and type
  renames are listed in plain words; a terminal gets a y/N question, CI (or N)
  removes the migration, its snapshot and journal entry (journal restored byte for
  byte) and exits 1; `--allow-drop` skips the question. Without a terminal,
  drizzle-kit's rename question is detected (it prints "Interactive prompts require a
  TTY" and exits 0) and `generate` fails with a pointer to the rename recipe.
- **`tinyzoo status`** (exit 0 up to date, 1 pending or out of order, 2 unreachable)
  and **`tinyzoo upgrade`** (versions of nuxt, @nuxt/ui, drizzle-orm, zod → generate →
  typed client when a `cms:client` script exists → status → next steps).
- **Docs:** `docs/upgrading.md` (version policy, every-upgrade routine, two-step
  rule, recipes, reading `status`, writing a step); `deploying.md` and the README
  point at it.
- **Tests:** step runner (ordering, fresh install, idempotency, `when`, same
  transaction and lock, rollback, a database migrated by drizzle's own migrator picking
  up the bookkeeping), order guard, status, statement scanner, generate guard, version
  ranges, and an API spec that the server's first start adds `cms_upgrades`.
- **Second class, "may fail on existing rows"** (review fix): `ADD COLUMN … NOT NULL`
  without a default (a default, an identity or a serial counts as one), `SET NOT NULL`,
  a new `UNIQUE` constraint or unique index, a new `CHECK`; tables the same migration
  creates are skipped, and a unique index re-created under a renamed table's new name
  (the snake_case upgrade) is not flagged. Kept with `--allow-risky`, separate from
  `--allow-drop` (a migration with both needs both). Tests copy the SQL drizzle-kit
  0.31.10 wrote; upgrading.md has "Adding a required field", the `drizzle-kit push`
  warning and the rewritten out-of-order section.
- **Not done / left:** the changelog **Upgrade** sections arrive with slice B; the
  backups link in upgrading.md waits for slice D's recipe. The migrations folder is
  fixed at `server/db/migrations` for the CLI, as it was for `generate`.

### 0.2 C — Versioned JSON content

Branch `feat/0.2-json-versions`. No schema change: everything lives inside jsonb.

- **Versions and upgrades.** `defineBlock({ version, upgrade })` and `f.list({ version, upgrade })`.
  `upgrade(data, fromVersion)` moves a stored block one version up and is called once
  per step (1 → 2 → 3). Stored blocks carry `v`, left out at version 1, so existing data
  needs no rewrite. `upgradeBlocks` / `upgradeListItems` / `upgradeStoredRow` (`src/blocks.ts`)
  are pure; `upgradeStoredJson` (`server/utils/cmsBlocks.ts`) is the one wrapper every read
  goes through: the content API (`populateItems`, incl. populated relation targets), the admin's
  `hydrateRowForForm`, translation rows for the form, the search index (`documentOf`), revision
  recording, comparison and restore (`revisions/[rev].get`), and singletons (same two paths).
  Writes upgrade a block that says it is behind, validate it, and stamp the current `v`.
  On a write a missing `v` means "the current version" (the content API output carries none);
  a `v` newer than the code is a 422.
- **Failures are contained.** An `upgrade` that throws is logged once (entity, record, block id),
  the content API serves the block as stored, the admin gets it flagged (`__upgradeFailed`) and
  shows a "could not be brought up to date" card with Remove; a save keeps it untouched.
- **Unknown block types are kept.** `blocksSchema` passes a block with an unknown `type` through
  (it still needs a string `id` and `type`); the editor shows "This block no longer exists (type)"
  with Remove (cs/en/de); the content API and the search leave it out. `mediaIdsInBlocks` scans every
  id inside such a block (and inside blocks stored at an older shape), so files are neither deleted
  under it nor leaked once it is removed. Lists have no types, so nothing special there.
- **Unknown keys.** Editor values keep Zod's stripping. A block that went through `upgrade` is
  validated strictly (a forgotten rename is a 422 / a failing test). In development a stored block with
  keys the definition does not know logs a warning naming the block and keys and pointing at
  `version`/`upgrade` (once per type and keys; silent in production).
- **`tinyzoo content:migrate [--dry-run] [--batch n]`** (`cli/content-migrate.ts`, one `case` in
  `cli/index.ts`): walks every entity's blocks/list/rich-text columns through the registry (entries,
  `_locales` tables, `cms_revisions.data`), keyset-paged, one transaction per batch with row locks,
  `updatedAt` untouched, reports rows and blocks per entity/field and every block it could not upgrade
  (left as stored; exit 1). Core is `migrateContent(db, reg, opts)`, exported for tests.
- **Rich text.** `richTextUpgrades` / `upgradeRichText` in `src/richtext.ts`: an empty list of idempotent
  steps applied on read and by `content:migrate`.
- **Playground.** The `cta` block is at version 2 (tidies a stored button label and link), with the same
  public shape, so no migration, contract or client change.
- **Tests.** `test/unit/block-versions.spec.ts` (chains, absent `v`, purity, unknown types, throwing
  upgrade, strict validation, lists, rich text, dev warning, server wrapper) and
  `test/api/block-versions.spec.ts` (content API, admin, write path, history, translation, search, unknown
  blocks and their media, `content:migrate` dry run / real run / failure report / the real command).
  Two existing assertions changed: an unknown block type used to be rejected, now it is kept.
- **Not done / for later.** No admin visual check of the two new cards (the shared browser was busy);
  a `version` bump does not by itself invalidate the search index (it reads upgraded data anyway);
  `content:migrate` does not take a lock against concurrent deploys (row locks per batch only).
### 0.2 E — Content export and import

`tinyzoo export <file>` and `tinyzoo import <file>` (branch `feat/0.2-export-import`;
`packages/cms/cli/{export,import,transfer,tar}.ts`, README section *Content between
environments*).

- **Archive (format 1):** one `.tar.gz` — `manifest.json` (format, tinyzoo version,
  time, fingerprint, the content model's shape, languages, entities with counts, what
  was left out), `content/<entity>.jsonl` (an entry per line, keyed by field names,
  with translations, many-to-many ids and `createdAt`/`updatedAt`), `globals/<name>.json`,
  `media.jsonl` + `media/<key>` (with sha256), `revisions.jsonl` on request. No
  dependency: a small tar writer/reader (streams files; tested against system `tar`).
  Not exported: accounts, tokens, sessions, audit, collab state, search index; who
  created an entry is dropped; form submissions (personal data) only with
  `--with-submissions`; revisions with `--with-revisions`.
- **Export:** one `REPEATABLE READ`, read-only transaction; keyset-paged reads written
  straight to disk, media read through the storage driver one file at a time;
  `--only`, `--no-media`, `--force`; written to `<file>.partial` and renamed.
- **Import:** strict (target must hold no content) / `--replace` (confirmation, `--yes`;
  deletes in reverse dependency order in the same transaction) / `--merge` (upsert by id,
  a many-to-many field takes the archive's list, a global's other rows go);
  fingerprint/format/default-language checks with a difference list and `--allow-mismatch`;
  dependency order with *deferred* links (self references and optional cycles are filled
  in afterwards; a required cycle is an error); media uploaded (hash-checked) before the
  transaction, media `url`s and pictures embedded in rich text re-pointed at the target
  storage; search index rebuilt with the server's own `rebuildSearchIndex`;
  `--dry-run`, `--no-search-index`. `// upgradeBlocks hook:` marks where imported
  block/list JSON will be upgraded, and the manifest reader marks where older archive
  formats will be.
- **Tests:** `test/unit/transfer.spec.ts` (two real databases from the playground
  migrations, plus a self-referencing `category` table; the CLI is spawned once).

Decisions worth knowing: `--replace` leaves the old media *files* in storage (the bucket
may be shared with another environment); a partial (`--only`) archive is compared only on
the entities it carries and, with FKs to entities it lacks, needs `--merge` into a target
that has them; a global counts as content once saved (its row exists), so it makes a
target non-empty. `cmsSearch.ts` now imports `mergeTranslation` explicitly (it relied on
Nitro's auto-import, which does not exist in the CLI).
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
the folder, every listed file present) before touching anything, refuses a non-empty
database (any table, or any applied migration) unless `--force`, asks you to type the
database name unless `--yes`, then drops and recreates the `public` and `drizzle`
schemas and runs `pg_restore --single-transaction --exit-on-error --no-owner --no-acl
--no-comments` (changed after the wave review: `--clean` alone left an upgraded
database half-restored), then writes the media. `TINYZOO_PG_DUMP` / `TINYZOO_PG_RESTORE` select other binaries (used to run the
tests through Docker here; also a documented escape hatch). `docs/deploying.md` has the
"Backups and restore" section with the responsibility table and the restore drill.
*Deviation:* no `NUXT_CMS_BACKUP_BEFORE_MIGRATE`. A dump from inside the server needs
`pg_dump` in the image and somewhere to write, and a failure would force a decision
about starting the new version anyway; the docs say to run `tinyzoo backup` before a
deploy that changes the schema.

**Error reporting.** `cms:error` (typed in `NitroRuntimeHooks`, `CmsErrorReport` exported
from `tinyzoo`) fires for the same 5xx the JSON log line covers, for scheduled tasks that
threw (`cms:scheduled`, `cms:retention`, `cms:search-reindex`, with `source: 'task'`) and
for webhook deliveries that gave up (`source: 'webhook'`, URL as origin plus a short hash of the path: Slack and Discord keep their secret in the path). It runs on
the next tick, never awaited by the request, and a throwing hook is logged only. Reports
carry `message` without query values (drizzle's "Failed query" text includes bound
values, and h3 copies it into the error it throws). `report.error` is a scrubbed copy
(`scrubError` in `cmsErrors.ts`: safe message, stack frames kept, causes copied to depth 5);
the thrown error is `report.rawError`, documented as possibly holding personal data. The
docs show a Sentry plugin that sends only `report.error`. The playground has a test-only sink
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
the person's own details from the audit entries touching them: `email`, `ip` and `name`
from entries naming the address (case-insensitive, trimmed) and from `user.*` entries on
their id; `ip` and their own `name` from entries they made — never an `email` that is
someone else's (an administrator's `user.invite` entries keep the invitees' addresses).
Why anonymise
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
itself there. (Checked by the first CI run: it has 17+, and restore failed; see "0.2 D — Restore and client tool versions".)

### 0.2 — Wave 1 review (2026-11-16)

Two independent reviewers read the merged wave (security and privacy; data safety on
upgrades). Fixed on three branches (`fix/0.2-blocks`, `fix/0.2-cli`,
`fix/0.2-guard-docs`), each with tests that fail before the fix; main green after
(630 tests).

| Severity | Finding | Fix |
|---|---|---|
| High | Restoring an older backup over an upgraded database left both old and renamed tables; the new version could not start | restore drops and recreates the schemas, then `pg_restore --single-transaction --exit-on-error`; any non-empty target needs `--force` |
| High | `import --replace` of an `--only` archive deleted the whole media library | only the archive's own media that nothing else uses |
| High | A block posted without `v` was taken as current: an editor tab open across a version bump lost the renamed field | the admin stamps `v` on every block; a block without `v` is upgraded from 1 or refused, never stripped |
| Medium | A block whose `upgrade` throws was stored unvalidated (a `javascript:` link an editor then publishes) | refused unless identical to the stored block; a lower `v` only for blocks stored at it |
| Medium | The guard missed statements that fail on existing rows (required column without default, `SET NOT NULL`, new unique) | second class, `--allow-risky`; "Adding a required field" recipe |
| Medium | The `cms:error` Sentry example sent query parameters (emails, hashes) | `report.error` is scrubbed; the raw one is `rawError` |
| Medium | A shared bucket let staging delete production's files | docs: one bucket per environment; import warns on the same storage |
| Medium | The rename changeset contradicted what drizzle-kit writes | rewritten after real drizzle-kit runs |
| Low | restore followed symlinks; archives briefly world-readable; `export --only <form>` skipped the submissions rule; pg_dump TLS weaker than the app; no tar size limits; block versions missing from the fingerprint; CLI ignored storage settings in `nuxt.config`; made-up block types passing as known ones; two reads skipping the upgrade; webhook path secrets in error reports; privacy erase scrubbing other people's details | each fixed |

Open: Nitro's own unhandled-error log on stderr still prints failed queries with their
parameters (Wave 2, slice V).

### 0.2 U — Upgrade test

Branch `feat/0.2-upgrade-test`. `node scripts/upgrade-check.mjs [--from <ref>] [--keep] [--verbose]
[--logs <dir>]` (`pnpm check:upgrade`), the `upgrade` job in `ci.yml`, the baseline list
`.github/upgrade-baseline`, and `scripts/upgrade-check/` (`site.mjs`, `workspace.mjs`,
`differences.mjs`, a README for hooks). It is described in CONTRIBUTING.md ("The upgrade
test") and in the maintainers' section of `docs/upgrading.md`.

**What a run does** (one baseline: about 70–85 s here, no cache beyond pnpm's store):

1. *Old site.* The ref is checked out into a temp git worktree, installed with its own
   lockfile, and both packages are packed. Its own `tinyzoo init` makes a site outside the
   workspace; `tinyzoo` and `@tinyzoo/client` point at the tarballs and every other dependency
   is pinned to what that ref's lockfile resolved for the starter (so a run does not depend
   on whatever Nuxt published yesterday). The site is built (`nuxt build`), started in
   production mode with `NUXT_CMS_MIGRATIONS_ON_START=true` on a free port against a fresh
   `cms_upcheck_*` database, set up through the API (`NUXT_CMS_AUTH_SETUP_TOKEN` is set, which
   refs before and after slice D both honour), and seeded through the API: three pages (blocks
   of every type, one with an English translation, one a draft), two news items (cover, an image
   inside the text, an English translation, one a draft), site settings with a logo and a list
   (translated), the navigation (translated) and a form message. Then everything is recorded:
   the content API for every public entity and setting in every language, the admin's view of
   every entry and translation, the sitemap, and the SHA-256 of every file the content points
   at. The recording walks the admin graph (`/api/cms/_graph`), not a fixed list, so what a later
   seeder adds is compared too. The server is stopped (its PID only).
2. *Upgrade.* The current workspace packages are packed and installed into the same site
   (checked: the installed CLI is byte-for-byte the workspace's), then `tinyzoo upgrade` runs
   with no terminal. Its output goes in the log; the new migration's SQL is printed. A refusal
   fails the check with the guard's own words and where to look.
3. *New site.* Rebuilt, started with migrations on start against the same database. Checks, in
   order: it starts (`/api/health/ready`); `tinyzoo status` exits 0; the old account signs in;
   the content API and admin recordings are equal field by field (differences are matched
   against `differences.mjs` and the baseline's hook, each rule with a mandatory reason; anything
   else fails); every recorded file is served with identical bytes, at its old address too; the
   admin opens and saves every entry unchanged (PATCH per entry and language, PUT per setting),
   and a third recording after the saves differs only in timestamps.

**Baseline.** `.github/upgrade-baseline` lists `2506403` (merge of the snake_case table work:
the first commit whose tables are snake_case; earlier ones need the interactive rename).
`latest-tag` is resolved by the script and added when it is not listed, and skipped while
there is no tag. Changesets tags a monorepo's packages `tinyzoo@0.2.0`, not `v0.2.0`, so both
styles count (newest by version). The CI job runs every baseline, with `fetch-depth: 0`.

**CI job.** Postgres 16 and Valkey 8 as services like `test`, `UPGRADE_CHECK_REDIS_URL` so
both versions run on the shared store, Node 22, `cache: pnpm` (the store holds the baseline's and
the sites' downloads too; nothing else is safe to cache: the sites install without a lockfile
by design), a 30-minute limit, the failure summary in `$GITHUB_STEP_SUMMARY` and as an
`::error` annotation, and the command logs uploaded as an artifact when it fails.

**What it found.** The first run against `2506403` stopped on 29 differences: the admin now
hands the editor `v` on every block and list item (slice C and the Wave 1 review fix). That is
intended, the content API and stored JSON are unchanged, so it is the one rule in
`differences.mjs`. Between `2506403` and now the starter's schema does not change:
`tinyzoo upgrade` reports "No schema changes", so the migration and the order guard are not
exercised by this pair. They were checked by a temporary hook on `2506403` that removed
`siteSettings.phone`: without `--allow-drop` the check failed in `tinyzoo upgrade` with the guard's
text (drops column `phone`, nothing applied); with it the migration ran, the site started,
`status` was clean and the check failed on exactly the four `phone` fields as unexpected
differences. The hook was removed again.

**Tests.** `test/unit/upgrade-check.spec.ts`: comparing (added/removed/changed, ignored keys),
documented-rule matching (kind, `**`, reason required), the PNG fixture, the lockfile and
override readers, release-tag ordering. The run itself is the CI job; `pnpm check` does not run
it (network, two installs).

**Deviations and decisions.**
- The check lives next to `consumer-check.mjs` as a script plus a job, not in the vitest
  projects: it needs two real installs and builds.
- Dependencies of the site come from the ref's lockfile (starter importer), and the new side from
  the workspace lockfile, as `pnpm up` would give a site; transitive dependencies still float.
- Hooks (`scripts/upgrade-check/<ref>.mjs`) can add `tinyzoo upgrade` arguments, run code
  before and after it, add documented differences or replace the seeding; they need a
  `description`. There are no scripted prompt answers: without a terminal `tinyzoo upgrade`
  asks nothing (the rename question fails with a pointer, which is the behaviour tested).
- Seeding is pluggable (`SEEDERS`, `--seed`, a hook's `seed`); only the API seeder exists, `tinyzoo
  seed` joins when slice I is on main.

**Left.**
- The CI job has not run on GitHub (no push); the YAML parses and the script was run locally
  against Postgres and Valkey as in the job.
- Once 0.2.0 is tagged, `latest-tag` starts running by itself; the first run after a release
  may need a `differences.mjs` clean-up (rules every baseline already has are dead weight).
- When a slice changes the schema for existing sites (F, G, H), this check is where its Upgrade
  steps are first exercised: expect its first run to say something.
### 0.2 I — Seeding

Branch `feat/0.2-seed`. `pnpm check` green: 57 test files passed, 2 skipped; 676 tests passed, 16 skipped
(46 of them new). Guide: README, *Seeding: content a site starts with*; deploy notes in
`docs/deploying.md` (*Seeding a deployed site*).

- **API.** `defineSeed(async (s) => …)` in `seed/index.ts` (`src/seed.ts`, exported from `tinyzoo`).
  `s.create` (make when the key is new, otherwise leave exactly as it is), `s.upsert` (make, or bring
  up to the seed; fields left out are not touched), `s.translate(entry, locale, data)` and a
  `translations: { en: {…} }` option on both, `s.global` (saved whole; `ifMissing`), `s.upload(file, { alt,
  altLocales, focal, folder, name })` → media id, `s.link(label, address | entry, { locale, newTab, sub })`
  (an entry's address comes from its `content.path` and its translated slug), and `s.rich` (doc, p, h2, ul,
  quote, bold, link, image). Passing the entity object (`s.create(Post, …)`) types the data from
  `cms.config.ts` (`SeedInsert<E>`: blocks and list items need no `id`, a one-type list no `type`); a name
  string works untyped. Deviation: `by` and `translations` are a third argument, not part of the data
  (`s.upsert(Page, data, { by: 'slug' })`), so a field can never collide with an option.
- **How it writes: over HTTP, option (a).** The command signs in to the running site with an administrator
  and uses the admin's own endpoints (`POST/PATCH /api/cms/<entity>`, `?locale=` for translations,
  `PUT /_singleton`, `/_media`). That is the only way to get *identical* behaviour with the admin for free:
  Zod schemas, translations writer, media pipeline, search index, saved versions, webhooks, publish rules,
  audit. Running the server utils in-process (option b) would mean standing up `useCms()`, the storage
  driver, h3 events and the change hooks outside Nitro, and would diverge as they change. It also works
  for the deploy flow, where the database of a Pushbase site is not reachable from a laptop. First run on
  a fresh database: the command creates the first administrator through the setup endpoint
  (`SEED_EMAIL`, `SEED_PASSWORD`, `--name`) and honours slice D's setup code (`--setup-code`,
  `SEED_SETUP_CODE`, or asked for in a terminal; without one it says where the code is, in the log or in
  `NUXT_CMS_AUTH_SETUP_TOKEN`). The password is read from the environment only.
- **Idempotency.** An entry's key is `by` (default `content.slug`, else the entity's only `f.slug()`);
  files are found by name, folder, size and type. Before an update the stored value is read and compared
  (`covers`: only keys the seed gives, extras such as a block's `v` ignored, dates by the instant, id lists
  of many-to-many as sets); an equal value is not written, so a second run makes no save, no revision, no
  upload, no audit entry beyond the sign-in. Blocks and list items get ids made from where they sit, so
  they are the same on every run. The same file asked for twice in one run is uploaded once.
- **`tinyzoo seed [file] [--url --email --name --setup-code --dry-run --reset --yes --verbose --wait]`**
  (`cli/seed.ts`, the engine in `cli/seed-engine.ts` against a `SeedBackend` interface; `cli/index.ts` got
  one `case` and a usage line). `--dry-run` reads and reports (also on a site with no account yet).
  `--reset` first removes the entries and files the seed owns (found by key and file name), last declared
  first, then seeds; it asks, `--yes` for no terminal. A file still used (a global's logo) stays and is found
  again; other content is never touched; globals are overwritten, not deleted. Uploads wait and retry
  when the 60-a-minute limit is hit; the sign-in limits (10 per address per 15 minutes) are not waited
  out.
- **Starter.** `packages/cms/starter/seed/index.ts`: a small bakery in Czech and English: three pages
  (home, about, contact) with hero/text/picture/cta/contact blocks, four news items (three published, one
  draft), both menus, site settings with logo and opening hours, the form recipients, one redirect; five
  generated pictures (`seed/media`, 68 kB, drawn by `scripts/make-starter-media.mjs`). `pnpm seed` script;
  `tinyzoo init` prints it. Not seeded: form submissions (personal data).
- **Tests.** `test/unit/seed.spec.ts` (37: keys, idempotency, relations, blocks, translations, globals,
  upload, links, dry run, reset, report) against an in-memory site; `test/api/seed.spec.ts` (9): a built
  playground on its own database started like a deploy (production, setup code), first-run setup with a
  wrong/right code, content API in both languages, picture sizes, search index, revisions, a second run
  that leaves rows, `updated_at`, files and the audit log untouched, `--dry-run`, `create` vs `upsert`
  after an editor's change, `--reset` (other content stays, the file in use is reused), error messages,
  and the real CLI process. `pnpm check:starter` (`scripts/starter-check.mjs`, not part of `pnpm check`:
  it installs and builds an app, about two minutes): `tinyzoo init` out of the **packed** package,
  installed from the tarballs, migrated, built, started, seeded twice, content API and rendered pages
  checked. Root `tsconfig` now typechecks the starter's `cms.config.ts` and `seed/`.
- **The website's seed was not ported.** `site/scripts/seed.mjs` stays. The site's image ships `scripts/`
  and `seed/` as plain Node with no dependencies so the demo resets itself every night
  (`node scripts/reset.mjs`), and a `defineSeed` file is TypeScript that needs `tinyzoo` and `tsx`. Porting
  needs a bundling step (esbuild is only reachable through tsx under pnpm) and Dockerfile changes I could
  not build here; breaking the nightly reset or the image build was not worth it. The port itself is
  mechanical (the helpers map to `s.rich`; `item`/`link` ids come from the runner; `pages` → `upsert`,
  `news` → `create`, since their dates are relative to the first run). To do it: bundle `seed/index.ts`
  with the CLI runner into one `.mjs` at build time, copy it next to `seed/media`, and let `reset.mjs` call
  it. Deploy step 5 ("seed the website") works from a laptop with either script.

Left: no admin screen for seeding; `s.upsert` cannot clear a field the seed leaves out (give `null`);
the entry list of each entity is read once per run (fine for demo-sized content, not for thousands).
### 0.2 H — Plugin API

Branch `feat/0.2-plugins`. Guide: [plugins.md](plugins.md). Schema change: one migration in the playground
(`0019_events_plugin`, the example plugin's table); the forms move needs none (same tables, same names), checked by
`tinyzoo generate` in the starter and the website ("No schema changes").

**The API** (`packages/cms/src/plugin.ts`). `defineCmsPlugin({ name, version, entities, singletons, fields, components,
adminPages, navItems, serverHandlers, serverPlugins, hooks, i18n, upgrades, graph })` validates everything it can and
throws `Plugin "<name>": …`. Registered in `cms.config.ts` as `export const plugins = [...]` (also any plugin exported
by itself); `collectPlugins(config)` is the one reader, used by the registry, the module and the CLI. Paths in a
definition are absolute (`pluginFile(import.meta.url, './x.ts')`), so a plugin is the same in a site's folder and in
`node_modules`.

**Two halves, one definition.** Runtime parts go through the registry like the site's own: `buildRegistry` adds the
plugin's entities and singletons (schema, graph, content API, typed client and OpenAPI follow; `tinyzoo generate` puts
the tables into the site's migration), keeps `reg.plugins` and `reg.pluginOf`, and merges what a plugin's `graph(entity)`
returns (`adminCreate`, `notices`). Build-time parts: `module.ts` reads `cms.config.ts` with jiti (new dependency,
as the CLI reads it) and `planPlugins()` (pure, unit-tested) says what to register: `pages:extend` for admin pages,
`addServerHandler`, `addServerPlugin`, `addComponentsDir` (global), and `runtimeConfig.public.cmsPlugins` with the sidebar
entries, field renderers and texts. The sidebar (`admin.vue`), `CmsField`/`CmsCell` (host `app.config` → plugin → built-in)
and `useCmsI18n` (`t('plugins.<name>.<key>')`, English fallback, plurals) read it.

**Names and collisions.** Entities are `<name>` or `<name>_…` (checked when the plugin is defined, plus a collision
check against the site in `buildRegistry`), routes `/api/cms/_p/<name>/…`, pages `/admin/p/<name>/…`, texts
`plugins.<name>.…`, upgrade steps `<name>:<id>`. Reserved plugin names (`cms`, `core`, `tinyzoo`, `admin`, `api`,
`content`, `media`, `plugins`, `p`, `auth`, `system`) and the entity name `p` are refused; duplicates (two plugins with
one name, one route, one admin page, one field type, one public address), missing files and an entity whose plugin is not
registered stop the build with a message naming the plugin. A Nitro plugin (`cms-plugins.ts`) builds the registry at
start so a misconfiguration stops a production start instead of answering 500 to the first request.

**Access.** Routes under `/api/cms/_p/…` are checked by the middleware `cms-z-plugin-access` *before* the handler:
`user` (default), `admin` or `public`; an address no handler declares is `user` (never open by accident). (The
middleware is named so it sorts after `cms-session`; Nitro orders by file name.) The CSRF rule of `/api/cms/**` applies.
`contentPath` mounts a handler on the public content API (`/api/content/_x/…`, first segment `_…`, not `_global`,
`_search`, `_sitemap`); those are open and the handler guards itself.

**Upgrade steps from plugins.** `pluginUpgradeSteps(plugins)` namespaces ids as `<plugin>:<id>` and takes the plugin's
version for `since`; `allUpgradeSteps(plugins)` is tinyzoo's list plus theirs. The start-up migration (`useCms().reg.plugins`),
`tinyzoo up` and `tinyzoo status` (new `siteUpgradeSteps(cwd)` loads the site's config; no config means tinyzoo's steps
only) all pass the whole list to the runner from slice A; `status` prints the owner and its version
(`events:backfill-place (events 0.1.0)`). `assertValidSteps` accepts the namespaced form.

**Forms as the first plugin** (`tinyzoo/forms`, `packages/cms/forms/`, listed in `files` and `exports`). Moved with
`git mv`: the two endpoints (`forms/server/form.get.ts`, `form.post.ts`), `forms.ts` (schema, recipients, email,
Turnstile), `formSettings.ts` and `<CmsForm>` (`forms/components/`). `defineForm`, `defineFormSettings` and
`FORM_FIELD_TYPES` live in `forms/index.ts`; `formsPlugin()` brings the endpoints (`contentPath: '_form/:name'`, so the
address is the one sites already use; no `/api/cms/_p/forms/*` was added), the components directory, the retention hook
(`forms/retention.ts`: `retainForms`, `purgeSubmissions`; `runRetention` now calls every plugin's `hooks.retention`
and still writes `meta.forms`, plus `meta.plugins` for others) and the admin bits through `graph` + `i18n` (no "New"
button; the retention note under the list is now `plugins.forms.retention`, the `list.retention` message left the core
catalogues). `defineForm` and `defineFormSettings` from `tinyzoo` are deprecated re-exports (`cmsDeprecated`, once per
helper, removed in 0.4.0) that mark their entities with a `requiresPlugin` carrying `create: formsPlugin`, so
`collectPlugins` registers the plugin by itself (module and registry both); the new helpers refuse to work without the
plugin and say how to register it. The playground, the starter and the website moved to `tinyzoo/forms` +
`export const plugins = [formsPlugin()]`.

**The second plugin, in the playground** (`playground/cms-plugins/events/`): the `events` collection, an admin page
(`/admin/p/events`) with a sidebar entry, three routes (`summary` for signed-in people, `clear-past` for administrators,
`next` for anyone, also at `/api/content/_events/next`), a Nitro plugin (marks its routes with `x-cms-plugin`), texts in
cs/en/de and the upgrade step `backfill-place`. No file
of tinyzoo knows about it. The entity is not public, so the contract snapshots did not change.

**Tests.** `pnpm check` green: 57 test files passed, 2 skipped; 715 tests passed, 16 skipped (the skips were already there). New: `test/unit/plugins.spec.ts` (71): validation of every option, namespacing of entities and steps, collisions,
`collectPlugins` (explicit, implicit, duplicates, missing plugin), the deprecated path (works, warns once per helper,
same entity, same build plan as the explicit plugin), registry and graph extension, `planPlugins`, route access,
step runner (recorded under the namespaced id, skipped on a fresh install), CLI steps, `status` wording.
`test/api/plugins.spec.ts` (14): the plugin's entity through the CMS API, its three routes with their three accesses
(and that unknown addresses stay closed, a wrong method too, CSRF), the admin page served with the plugin's texts in
all languages, the step run, effective and recorded as `events:backfill-place`. The existing forms, privacy and upgrade specs
run unchanged through the plugin path (two assertions changed: the admin graph carries `notices` and `adminCreate`
instead of `retentionDays`; the entity list in `entity.spec.ts` has `events`). `scripts/consumer-check.mjs` copies the
example plugin: the packed tarballs build, and the built server answered `GET /api/content/_form/contactForm` and
the events routes (forms handlers load from `node_modules/tinyzoo/forms`, with Nitro's auto-imports).

**Deviations and what to know.**
- The forms and their settings stay **the site's own entities** (`contactForm`, `formSettings`, named by the site),
  not namespaced: they are site content that the plugin serves, and their names are the tables sites already have.
  The `<name>` / `<name>_…` rule is for entities a plugin brings itself.
- `hooks` has one hook today, `retention`. `privacy` was not made a hook: the Privacy screen's lookup/export/erase
  still finds forms through the entity tag (`preset: 'form'`, helpers imported from `forms/retention.ts`), because a
  generic version changes the response shape of `/api/cms/_privacy/*` that the screen and its spec use. `cli/export.ts`
  still tags forms by `preset` for the `--with-submissions` rule.
- The plugin list is read at build time, and `nuxt dev` needs a restart after adding or removing a plugin (a watcher I
  wrote for this was removed: `cms.config.ts` is outside the directories Nuxt watches, and the path it reports is
  relative to the source directory, so it would never have fired).
- Texts, sidebar entries and field renderers travel in the **public** runtime config: every page's payload carries
  every language of every plugin's texts. Fine for admin strings; a plugin must not put anything private in `i18n`.
- Core graph change (internal, not a contract): `retentionDays` became `adminCreate` + `notices`, and `plugin` names the
  owner. Entity name `p` is reserved.
- A plugin's handler files are bundled by Nitro like the layer's own; I did not check whether the hosts' `nuxt typecheck`
  sees them (`nuxt typecheck` passed with the events and forms handlers present).

**Left.** No browser check of the events page and the sidebar entry (the API spec only proves the server renders the
page and its texts); no test that `CmsField`/`CmsCell` pick a plugin's renderer (the plan and the config are tested,
the dispatch is three lines); no test of a plugin installed from the registry into `node_modules` (the forms plugin
is the covered case); the dev-server restart on a changed plugin list; the privacy hook above; more hooks (`change`,
`startup`) when a plugin needs them.
### 0.2 F — Groups and links that follow

Branch `feat/0.2-links`. README: "Groups: `f.group`" and "Links that follow their page";
upgrade steps in `docs/upgrading.md` and the changeset. `pnpm check` green: 59 test files
passed, 2 skipped; 698 tests passed, 16 skipped (68 new: `test/unit/groups.spec.ts`,
`links.spec.ts`, `test/api/groups.spec.ts`, `links.spec.ts`).

**`f.group({ fields })`.** One jsonb column (`type: 'group'`, `Record<string, unknown>` in the
emitted schema), validated per field with the rule blocks use (`required: true` must be
filled in, the rest may be empty, unknown keys dropped), `.optional()` (null) and
`.localized()` (a whole group per language; an empty or untranslated group falls back, see
`isEmpty` in `cmsLocales.ts`). Allowed inside: `BLOCK_FIELD_TYPES`, which now includes `group`
(so groups nest and sit in blocks and list items). Row/Insert type each field by its kind, every
key optional/nullable (`GroupValue`): which fields are required is a runtime rule the types
cannot see. Content API/OpenAPI/client: `{ kind: 'group' }`, an object with every field
present (null when empty, media resolved), nullable only when the group is optional.
Wired through: media (cleanup, usage, translations), search (text read, index signature only
changes for entities with a group), `upgradeStoredRow` (lists and rich text inside),
`content:migrate`, export/import (media, upgrade, fingerprint), the admin (`CmsFieldGroup`
fieldset, `CmsCellGroup`, form defaults, error paths `contact.address.city`, restore of
missing media). Playground: `siteSettings.contact` (nested group + media), `post.location`
(optional, localized), a `contact` block with a group; migration `0019_group_fields`
(three nullable columns).

**Links that follow.** `cms:<entity>/<id>` (`src/linkref.ts`, strict: a well-formed uuid, nothing
else), accepted by `isSafeLink`, link fields and rich-text link marks (the editor's link
extension gets the `cms` scheme); not by `format: 'url'`/`'path'`. `src/links.ts` is the pure
walk (`mapRowLinks`, `linkRefsOf`: fields, lists, blocks, groups, rich text; copy-on-write, a
dropped rich-text link keeps its words). `server/utils/cmsLinks.ts`: `resolveContentLinks`
(called from `populateItems`, so lists, items, globals and populated targets are all covered;
`?preview` resolves drafts), `describeLinkRefs` (admin: title, address, `live | draft |
missing | restricted`, new `POST /api/cms/_links/resolve`), `linksTo`. Addresses come from
`cmsLinkAddress.ts`: the picker's computation (translated parts from the translation, the rest
from the default language); a collection with no address for the language links to the default
language's page. Linkable = public, with `content.path`; the picker now offers only those
and returns `ref`. Delete: 409 `in_use` also when something links to the entry (text search of
the stored JSON, so unknown blocks count; self-links do not; entries, globals and
translations are named). Redirects: a `to` that is a reference is resolved when the cache
loads and in the loop check; page changes now clear the redirect cache. Webhooks: when an
entry's address or reachability changes, `paths` also holds the entries that link to it and the
optional `globals` names the public globals that do (`CmsChange.globals`). `tinyzoo
links:convert [--dry-run] [--batch n]` (`cli/links-convert.ts`, one `case` in `cli/index.ts`).
Admin: picker emits references, `CmsLinkTarget` + `useCmsLinkTargets` (batched, per language)
show the target in link fields, the rich-text popover and lists, with warnings.

**Contract.** Required link fields are `string | null` in the content API types and OpenAPI
(menus' `url`; optional ones already were); `CmsMenuLink.url` is `string | null`;
`cmsMenuTree`/`<CmsNav>` skip links without an address. Same JSON on the wire for a site that
stores no references. Golden files regenerated (`pnpm contracts:update`), changeset says it is
a type-level break.

Deviations and limits:
- Links do not carry an `#anchor` or `?query`; `links:convert` reports such addresses and
  leaves them.
- `links:convert` skips blocks stored at an older version (it reports them; run
  `content:migrate` first) and does not rewrite History.
- A list may sit only directly in a group on an entry (not in a group inside a block, a list
  item or another group): keeps the one-level rule of lists without walking nested stored
  versions.
- Groups have no `version`/`upgrade` of their own (their lists and rich text do).
- Unpublishing a linked page is not blocked or warned about at the moment of unpublishing;
  the link is just hidden and the admin warns on the link.
- Not checked in a browser (the shared one was in use): the new admin pieces type-check,
  render in the build and have strings in cs/en/de, but nobody has clicked through them.
- Two unrelated flakes showed up in full runs and passed on rerun: the tar writer's permission
  test in `cli-hardening.spec.ts` (ENOENT) and a `truncate` deadlock in `crud.spec.ts`.
### 0.2 G — Page tree

Branch `feat/0.2-tree`. Opt-in `definePages({ tree: true | { maxDepth } })`; the user-facing description is in the README ("Pages under pages: the page tree"), the upgrade steps in `docs/upgrading.md`.

- **Model.** `EntityDef.tree = { parent, order, maxDepth }` (generic, so it is not tied to pages): a self many-to-one `parent` (`ON DELETE restrict`) and an integer `position` (also the `orderField`). The slug stops being unique (a tree requires a non-unique slug, `content.slug` and a `content.path` with `:slug`); the whole address is checked instead. Pure rules in `src/tree.ts` (chains, depth, cycles, address per language with fallback, uniqueness among affected pages only, `movedPaths`), server in `server/utils/cmsTree.ts`. Writes that can change an address (create, PATCH, translation write and delete, `_move`) take a per-entity advisory lock, load the tree (two queries; nothing cached, so a move is visible everywhere at once), check, write and leave redirects in the same transaction.
- **One address function.** `sitePath` (paths.ts) takes a list of parts (`{ slug: ['o-nas','tym'] }`) and builds the nested address; the async `localePaths(db, reg, e, ids)` is the one that says where an entry is, per language, and is now tree-aware and also works without languages (key `''`). The sitemap, the change report (`changeSnapshot`), the website search (path computed at read time for trees, because a descendant's address changes without the descendant being saved), the link picker and the `path` / `paths` of items all use it. **For slice F:** call `localePaths`.
- **Visibility.** `publishedCond` also requires every ancestor to be live (nested `exists`, one level per `maxDepth - 1`). Decision: **a child of an unpublished page is not reachable** (404 in the content API, absent from list, tree, sitemap, search and webhooks); an editor's `?preview` still reads it, with the real trail. Unpublishing reports the whole subtree's addresses.
- **Content API.** Items: `parent` (id), `position`, `path`, `breadcrumbs`. Single item by the whole address as one path segment (`/api/content/page/o-nas%2Ftym`), because a catch-all route `[...slug]` made the host apps' typed `useFetch` unions ambiguous (host typecheck failed) and a `[entity]/_tree` sibling did too; hence also `GET /api/content/_tree/:entity` (like `_global/:name`). Lookup order for a language: pages translated into it by their translated parts, any page by the parts it has in that language (fallbacks), any page by its default parts. The starter and the client send escaped slashes.
- **Redirects and reports.** Old → new 301s for every moved address of every page that was live before and after (drafts and pages under drafts get none; a first translation is not a move: the default address still finds the page; a page not translated into a language is reachable there at its fallback address, so that moves too). Existing redirects pointing at an old address are re-pointed (no chains); a redirect from an address a page is back at is removed. `CmsChange.moved`, `paths` = old + new addresses of the subtree. Sites without `defineRedirects` get none (documented).
- **Admin.** `CmsTreeList` for `listLayout: 'tree'`: fold/unfold (remembered), filter, the address under each title, "Hidden" when a parent is a draft, drag (middle = under, edges = before/after; no handle on touch screens), row menu with Move up / Move down / Move… (dialog with parent and place) / Add a subpage; `new?parent=`; the parent picker leaves out the page and its subpages (`options?exclude=`) and names pages by trail; the editor's preview and "view on site" use the real nested address; messages for loops, depth, taken address and "has subpages" in cs/en/de.
- **Sitemap.** Both ways, because they fit different things: `cms.sitemap.paths` for fixed pages (validated at build, one object per page gives hreflang alternates) and the `cms:sitemap` Nitro hook for addresses that come from data. `lastmod` may be `null`.
- **Hosts.** Playground and starter have `tree: true` (migrations `0019_page_tree`, starter `0001_page_tree`, both pass the guard without flags: a dropped constraint is not flagged). The website host is unchanged (flat pages, no migration). The emitter writes `(): AnyPgColumn =>` for a self-referencing foreign key (TypeScript otherwise fails on the circular type).
- **Contracts.** Playground golden files changed additively (`parent`, `position`, `path`, `breadcrumbs`, the `parent` filter, `tree: true`, the `_tree` operation); nothing existing changed, a collection that does not enable the tree is untouched. Changeset: minor, no breaking change.
- **Tests.** `test/unit/tree.spec.ts` (22: address building, fallback, cycles, depth, uniqueness, moved paths, `definePages`), `test/api/page-tree.spec.ts` (34: a three-level tree, lookup in two languages, breadcrumbs, tree order, drafts and branches, refusals, moving a subtree with redirects and chains, renames in both languages, translation removal, webhook payload, sitemap with fixed paths and the hook, admin list, parent picker, search, link picker).
- **Result.** `pnpm check` stages run one after another: typecheck (root, playground, starter, website) green, unit 356 passed / 2 skipped, API 330 passed / 14 skipped (the skips were there), build green. Run all at once on a loaded machine, one unrelated timing test fails now and then (`changes.spec` webhook retry, `scheduled.spec`, `migrate.spec` 5 s timeout, `cli-hardening.spec`): each passed alone and on the next run.
- **Not done / left.** Not looked at in a browser (the shared Chrome profile was locked by another process): the tree list, drag and the Move dialog type-check and server-render (rows and addresses verified in the rendered HTML), nothing more. Importing an archive (`tinyzoo import`) does not check addresses or leave redirects. No tree for entities other than pages is surfaced in presets (the `tree` option on `defineEntity` works, untested beyond pages). Redirects for several languages × many pages are one report each (can be many events on a big subtree).

parameters (Wave 2, slice V — done, see below).

### 0.2 V — Visual pass and log privacy

Branch `fix/0.2-visual`. `pnpm check` green: 55 test files passed, 2 skipped; 637 tests
passed, 16 skipped (the backup specs skip without `pg_dump`/`pg_restore`, as before). New:
6 unit tests (`hushError`, `snapshotError`, `redactEmails`) and one API test, plus assertions in
two others (`test/api/ops-server.spec.ts`). The API test fails on the old plugin (the email
is in the log) and passes on the new one.

**How it was looked at.** A production build of the playground (cache dir, own database and
port), Playwright scripts with a headless Chromium (no shared browser), at 1440 px and 390 px
(touch emulation), light and dark, Czech and English: 8 combinations per screen. The states
were put in the database by hand: a page with an unknown block type, a block whose `upgrade`
throws (a temporary change to the playground's `cta`, reverted before committing), an old
`cta`, a list inside a block; form messages for one address, an invited account and an audit
entry for it; a fresh database without a token for the setup page. Each screen got an
automatic audit (overflow, 44 px targets, WCAG contrast of every text node, unnamed controls,
raw keys) and was read by eye. Screenshots, before and after, are in
`docs/screenshots/0.2/` (cropped, 19 files, about 750 KB).

**Found and changed**

| Where | Seen at | What was wrong | Change |
|---|---|---|---|
| Block cards (page editor) | all 8 | "could not be brought up to date" named the block by its stored key (`(cta)`), also in Czech | names it by its label (`Výzva k akci`) |
| Block cards | all 8 | neither card said what the block held, so with several unknown blocks an editor cannot tell which to remove | a line "Obsah: …" from its first stored texts |
| Block cards | screen reader | three buttons all named "Odebrat" | `aria-label` "Odebrat blok {name}", the card is a labelled group, the icon is hidden |
| Block cards | light, all sizes | "Odebrat" in red-500: 3.8:1 | error text is red-700 in light (6.5:1); dark was fine |
| Block cards | phone | Remove and "…" 28 px | 44 px on touch screens |
| Remove a block of an unknown type | all | no question, only an "Undo" toast, and the type can never be added again | the admin's confirm dialog ("Odebrat blok „testimonials“?", the safe answer has the focus) |
| The editor's refusals of a whole block (newer version, unknown fields, unknown type, not up to date) | all | the message had no field, so it only showed under the whole list, off screen on a long page, while the block said "Needs attention" without a reason | shown on the block itself (`role="alert"`), also in the locked cards |
| Same refusals | cs, en | a strict-validation refusal read "Tohle nevypadá správně" / "This doesn't look right" | "Blok obsahuje pole, která web nezná (legacyLabel)…" |
| List field | all | an item without a type read "…no longer exists ()" | falls back to "Položka" |
| Setup page | cs, all sizes | validation errors in English ("Invalid email address", "At least 10 characters") | the page's language (`cmsIssueMessage`) |
| Setup page | all | the cursor was on the name, not on the code; no hint of its shape | the code field has the cursor and the placeholder `XXXX-XXXX-XXXX-XXXX` (when the code is in the log); errors are `role="alert"` |
| Setup, sign-in, reset, invitation | light, all | muted text on cream 4.37:1 (hints, the line under the title, the footer) | muted is 54 % grey: 4.5:1 on cream, 4.9:1 on white |
| Setup, sign-in, reset, invitation | phone | fields and buttons 32 px (and a text size that makes iOS zoom — checked: 16 px already) | 44 px on touch (`.cms-touch` on the auth layout) |
| Privacy | all | the email field was red with `aria-invalid="true"` from the first render (an empty string passed as the error) | no error is `undefined` |
| Privacy | all | the delete question was a general paragraph ("síťová adresa") that did not say what this lookup would delete | one line per thing found: "2 zprávy z formulářů se smažou i s uloženými verzemi", the account, "V záznamu aktivity (1 záznam)…", "Nejde to vrátit zpět"; "IP adresa" |
| Privacy | all | messages were listed with raw option keys ("race") and the address that was searched for | the form's labels ("Závod"), no address |
| Privacy | all | after an erase the heading said "Uloženo k adrese …" above "nothing is stored" | "Smazáno. K adrese … už není nic uloženo." and the note about backups |
| Privacy | light / dark | the soft red delete button 3.3:1, the counts 2.6:1 (light) and 3.6:1 (dark) | red-700 / muted |
| Privacy | phone | the two actions wrapped into narrow columns ("Smazat data této osoby" on two lines), the search button 32 px | stacked, full width, 44 px |
| Retention line (forms list) | all | fine at every size and theme (12 px muted, no overflow); "po 180 dnech" did not say from when | "180 dní po přijetí" (it counts from `created_at`) |
| Every admin screen | all | the sidebar's group labels (Obsah, Nastavení) in `text-dimmed`: 2.6:1 light, 3.8:1 dark | muted |
| Folded sidebar | all | the "View website" link had no accessible name | `aria-label` |
| Confirm dialog | — | a description could only be one paragraph | one short statement per line |

Found by the audit on my own first attempt and fixed before the commit: a second `useFetch`
with the layout's key (`cms-graph`) made the Privacy form's generated ids differ after
hydration (label `for` ≠ input `id`, an unlabelled field); the page now reads the layout's
data with `useNuxtData`. `docs/ui-foundation.md` has the rules that came out of it.

Checked and fine: the Privacy flow end to end (lookup → invalid address → export, a
`personal-data.json` download → the confirm dialog with the focus on "Zrušit" → delete → the
result; the account becomes `deleted-<id>@anonymised.invalid`, disabled), keyboard order on
setup (code → name → email → password → Enter), Esc on the dialogs keeps the data, the
retention line, no horizontal overflow anywhere, no console errors.

**Log privacy.** Nitro prints every unhandled error itself (`[request error] [unhandled]
[GET] <url>` and the error with its `cause`); h3 has copied a failed query's message
(`Failed query: … params: …`) into it. In h3 1.15 / nitropack 2.13 the `error` hook runs
before the error handler, so `server/plugins/cms-errors.ts` now changes the error there, in
production: `hushError` (`server/utils/cmsScrub.ts`) sets its message to "Server Error" (what
the client got already), replaces its causes with the scrubbed copies, drops `data`, and
clears `unhandled`/`fatal`, the only thing that makes Nitro and h3 print it. The one line
written is tinyzoo's JSON line. A copy of the original (`snapshotError`) goes to `cms:error` as
`rawError`. The client's answer does not change (the API test compares the JSON body; a browser
request gets Nuxt's error page, checked with `Accept: text/html`). This also keeps the request
URL's query string (`?q=jana@…`) out of the log, which a scrubbed message alone would not.
Alternatives rejected: a custom Nitro error handler (it has to render for JSON and HTML and for
a host's own `error.vue`, so it would copy Nuxt's logic), and only scrubbing the message (the
URL line stays). In `nuxt dev` Nitro's output stays (a developer wants it).
The package's other `console.error(…, err)` calls (revisions, search, collab, audit, redirects,
realtime, the setup code) now print `scrubError(err)` or `safeErrorMessage(err)`, and the
failed-mail lines pass through `redactEmails` (a mail server's refusal repeats the address).
`docs/deploying.md` ("Logs") is rewritten to say what is true, with the remaining cases: a
driver message that names a value (an invalid uuid), `cms.mail.transport: "log"`, a site's own
`console.error`, and the platform's access log (query strings).

**Not done / for later.** The count next to a list's title ("Kontaktní formulář 3", 28 px) and
placeholders are `text-dimmed` (2.6:1): a token for "quiet but readable" would be a design
decision. The editor's top bar "More actions" button is 32 px on phones. The Czech minimum-length
message ("Aspoň 10 znaků") and the hint under it ("Alespoň 10 znaků.") use two spellings. The
`[request error]` suppression exists only in a production build, by design; `nuxt dev` keeps Nitro's output.

### 0.2 — Wave 2 review (2026-11-16)

Two independent reviewers (security; correctness and upgrades — the latter upgraded a
real site from before the wave). Fixed on `fix/0.2-w2-links`, `fix/0.2-w2-tree`,
`fix/0.2-w2-seed` plus direct fixes on main, each with tests that fail before the fix;
main green after (975 tests, starter check, upgrade check from `2506403`).

| Severity | Finding | Fix |
|---|---|---|
| High | A trailing slash got any signed-in person past `access: 'admin'` on plugin routes (reproduced: an editor deleted events) | the access check reads the address the way the router does; `**` routes; an undeclared address gets the plugin's strictest rule |
| High | A redirect to a page reference looped forever once the page took over the redirect's address | such redirects are skipped and removed when an entry goes live at that address, in the save's transaction |
| Medium | Moving a page renumbered siblings the mover may not edit (and stamped them as edited by the mover) | positions spaced 1024 apart; renumbering only as a system write that touches no version or editor |
| Medium | `seed --reset` could delete pages an editor made | only what the seed's account created and nobody changed; the plan is listed before asking |
| Medium | `links:convert` switched links to another language and dropped links to drafts | converts only same-language, live, unambiguous matches; reports the rest |
| Medium | The seed stored addresses instead of references (menus didn't follow, tree links wrong) | `s.link` stores `cms:` refs |
| Medium | `import --merge` skipped page-tree checks (the tree dropped the unique slug constraints) | the whole tree is validated in the import transaction |
| Low | tree writes read before the lock; the unpublished-ancestor rule stopped at `maxDepth-1`; titles/existence of unreadable pages in link details, tree labels, refusals; preview resolving drafts the previewer can't read; redirects to refs always in the default language; webhooks missing links to subpages; seed reset stopping half-way; seed's "local address" check; two raw error logs; a draft's translated part hiding a live page; plugin steps on an existing site (docs) | each fixed |
| Found while merging | link resolution used flat addresses for tree pages; a translation of a tree page locked the row before the tree (deadlock in the test log) | tree-aware resolution (nested address, unpublished ancestor → no link); tree lock first everywhere |
| Flaky tests | archive-permission test (raced the stream's open); `truncateAll` deadlocking with the retention task | test waits for the file; cleanup takes the tasks' advisory locks first |

### 0.2 J — Documentation

Branch `docs/0.2-guide`. Docs for the people who build a site, for the people who fill it, and
a map. Start at [docs/README.md](README.md). `pnpm check` green: 69 test files passed, 2 skipped; 1003 tests passed, 16 skipped (the backup specs skip without `pg_dump` as before).

**The tree**

| Where | What |
|---|---|
| `README.md` | 104 lines: what tinyzoo is, a five-command try-out, a checked 20-line example, the doc map, development. The 1,240-line reference it used to be moved into the guide |
| `docs/README.md` | the doc map: site developers / editors / people working on tinyzoo (roadmap, production and pilot plans, research, brand) |
| `docs/guide/getting-started.md` | `tinyzoo init` → install → database → migrate → seed → first sign-in → a collection of your own (Team members: photo, role, order) → generate and migrate → the typed client on a page → what to commit → the going-live checklist |
| `docs/guide/content-model.md` | the `cms.config.ts` reference: every field type and modifier, relations, lists, groups, blocks and versions, globals, presets (pages, page tree, menus, redirects, SEO, forms), languages, links that follow, publishing, scheduling, access rules, reading content |
| `docs/guide/recipes.md` | ten recipes (contact form, news, team page, FAQ, opening hours, photo gallery, downloads, partners, events, menus with dropdowns): config, website part, admin note, gotchas |
| `docs/guide/{content-api,media,admin,seeding,content-transfer}.md` | the rest of the old README, by topic |
| `docs/development.md` | repository layout, the playground, tests and CI, decisions that shaped the code (also moved out of the README) |
| `docs/editors/cs/` | the editors' manual in Czech: 10 pages and a table of contents, button names checked against `cs.ts`, a `<!-- screenshot: … -->` marker where a picture helps (9 of them, for Wave 5) |
| `docs/upgrading.md` | corrected and extended (below) |

**Guards so the docs cannot rot** (both run in `pnpm check`)
- `pnpm docs:check` (inside `pnpm typecheck`): code blocks marked `<!-- check: group/path -->` in `docs/guide/*.md` and the README are written out as small sites. Each group's `cms.config.ts` is **loaded** (`buildRegistry`, `emitSchema`, `emitContentTypes`) and the typed client is generated from it, then `tsc` checks everything (`.vue` blocks: the script part). 30 blocks in 14 groups, 1 s. Details: `test/docs/README.md`, CONTRIBUTING.md. It caught `defineEntity('team')` (reserved) and a missing stub while the recipes were written.
- `test/unit/doc-links.spec.ts`: every relative link and `#anchor` in README, CONTRIBUTING and `docs/**` resolves.

**Upgrade guide, followed for real** (`scripts/upgrade-check.mjs --from 2506403 --keep`, then by hand in the kept site: `tinyzoo upgrade`, `tree: true`, `generate`, `up`, `links:convert`, the forms move, a nested page, the site started). The check itself passed (79 s). What reality said that the doc did not:
- `pnpm up tinyzoo @tinyzoo/client` never leaves `^0.x`'s minor, which is where breaking changes live → `--latest`, with the reason. (From pnpm's documented behaviour; not tried against the registry, 0.2 is not on it.)
- A 0.1-era site logs two deprecation lines (`defineForm`, `defineFormSettings`) and the doc said nothing → a new section **From 0.1 to 0.2** (the changesets' steps in order: update, snake_case renames with the drizzle-kit questions, search and `pg_trgm`, apply and stop old instances, forms to the plugin, regenerate the client and `string | null` links, the optional features, "the starter's files are yours: diff a fresh `tinyzoo init`").
- **`tree: true` with the old starter's page route: every nested page 404s on the website** (API: `page/kontakt/tym` 404, `page/kontakt%2Ftym` 200). The doc said "pass the whole address"; it now shows the one-word change in `[...slug].vue`. The migration is five statements (one constraint and one index dropped, not "two constraints"), passes the guard without flags (confirmed); the doc shows the SQL.
- `tinyzoo links:convert` and `content:migrate` said "DATABASE_URL is not set" on a site whose database address is in `.env`, while `up`/`status`/`upgrade` read it → **code fix** (below). The doc now names `.env`, and says fixed pages (`/`, `/aktuality`) are never converted: they are not entries.
- Not exercised: the interactive snake_case rename (the baseline starts after it, and there is no terminal here; the steps are the changeset's, rewritten after real drizzle-kit runs in the wave review).

**Getting started, followed literally** in a temporary folder outside the repo, as a newcomer: `pnpm --package=file:<tarball> dlx tinyzoo init my-site` (the packed `tinyzoo` 0.1.0; 0.2 is not on npm, so the only deviation is that the site's two dependencies point at the tarballs), `pnpm install`, `cp .env.example .env`, `docker compose up -d`, `pnpm db:migrate`, `pnpm dev`, `pnpm seed`, the Team members collection exactly as the doc gives it (`db:generate` → migration with `team_member` and `team_member_locales` → `db:migrate`), `pnpm cms:client`, `app/pages/tym.vue` extracted from the doc, two members with photos and an English role (through the admin API), the menu link, `pnpm typecheck` (green), the commit list (`git add -n`: no `.env`, `.cms-uploads`, `.nuxt`). `/tym` and `/en/team` render the members in order, in both languages. Snags, and what each changed:

| Snag | Fixed in |
|---|---|
| `docker compose up -d`: `port is already allocated` (5433 was taken) | doc: the `SITE_PG_PORT` route, and `.env` must match |
| `nuxt dev` moved to 3003 because 3000 was taken; **`pnpm seed` defaults to `localhost:3000`, which was another project's server** (it would sign in there, or create an administrator on an empty one) | doc: pass `SEED_URL` ("do not skip this"); `seeding.md` "Which site?". Left as is in code |
| `defineEntity('team')` throws: `team` is reserved (the admin's Team page) | doc uses `teamMember` and explains; the error message names the list already |
| between saving the new collection and `pnpm db:migrate` the dev server printed `could not build the search index … relation "team_member" does not exist` | **code fix**: the line now says a table is missing and what to run (`missingTableHint`), plus doc note |
| `Ignored build scripts: esbuild, sharp…` after `pnpm dlx` / `pnpm install` | doc: harmless (uploads with `sharp` worked) |
| the sidebar groups, "Create the first one" / "+ Team member" | doc corrected from `admin.vue` and `en.ts` |

Not clicked in a browser (none was available): the admin steps (Arrange, the language switcher, the Navigation form) were done through the same API and read from the components.

**Code changes, small, each with a test that fails before the fix**
1. `links:convert` and `content:migrate` read `DATABASE_URL` from the site's `.env` (they used the environment only and a different precedence than `up`): `test/api/links.spec.ts`, `test/api/block-versions.spec.ts` (run from a folder whose only setting is its `.env`), helper `test/helpers/siteFolder.ts`.
2. `missingTableHint` (`server/utils/cmsScrub.ts`) in the search plugin's failure line: `test/unit/error-report.spec.ts`.
3. Changeset `cli-env-and-search-hint` (patch).

**Found, not changed**
- The starter's home page `<title>` repeats the site name ("Pekárna Na Růžku · čerstvé pečivo z Dolní Lhoty · Pekárna Na Růžku").
- Admin strings: "Aspoň {n} znaků" (validation) vs "Alespoň 10 znaků." (password hint); the setup-code hint shows editors the variable name `NUXT_CMS_AUTH_SETUP_TOKEN`; `editor.newTitle` lowercases the entity name ("Nová položka: aktualita"); `common.new` looks unused (the create button is `+` and the singular name); `list.bulkFailed` has one text for every plural form; **Další akce** holds unpublish, duplicate, delete and discard, which people may not find.
- `docs/pilot-plan.md` and `docs/production-plan.md` still compare tinyzoo with other CMSs (internal plans, untouched).

**Left**
- Screenshots for the editors' manual and the guide (Wave 5); an English edition of the editors' manual; the guide on the website (Wave 5, slice Q).
- `pnpm dlx tinyzoo init` and `pnpm up … --latest` against the registry once 0.2.0 is published (slice K): the doc says what they should do.
- The recipes' templates are not type-checked (only scripts and configs), and the stubs for Nuxt's auto-imports are hand-written.
### 0.2 K1 — Private buckets

Branch `feat/0.2-private-bucket`. Why: Pushbase Storage is S3-compatible but **private** (no public bucket, no policies), and the S3 driver stored `<endpoint>/<bucket>/<key>`, so on Pushbase every media address answered 403 — which blocked deploying the tinyzoo website and its demo there.

- **Setting.** `cms.storage.s3.delivery: 'public' | 'proxy' | 'redirect'` (env `NUXT_CMS_STORAGE_S3_DELIVERY`). Default `public` with `publicBaseUrl`, otherwise `proxy`; an unknown word fails the first request that needs storage, naming the three. Pure rules (default, stored address, safe keys) are in `shared/storage-delivery.ts`, used by the server driver **and** the CLI (`import` writes the same addresses). **The default changes behaviour** for S3/R2 sites without `publicBaseUrl` that had a public bucket: new rows get the app path instead of the bucket's address (old rows keep theirs). It is in the changeset's `### Upgrade` (`delivery: 'public'` keeps the old behaviour).
- **Stored address never expires.** `proxy` and `redirect` store `/api/cms/_media/raw/<key>` (the local driver's, with its configurable `local.publicBase`), so local → S3 keeps old rows working. Picture sizes were never stored: `<CmsImage>` builds `/api/cms/_media/img/<id>/<w>.webp` from the media id, which the image route serves from the driver in every mode. A signed address exists only in a `302` response.
- **Driver.** `StorageDriver.read(key, { range, ifNoneMatch })` returns a web stream with status (200/206/304/416), length, `Content-Range`, `ETag`, type; `get()` stays for small things (picture sizes, a resize's source). Local streams a `createReadStream` range; S3 forwards a single `Range` / `If-None-Match` to the bucket (several ranges are not forwarded — the whole file, as before). Real S3 and MinIO send no `Content-Range` on a 416: the driver asks with a HEAD. `presign(key, seconds)` signs a query-string GET with `aws4fetch`. Keys with `..`/empty segments are refused (a URL would resolve them into another bucket). aws4fetch's default of ten retries with growing pauses (~30 s) is now two, so a failing bucket does not hold a visitor.
- **Route.** `proxy`: headers as before (`nosniff`, `default-src 'none'; sandbox`, inline, immutable) plus `Accept-Ranges`, `Content-Range`, `Content-Length`, `ETag`, `Last-Modified`; S3 404 → 404, anything else (including a network error) → 502 "Media storage is not available" whose log line (`cms-errors`) carries only "S3 read answered 500" — no address, key or credentials; verified in the response and in the server log. Streaming uses `stream.pipeline` into the response, **not h3's `sendStream`**, which writes a web stream without waiting for drain and never cancels it when the visitor leaves. `redirect`: `302` to a 300 s signed address, `Cache-Control: private, max-age=240`; the app does not touch the bucket to answer. `HEAD` now works (a `.head.ts` next to the route; Nitro does not fall back from GET). Under `public` the route still serves app paths (rows from before a switch).
- **Other.** `NUXT_CMS_STORAGE_S3_FORCE_PATH_STYLE` is ignored (always path-style; documented). Under `public`, the first upload makes one anonymous HEAD of the file just stored and logs one line when it answers 401/403 — the optional startup check, done where an object is known to exist.
- **Everything that reads media.** `backup`/`restore` and `export`/`import` already used signed requests; `import` now takes its addresses from the delivery rule (tested into a private fake bucket: app paths in rows and rich text, archives hold keys, no address). The seed goes through the upload API. GC and delete work (object and `_w/…` copies removed, tested on both fake S3 and MinIO).
- **Tests** (all fail without the change). `test/unit/s3-delivery.spec.ts` (30): delivery default/stored address/safe keys, ranges and tags, local driver streaming, S3 driver against a fake S3 (full, ranged, suffix, 416, 304, 404, 500/403/503 → 502 without leaks, network error, traversal, presign valid/forged/stretched, `public` warning once and never under proxy/redirect), CLI settings, backup store. `test/helpers/fakeS3.ts` is a private-bucket S3: every request must carry a valid SigV4 signature (header or query, expiry checked, re-signed with aws4fetch), ranges/tags, generated objects of any size. `test/api/s3-delivery.spec.ts` (16): built playground servers in default (proxy), redirect and public mode — stored address in the media row, content API and library, headers, Safari-style ranges, 304, HEAD, 404, 502 and log leaks, picture sizes and delete, a 600 MB video (below), redirect, the `public` warning, a bad setting. `test/unit/transfer.spec.ts` +2 (import/export on a private bucket). `test/api/s3-minio.spec.ts` (5, runs when `TEST_S3_ENDPOINT` is set; CI starts MinIO `RELEASE.2025-09-07T16-13-09Z` in the `test` job): private bucket refuses anonymous reads; proxy whole/range/416/304/404; redirect presigned address accepted by MinIO, forged refused, ranges; sizes and delete; CLI storage.
- **Memory.** A 600 MB generated object through the proxy (built server, fake bucket): a reader that stops after one chunk makes the bucket stop at 9 MB sent (backpressure); a reader that leaves cancels the read from the bucket (`inFlight` 0); a full read grows the server's RSS by 120–150 MB (1 GiB: 121, 600 MB throttled: 150) — **not** with the size. That growth is Node's: a bare 20-line `fetch → pipeline → res` proxy in a separate process grows 65–125 MB on 600 MB (garbage collected late), `http.get` instead of `fetch` the same. The test therefore asserts < 300 MB on 600 MB (a buffering route would take 600). **Caveat for small pods:** the playground server idles at ~190–200 MB RSS, so a 256 MiB pod has little headroom for a few simultaneous large videos through `proxy`; `redirect` (bytes never pass the app) is the answer, and `deploying.md` says so.
- **Result.** `TEST_DATABASE_URL=… TEST_S3_ENDPOINT=… pnpm check`: typecheck (root, playground, starter, website) green; 70 files / 1028 tests passed, 16 skipped (already skipped before); build green.
- **Not done / left.** No browser check of the admin with a private bucket (everything the admin loads is the same `url`/`/img/` paths, covered by API tests). `redirect` serves from the storage's origin: no `nosniff`/sandbox headers and CORS only if the bucket has it (documented). A bucket that answers 403 (not 404) for a missing object — S3 without `ListBucket` permission — gives 502 instead of 404 on the raw route. Rows made under `public` are not rewritten when switching to `proxy` (they keep working while the bucket is readable); no command for that yet. The exact Pushbase CLI words for `provision`/`link` in `deploying.md` follow the brief and were not run.

### 0.2 D — Restore and client tool versions

Branch `fix/0.2-restore-pg-versions`. **Cause** (reproduced here with `pg_dump`/`pg_restore` 17 and 18 from Docker against the 16 server): pg_dump 17+ writes `SET transaction_timeout = 0;` into the dump's opening lines (the only difference to 16's; pg_dump 16.10+ and later also write `\restrict`, which psql of the same release knows). A 16 server answers `unrecognized configuration parameter`, and `pg_restore --exit-on-error` stops, after `resetSchemas` had already committed the emptying: the database was left empty. All backup specs that restore failed in CI, whose runner has 17+; locally the tools were wrapped in 16 containers, so it never showed.

- **One restore path.** `pg_restore -f -` (no connection) → `preambleFilter` → `psql -X -q -v ON_ERROR_STOP=1`. The reset (`DROP SCHEMA drizzle/public CASCADE`, `CREATE SCHEMA public`) is the first part of the same stream, so reset and restore are **one transaction**: any failure rolls back and the database is as it was (before: empty). `BEGIN`/`COMMIT` are written by us, not `psql --single-transaction`: psql commits at the end of its input, so a pg_restore that died half way would have its truncated script committed; `COMMIT` is only written after pg_restore exits 0 (a test cuts a script cleanly before the first `COPY` and fails if it is committed). Streamed, nothing buffered beyond a line.
- **The filter** drops `SET <name> …;` in the opening lines (up to the first line that is not blank/comment/`\restrict`/`SET`/`set_config`) when `<name>` is not in the **server's `pg_settings`**, so no list of version-specific settings is kept; later bytes are passed unchanged (data that looks like the setting is safe). It prints what it left out.
- **Before anything is touched:** `psql --version` (missing → help naming `TINYZOO_PSQL`), `pg_restore --version`, `pg_restore --list` (header `Dumped by pg_dump version`). A dump from a newer pg_dump than the pg_restore is refused with the versions and what to install; an older pg_restore that cannot open the archive at all ("unsupported version (1.16) in file header") gets the same refusal. Server major and settings are read before the question is asked.
- **Versions:** `pg_dump` ≥ the server's major; `pg_restore` ≥ the pg_dump that made the dump (the server's version does not matter: it never connects); `psql` any. Table in `docs/deploying.md`.
- **Also fixed:** `test/api/backup.spec.ts` hardcoded 0018 as the last migration (`expected 22 to be 19`, failing on main with 16/16 tools since 0019–0021); it now counts from the journal. The spec no longer skips in CI (`CI` set and tools missing → it fails).
- **CI:** local action `.github/actions/pg-client` installs `postgresql-client-N` from the PostgreSQL apt repository, sets `TINYZOO_PG_*` and prints the versions (runner PATH, the ones used, the server). The `test` job uses 17; a `backup-clients` job runs the backup spec with 16, 17 and 18 against the 16 server. *Not run here* (needs GitHub): the apt steps are the PostgreSQL project's documented ones.
- **Tests.** Backup spec 13 → 18 (the all-or-nothing test now expects an unchanged database; new: half-written script, script the server rejects, a setting the server does not know, newer dump than pg_restore (two ways), missing psql), `test/unit/restore-preamble.spec.ts` (9: filter incl. 1-byte chunks, CRLF, non-UTF-8 data, forms of SET; version parsing).
- **Result.** `TEST_DATABASE_URL=…/cms_pgver_test TINYZOO_PG_DUMP/RESTORE/PSQL=<docker wrappers> pnpm check` green for client tools 17 → server 16 and 18 → server 16: 73 files passed, 2 skipped; 1078 tests passed, 8 skipped (the backup spec runs: 18/18); backup spec alone also 18/18 with 16 → 16. One earlier full run reported an unhandled websocket 401 from `test/api/collab.spec.ts` (not touched here; passes alone, twice, and in both later full runs).

### 0.2 — Final audit: admin shell, accessibility, phone, media library

Branch `fix/0.2-audit-shell` (F3 of the audit fixes; reports in the audit's `accounts`, `media`, `pages`, `editing` folders). Rules are in `docs/ui-foundation.md` (Accessibility, First frame, When the account stops working); the changeset is `audit-shell-a11y-phone-media`. Measured on a production build of the playground (Chromium headless; 16 admin screens × desktop light, desktop dark, phone light, Czech):

| What | Before | After |
|---|---|---|
| Screens with a `<main>` | 0 / 48 | 48 / 48 |
| Screens with exactly one `<h1>` | 6 / 48 (the breadcrumb was an h1; editors had only the status bar) | 48 / 48 |
| Unnamed `nav` landmarks | 4 per screen | 0 |
| Screens with text under AA (4.5:1) | 18 / 48 (`text-dimmed` 2.58:1 light, 3.82:1 dark; styleguide buttons 1.78–2.02:1) | 0 / 48 |
| Phone screens with a control under 44 px | 16 / 16 | 0 / 16 |
| Hydration warnings on fresh page loads (cs desktop, phone, en) | 13 in 72 loads (post editor 11, page list 2; 4 routes × 6 × 3) | 0 in 120 loads (editor, page list, post list, media, settings) |
| English accessible names in a Czech admin | "Breadcrumb", "Notifications (F8)", "Show popup", Nuxt UI's close/next | none (checked: breadcrumb, notifications, selects, password toggle) |

- **Language.** The site's `<UApp :locale="useCmsUiLocale()">` (the starter and playground have it; `docs/upgrading.md` step 9): Nuxt UI keeps one language and takes it from the first component that asks (the toaster inside `UApp`), so the old plugin and the layout's provider were never read. The notifications area's name is not part of Nuxt UI's locale and is set by the admin layout. The invitation page, the account page and the reset page speak the page's language through `cmsIssueMessage`; the account page marks the field instead of a "Validation failed" toast; the design system page is admins-only (a typed address goes home), its chrome is translated, its prose stays English with a note saying so.
- **Cause of the hydration warnings:** `UDashboardGroup storage="local"` — the sidebar's width and fold were read from localStorage in the first client frame (the server cannot); it is a cookie now. Relative times were already absolute in the first frame (`CmsTime`).
- **Touch:** one `@media (pointer: coarse)` block instead of `pointer-coarse:` classes per button (the sidebar's slide-over rows, which are not buttons, use the Tailwind variant). The page tree's fold and menu, the list rows' menus, the editor toolbar (a swipeable row of 44 px buttons), the account fields, Team's Edit are all covered by it.
- **Signed out under an open admin** (`plugins/cmsSignedOut.client.ts`): a 401 on a read of `/api/cms/*` sends the person to sign-in with "You were signed out" and back afterwards (tried: disable the editor while the editor's tab is open, click "Articles"). Saves are left to the editor (it keeps the text). A 403 on a list says "You don't have permission for this" with no retry (`CmsLoadError`).
- **Not done / for later.** The admin search palette still shows nested pages without their address (needs the address in `/api/cms/_search`); a Playwright run of the admin is not part of `pnpm check` (only the contrast test is): the surveys above were scripts. The "Notifications (F8)" name is a DOM attribute set after mount (Nuxt UI does not pass the label to its viewport). The audit's phone-editor Save button, the read-only forms and the history/translation items belong to the editor batch.


### 0.3 — Dependency updates with Renovate

Branch `ci/renovate`. Why: dependencies were updated by hand, and only when something broke (sharp 0.35 came from a conflict on the pitch sites). `renovate.json` at the root; how to handle the pull requests is in `CONTRIBUTING.md` ("Dependency updates").

- **Renovate, not Dependabot.** Renovate updates the overrides in `pnpm-workspace.yaml` together with the packages (checked: it reads `@tiptap/core`, `@tiptap/pm` and the three ProseMirror overrides), groups by rule, keeps a dashboard issue and deduplicates the lockfile after an update. It needs the Renovate GitHub app on the `tinyzookeeper` organization (one install by an owner; until then the file does nothing).
- **Weekly:** Monday 00:00–06:59 Prague time, lock file maintenance included.
- **Grouping:** all patch updates and the minor updates of packages at 1.0 or later in one `minor and patch updates` pull request. Majors stay one pull request per package (or monorepo, e.g. the three `@hocuspocus/*`). A **minor update below 1.0 counts as a major** (`matchCurrentVersion >= 1.0.0` for the group): `drizzle-orm` 0.44 → 0.45 and `nuxt-auth-utils` 0.5 → 0.6 change behaviour like majors and come alone.
- **Lockfile:** every pull request updates `pnpm-lock.yaml` with the `package.json` it changes, deduplicated (`pnpmDedupe`), so `pnpm install --frozen-lockfile` in CI passes. Updates within the written ranges change only the lockfile, so the weekly group needs no changeset; one that changes a published package's `package.json` fails the `changeset` check until a changeset is pushed to its branch (intended: a raised range is something sites see).
- **Editor stack** (`@tiptap/**`, `prosemirror-*`, `y-prosemirror`, `yjs`) is one group, so the packages and the single-copy overrides move together.
- **Not proposed:** major versions of the `postgres` image (CI, `compose.yaml`, the starter's compose file; 16 is the tested server). npm releases wait three days (`minimumReleaseAge`, npm only: Docker Hub tags carry no release date there, and the rule would hold them forever).
- **Checked:** `renovate-config-validator --strict` passes. A local dry run (`renovate --platform=local --dry-run=lookup`, Renovate 44.249.1) on this branch proposes: one weekly group (pg, @types/pg, ws, pnpm 10, @nuxt/kit, image-size, tsx, zod, drizzle-kit, @internationalized/date, @nuxt/ui, nuxt, tailwindcss, @iconify-json/lucide); separate pull requests for drizzle-orm 0.45, nuxt-auth-utils 0.6, ioredis 6, nodemailer 10, @hocuspocus 4, TypeScript 7, Vitest 5, vue-tsc 3, pnpm 12, Node 26 and Valkey 9 images, Mailpit; the editor group (yjs); the seven Postgres 18 updates filtered out as disabled. GitHub Actions versions need a token to look up, so the dry run without one could not list them; the app has one.
- **Result.** `pnpm check`, `pnpm check:starter`, `pnpm check:upgrade`, `pnpm check:consumer`: all four green on this branch. The first `pnpm check` run had two failures in API specs this branch does not touch (the known unhandled websocket 401 from `test/api/collab.spec.ts`, and `scheduled.spec.ts` "does not announce an ordinary publish twice", a timing test) while three other suites ran on the same machine; the rerun passed: 94 files / 1236 tests passed, 26 skipped. Starter: seeded twice, served, reset. Upgrade: green from `2506403` and the latest release tag (162.7 s). Consumer: built from the tarballs.
- **Left.** Installing the app (organization owner). The first run opens the dashboard issue and the pull requests above; the 0.3 dependency branch already does drizzle, nodemailer, ioredis, hocuspocus and nuxt-auth-utils, so those disappear once it is merged.

### 0.3 — The admin's templates are type-checked

Branch `fix/0.3-vue-tsc`. Why: vue-tsc 3 found 46 errors in the layer's Vue templates (`packages/cms/app/**`), and `pnpm typecheck` reported none. The layer was not left out: the playground's `.nuxt/tsconfig.app.json` includes `../../packages/cms/app/**/*` (forms' `CmsForm.vue` comes in through the components), and its `nuxt typecheck` ran `vue-tsc -b --noEmit` over it. **Cause:** the playground and the website had vue-tsc 2.2.12, which writes its template types to `node_modules/.vue-global-types` next to the first `node_modules/vue/package.json` above the tsconfig. pnpm does not hoist `vue` into `playground/node_modules` or the root, so vue-tsc 2 gave up without a word and checked only the `<script>` blocks (a `const x: number = "s"` failed, `{{ title.nope.x }}` passed).

- **Setup.** The playground and the website move to vue-tsc `^3.3.14`, the version the starter already had (the lockfile drops vue-tsc 2 and its Volar packages). `pnpm typecheck` is unchanged: `nuxt typecheck` prepares `.nuxt` itself (fine on a fresh clone and in CI's `check` job) and now checks templates. No added time: `vue-tsc -b --noEmit --force` takes 7.1–7.7 s for the playground and 6.7–7.3 s for the website with either version. A template error put into `CmsMoment.vue` on purpose made `pnpm typecheck` fail (exit 2, file and line) and was taken out.
- **What it found.** Layer, 46 errors: `[entity]/[id].vue` 9, `[entity]/index.vue` 7, `CmsPreviewPanel` 4, `CmsTreeList` 3, `CmsRichTextEditor` 3, `CmsFieldDate` 3, `team.vue` 2, `CmsFieldColor` 2, `CmsDayPicker` 2, and 1 each in `styleguide.vue`, `media.vue`, `CmsSingletonForm`, `CmsRevisions`, `CmsPublishReview`, `CmsPasswordInput`, `CmsMoment`, `CmsListFilters`, `CmsFieldText`, `CmsFieldRelationOne` and `CmsFieldGallery`. Playground, 29: `blog/index.vue` 15, `blog/[slug].vue` 13, `index.vue` 1. Website, 1: `SearchPalette.vue`.
- **Fixes.** 41 are inline `@click` handlers on `UButton` that return a value (`open = false`, `page++`, `save()` → `Promise<boolean>`): vue-tsc 3 compiles them to `$event => (expr)`, as Vue does, and Nuxt UI 4.9 types `onClick` as returning `void | Promise<void>`. They are written `() => { … }` now (the editor's undo/redo use `editor?.`, because the toolbar's `v-if` does not narrow inside a function). Nuxt UI 4.10 accepts these handlers. Moving the lockfile to it added about 2,000 lines (a second `@nuxt/schema`, `@nuxt/icon` 2.6, icon bundling) and is left to a dependency update. Nothing waits on these handlers' promises (`form.submit` catches its own errors and no button uses `loading-auto`). The calendar's month arrows (date field, day picker) and the website's palette close button pass `aria-label` through props Nuxt UI types as `ButtonProps` only but `v-bind`s onto the button. Each is one `as ButtonProps` with a comment, and 4.12 still types them the same way. The colour field gave `UInput` a `null`, which it does not take; it gets `undefined` (same empty box). The playground's blog pages type their fetches with the generated client (`Post`, `SiteSettings`, `ListResponse`).
- **Real bugs.** None in the layer: every layer finding was a type the runtime already handled. Playground: the home page read a `loggedIn` that was never defined, so its button always said "Sign in"; it uses `useUserSession()` now.
- **Docs.** `docs/development.md` says what `pnpm typecheck` covers, why it needs vue-tsc 3, and the `() => { … }` habit; CONTRIBUTING's CI table says so too. The docs check still checks only the `<script setup>` of Vue examples (unchanged).
- **Result** (`TEST_DATABASE_URL=…/cms_test_vuetsc`, no Redis): `pnpm check` green, typecheck (root, docs, playground, starter, website) then 94 files / 1236 tests passed, 3 files / 26 tests skipped, 197 s. `pnpm check:starter` green (62 s). `pnpm check:upgrade` green: 2506403 → current and tinyzoo@0.2.2 → current (159 s). `pnpm check:consumer` green (39 s).
- **Not done / left.** No browser run of the admin. The changed handlers do the same thing, and the API tests build and serve the admin. The starter's own typecheck still hides findings in the layer (a site's check should show only its own files); the layer now has none there either. Once Nuxt UI is at 4.10 or later, the `() => { … }` form is no longer needed (it still works).

### 0.3 — Dependency upgrades: drizzle, nodemailer, ioredis, Hocuspocus

Branch `chore/0.3-deps`, one commit per dependency (each commit's message lists the upstream breaking changes and which of them apply). Why: the 0.3 batch starts from current versions of what tinyzoo runs on; four of the five asked-for upgrades are in, `nuxt-auth-utils` 0.6 is not (below).

| Dependency | From → to | What applied to tinyzoo | Changeset |
|---|---|---|---|
| `drizzle-orm` / `drizzle-kit` | 0.44.7 → 0.45.4 / 0.31.10 → 0.31.11 | Nothing in the code. 0.45.2 escapes `sql.identifier()`/`sql.as()` (an SQL injection fix); tinyzoo passes only its own names there. No snapshot change: `tinyzoo generate` against test databases writes no migration for the playground, the starter and the website, and the upgrade check's sites get none either. Sites must raise `drizzle-orm` themselves (it is in their `package.json`, and `tinyzoo upgrade` checks it). | minor, `### Upgrade`; `docs/upgrading.md` gains "From 0.2 to 0.3" |
| `nodemailer` | 7.0.13 → 10.6.0 | Nothing in the code (8: `NoAuth` → `ENOAUTH`; 9: TLS checks when fetching remote content, unused; 10: TypeScript, Node 20). It ships its own types, so `@types/nodemailer` is dropped. The SMTP transport had no test: `mail-delivery.spec.ts` now sends to a small SMTP server inside the test (plain and with `AUTH PLAIN`) and checks envelope, encoded subject, reply-to, both bodies and credentials, on 7 and on 10. | patch |
| `ioredis` | 5.11.1 → 6.0.0 | 6 speaks RESP3 by default and opens with `HELLO 3`, falling back to RESP2 only on Redis' own refusals; a proxy that answers otherwise fails the connection and the store would quietly run on memory. tinyzoo needs nothing from RESP3, so its connections pass `protocol: 2` (`REDIS_PROTOCOL`), checked with `CLIENT LIST` on Valkey 8 (`resp=2`). ZRANGE's stop is typed `string` now (`'-1'`). Reply shapes are unchanged (`replyMapping: "legacy"`). | patch |
| `@hocuspocus/server`, `provider`, `extension-redis` | 3.4.4 → 4.8.0 | `handleConnection()` takes a WebSocket-like object and a web `Request` and no longer listens to the socket: `api/cms/_collab/socket.ts` feeds it from the crossws `message`/`close` hooks (as Hocuspocus' own server does), with the public `peer.websocket`/`peer.request`; frames that arrive while the server starts are queued instead of lost. Hocuspocus 4 no longer pings and closes a connection silent for 60 s: the handler pings every collab heartbeat and counts the pong as activity, so a quiet background tab stays connected. `onStoreDocument` reads the last typist from `lastContext`. A tab open during a deploy (provider 3) works against server 4. | patch |

- **Copies.** One `drizzle-orm`, `drizzle-kit`, `nodemailer` and `@hocuspocus/*` each. `ioredis` 5 stays in the lockfile through `@hocuspocus/extension-redis` (pins `~5.6.1`, used only when no `createClient` is given — tinyzoo gives one) and nitropack (unstorage); tinyzoo's own code and the Redis extension's clients run on 6.
- **Where the versions live.** Root, `packages/cms` (dependencies), playground, website, starter (which `tinyzoo init` copies, so new sites get them), and the consumer check (reads the playground's). Not touched: the `drizzle-orm 0.44.7` fixture in `upgrade-cli.spec.ts` (test data for the version check).
- **Checks** (each commit, `TEST_DATABASE_URL=…/cms_test_deps`, starter and upgrade databases likewise; from the ioredis commit on with `TEST_REDIS_URL` on a throwaway Valkey 8, so the store specs and `collab.spec.ts` ran against Redis; upgrade baselines `2506403` and `tinyzoo@0.2.2`):

  | Commit | `pnpm check` | starter | upgrade | consumer |
  |---|---|---|---|---|
  | drizzle | 94 files passed, 3 skipped; 1236 tests passed, 26 skipped | green | both green, no migration written | green |
  | nodemailer | 94 / 3; 1238 passed, 26 skipped (+2 SMTP) | green | both green | green |
  | ioredis | 95 / 2; 1241 passed, 23 skipped (with Redis the store specs and the Redis tests in `changes.spec.ts` run: verified with the verbose reporter) | failed once ("the site did not print a setup code": the code is printed asynchronously after start and the starter site uses no Redis), green on the rerun | both green | green |
  | Hocuspocus | 95 / 2; 1241 passed, 23 skipped (`collab.spec.ts` 16 against Redis) | green | both green (upgrade check with Redis too) | green |

  The four checks ran once more, with Redis, on the branch's last commit before the pull request opened; its description has the result.

- **Also fixed: a race in the collab heartbeat** (own commit, patch changeset). The heartbeat collects documents with a writer, waits on the database for each connection's re-check, then marks them "being edited"; a last tab that left during those waits had already marked its document idle, and the late write made it active again until the 90 s window ran out. It now marks only documents that still have a writer, beats do not overlap, and the last tab's disconnect waits for a beat in flight. Found while chasing one failure of `collab.spec.ts` ("the document did not settle") in a full `pnpm check` on the Hocuspocus commit: **not proven to be that failure's cause** (no repeat in 10 runs with or without the fix, heartbeat down to 50 ms). The other reading: under load, a Redis presence query that times out (500 ms) counts as "someone else is here", by design.

- **Not done: `nuxt-auth-utils` 0.6.** 0.6.0 is a rewrite onto `nuxt/server` for Nuxt 5: it needs **Nuxt ≥ 4.6** (the workspace is on 4.4.8; the move also takes every site from Vite 7 to Vite 8 and Nitro 2.13.4 to 2.13.6), seals sessions with a secret derived from **`NUXT_APP_SECRET`** in a new `nuxt-auth-session` cookie, **ignores `NUXT_SESSION_PASSWORD`** and signs everybody out once; `seal`, `crypto`, `generateId` and the session header are gone, and sessions are read-only in WebSocket handlers. Password hashes do survive (same adonisjs scrypt). A trial on a scratch branch (Nuxt 4.6.4 + 0.6.2) typechecked, but every sign-in failed with "`appSecret` is not set" until the environment changes. Doing it means: the Nuxt 4.6 / Vite 8 upgrade as its own piece, then tinyzoo's session handling (cookie name in `cmsSession.ts`, the production start check, the realtime and collab socket admission), the test servers, the starter and upgrade checks, `.env.example` files, `deploying.md`, and a `NUXT_APP_SECRET` set on every deployed site (the website, the demo and the pitch sites) before it ships, with an `### Upgrade` that says admins sign in again. That is a slice of its own, not a dependency bump; the peer stays `^0.5.29` (0.5.34, the last 0.5, fits it and has the OAuth state fixes for sites that use OAuth). Done in 0.4: "0.4 — nuxt-auth-utils 0.6 and Nuxt 4.6" below.

### 0.3 — Change an account's email

Branch `feat/0.3-change-email`. Why: neither **Your account** nor **Team** could change the address an account signs in with; a person whose mailbox changed had to be removed and invited again, and what they had written then no longer pointed at their account. Anything touching sign-in gets an independent review before merge.

- **Self-service** (`/api/cms/_auth/email`: `POST` ask, `GET` the pending change, `DELETE` cancel; `GET /email/:token` what the page shows; `POST /email/confirm` make it). Asking needs the **current password**. A wrong one is a 422 on the field and an `account.email_failed` audit entry, and counts against the **same limits as failed sign-ins** of that account (`login:email:<address>` 10 / 15 min, `login:ip` 30), refunded on success as sign-in does — so this is not a second door for guessing the password (tested: ten wrong ones, then 429 here *and* at sign-in, even with the right password). Successful requests (each sends two emails): 5 an hour per account, 3 an hour to one address whoever asks (`email-change:to:<address>`, no flooding a stranger's mailbox), 10 an hour per client address.
- **The link.** Same pattern as invitations and resets: `cms_tokens` row of kind `email`, only the SHA-256 of a 256-bit secret stored, **24 hours**, single use claimed atomically (`UPDATE … WHERE used_at IS NULL RETURNING`). Opening `/admin/email/<token>` changes nothing (mail scanners open links); a button POSTs. **Signed in or not**: the password was checked when asking, the link proves the new mailbox, and it is bound to one account and one address — requiring a sign-in would only make people sign in on their phone with the address they are leaving.
- **Where the new address waits: `cms_state`**, key `email-change:<userId>`, value `{ tokenId, email, sv, expiresAt }` — not a new column, so **sites need no migration** and parallel 0.3 slices do not collide in the drizzle journal. One row per account: a newer request replaces it (and marks older email links used), confirming or cancelling deletes it, removing or erasing the account deletes it (cms_state has no cascade; both paths do it explicitly), reading it deletes it once it can no longer happen (`readLiveEmailChange`: its own link used or expired, the session version moved on — guarded by `tokenId`, so an old link never deletes a newer request), and the daily retention run deletes expired ones. The link works only while `tokenId` is the recorded one (**superseded** → 410), before expiry, and while the account's **session version** is the recorded `sv` — so a password change or reset, disabling or a role change **cancels** a pending change. That is what the notice to the old address advises ("if it was not you, choose a new password").
- **Normalisation and uniqueness.** `emailSchema` (trim, lower-case, valid) plus 254 characters. Taken = any other row in `cms_users` (invited, active or disabled) or the demo account's address. Checked again at the link, and the `cms_users_email_unique` index is the backstop for two confirmations of the same address at once (unique violation → 409; tested deterministically: the test holds one account's `cms_users` row with `FOR UPDATE`, so its confirmation passes the "taken?" check and waits at its update while the other account confirms; released, it hits the index and answers 409 with its link claim rolled back). **Not revealed to the person asking**: the answer to a taken address is the same, the change is recorded the same, the lookup and the emails happen after the response (`event.waitUntil`, as `forgot`); the owner of the taken address gets an "already has an account here" notice instead of the link (`inUse: true` in the audit entry, visible to administrators only). Someone who confirms a link whose address was taken meanwhile is told (409): they own that mailbox.
- **Old address told twice, first**: when the change is asked for (before the link goes to the new address; a "choose a new password" button, the new address masked, `j…a@example.com`, a short name only `j…@`: the old mailbox may now be someone else's) and when it is made. After the change every `reset` and `email` link of the account stops working — a reset link waiting in the old mailbox would otherwise still open the account (tested).
- **The way back.** The "your email was changed" notice carries **Undo the change** (`cms_tokens` kind `email-revert`, hashed, **7 days**, single use; the address to restore in `cms_state` `email-revert:<userId>:<tokenId>`). `/admin/email/revert/<token>` shows the address (GET changes nothing); its form POSTs `/api/cms/_auth/email/revert { token, password }`, which restores the old address (409 when another account has it now, nothing changes), **sets the new password in the same step** (the person who made the change knows the old one: restoring only the address would let them straight back in, and a reset link handed over afterwards leaves that window open), bumps the session version, ends every `reset` and `email` link and the pending change, ends the ways back of *later* changes (they would undo this) but not of earlier ones (after A → B → C, A's link still restores A, whichever is used first), signs the browser in as a reset does, and is audited (`account.email_revert`, `email` restored, `previousEmail` replaced). Unlike other kinds, issuing one does not end earlier ones. The trade-off, said in the email and the manual: whoever reads the old mailbox within 7 days can take the account back, so a handed-over mailbox should have that email deleted.
- **Sessions** follow the password-change precedent: confirming bumps the session version, so every session of the account ends; a browser signed in to **that same account** that opens the link is re-signed with the new address (`/api/_auth/session` shows it at once), a browser signed in as someone else is left alone, a signed-out one stays signed out ("sign in with your new address").
- **Administrators** (`PATCH /api/cms/_users/:id` with `email` and `password`; Team row menu → **Change email**, a dialog with the field, **your password** and their errors). Admin-only by `requireCmsAdmin` (editor, author 403; anonymous 401), and the acting administrator's **own password** (missing or wrong: 422 on `password`, `account.email_failed`, counted against the sign-in limits of the administrator's address and refunded on success). Links are resolved before anything changes (no public URL in production: 500, nothing changed). Takes effect at once (the administrator vouches), ends the person's sessions, ends their reset/email/invite links and a pending self-service change, tells the old address (masked) and the new one ("sign in with this address") — a **disabled** account gets neither (it can't sign in). The notice to the old address has **no** way back: the old mailbox is often why an administrator changes the address (left, handed over), and a link there would hand the account to whoever reads it; the protection is the administrator's password, and whoever has that can do more than this anyway. For someone **invited** the invitation is re-issued to the new address and the old link dies (the mistyped address hears nothing more); the response carries the link as resending does. **Your own email is not changed through Team** (409 `self`, as for your own role): it goes through the account page, password and link, so being an administrator never skips the confirmation. The demo account keeps its address (403).
- **Audit.** `account.email_request` (`meta.email` new, `meta.previousEmail` old, `inUse` when taken), `account.email_failed` (`ip` only), `account.email_cancel`, `account.email` (on the account), `account.email_revert`, `user.email` (actor = administrator, `recordId` = the person). Privacy: `auditCondition` also matches `previousEmail`, so a lookup by the **old** address finds the change. Erasure takes out only the keys that hold the erased address from entries found by it (the other address may be someone else's now), and both addresses from the erased account's own changes, except the other account's address of an `inUse` request. The export (`auditExportMeta`) shows the other address of a change only when the entry is about the person's own account (and not the `inUse` one), otherwise `(another person’s address)`. Lookup, export and erasure also find a change waiting for the address and a way back to it (`cms_state`; lookup `emailChanges`, export `emailChanges`, erasure deletes them). `docs/deploying.md`'s privacy table says what is kept.
- **Admin UI** in cs/en/de: a **Sign-in email** section on the account page (current address, new address, password, the pending change with what to do if the email does not come, **Cancel the change**), the `/admin/email/<token>` page (confirm, done, expired, taken), the `/admin/email/revert/<token>` page (new password; expired, taken), Team's dialog (with your password; a disabled account's text says no email goes out), a line on **Privacy** when a change names the address. Labels on every field, errors on the field (`role="alert"`, focus moves there), touch targets from the shared `pointer: coarse` rule. The account page reads the pending change after mount, not with `await useFetch` in setup: the await shifted Nuxt UI's `useId` between server and browser and left every label of the page pointing at no field (found in the browser; `main`'s page was fine). Emails in cs/en/de (`layout` now also takes notices without a button). Czech manual: `prihlaseni-a-ucet.md` gets **Změna e-mailu** (steps, the link, when it does not arrive, what to do with each of the two emails to the old address, **Vrátit změnu** and why not to pass that email on) and Team's **Změnit e-mail** (your password, disabled accounts); `soukromi.md`, `kdyz-neco-nefunguje.md` and the README follow.
- **Tests.** `test/api/email-change.spec.ts` (36): wrong password (422, nothing sent, audited), shared sign-in limit, same/malformed address, anonymous; the whole flow (link to the new address from `publicUrl`, masked notice to the old, page info, confirm signed out, sessions ended, new address signs in and old does not, changed-notice, single use, audit rows); confirm in the same browser keeps it signed in with the new address; another account's browser untouched; superseded, cancelled, cancelled by a password change, expired, made-up; reset link to the old address dies; taken (an active and an invited account) answered like a free one, notice instead of link; taken meanwhile and the parallel race; demo; admin change (sessions, both notices, audit), editor/author/anonymous refused, own account refused, taken (active, invited, demo), invited re-invite, admin change cancels a pending self-service one; privacy lookup by the old address and erasure of both addresses and the pending row. Added with the review: the unique-index path (row lock, above); each link kind (`email`, `reset`, `invite`, `email-revert`) refused at every other kind's endpoints and accepted at its own; disabling and a role change cancel a pending change; an ended session (401, nothing sent); a dead pending row deleted on read, expired rows swept by retention; the per-account, per-address and per-client limits; `Sec-Fetch-Site: cross-site` refused on every new POST/DELETE/PATCH; the attack and the way back end to end (old notice carries the link, GET changes nothing, password required, restored, all sessions and the intruder's reset and further change dead, old password and their address refused, single use, audit row); the A → B → C order of ways back both ways; refused when the old address is taken and when expired; removed with the account; the admin's password (missing, wrong: nothing changes, audited; right: works); a disabled account gets no email; export redaction and erasure of only the erased address (an old address someone else has now; both sides of an `inUse` request); a pending change found, exported and erased by its address. `test/unit/email-change.spec.ts` (16): when a link may be used, when a pending change is dead, the stored shapes, masking (short names), unique-violation detection. `sentMail` in the test helpers skips a file the server is still writing.
- **Review** (independent security review of this PR, findings fixed on the branch). **M1** the old address could not undo a confirmed change: with only the password, someone could ask for a change to their own address and confirm it at once, which ended the owner's sessions and sent resets to them, while the request notice promised a new password would cancel it → the way back (above), the request notice reworded ("someone knows your password … if it was confirmed already, another email comes with a link that undoes it"); deliberately not on an administrator's change (above). **L1** the privacy export showed the other address of a change to the person found only through one of them → `auditExportMeta`. **L2** pending rows in `cms_state` lived forever and privacy did not see them → deleted when found dead, swept by retention, found/exported/erased by address. **L3** mail bombing was limited only per account → also per address written to and per client. **L4** Team's change built its links after the commit → before. **L5** an administrator changed someone's email without a step-up → their own password. Nits: a disabled account no longer gets "sign in with it" emails; erasing the person who now holds someone's old address no longer erased that someone's current address from their change; short names are masked to their first letter; the old address is told before the link goes out; a wrong comment on the confirmation page. The test gaps it listed are covered (see Tests).
- **Second review** (independent, after the fixes): no High. **M-a** an undo told nobody, so whoever reads an old mailbox (a successor at a work address) could take the account back silently → the address it replaces gets a notice (`emailRevertedNotice`, no link). **M-b** an administrator's change left earlier ways back working → the PATCH ends them (`endRevertLinks`). **M-c** an attacker in an *administrator's* account could block the way back by giving the old address to another account (invite, move) → while a way back works, its address counts as taken for invitations, administrators' changes and requests (`emailReserved`); erasure by address still removes it, so for administrator accounts the undo is no full answer: they need a second factor (Wave 4 or later). **L-a** two links of one account used at once could deadlock (500) → confirm and revert lock the account's row first. **L-b** confirm's "address taken" path cancelled a newer request too → it ends only its own link and request. **L-c** the step-up test did not prove the sign-in budget → an eleven-attempt test with its own administrator. Nit: `endRevertLinks` keeps the time a link was used. Tests: +3 (`email-change.spec.ts` 39), one privacy test now lets the way back expire before the old address is reused.
- **Result.** `TEST_DATABASE_URL=…/cms_test_email pnpm check`: typecheck (root, docs check, playground, starter, website) green; 96 files / 1264 tests passed, 3 files / 26 tests skipped (skipped before too). `pnpm check:starter` green (packed starter initialised, seeded twice, served, reset). `pnpm check:upgrade` green (baseline 0.1.0 → this commit: `tinyzoo upgrade` without a terminal, nothing pending, the old account signs in, content and files unchanged, every entry opens and saves; no migration was generated for this change). `pnpm check:consumer` green (installed from the tarballs and built). After the review (`…/cms_test_emailfix`, no Redis): `pnpm check` green, typecheck then 96 files / 1288 tests passed, 3 files / 26 tests skipped (184 s); `pnpm check:starter` green (54 s); `pnpm check:upgrade` green, still no migration (172 s); `pnpm check:consumer` green (43 s).
- **Not done / left.** No Playwright spec for the three screens: they were checked by hand in a production build of the playground (Czech: wrong password on the field, the pending notice, cancel, the confirmation page and its expired view, Team's dialog with a taken address on the field; every label tied to its field). Once merged with the template typecheck (0.3, above), `pnpm typecheck` found one handler in Team's dialog returning a value (`@click="emailTarget = null"`), now `() => { … }`; the rest passed. The 5-an-hour limit lets a signed-in person send a few confirmation emails to addresses of their choosing, as an administrator's invitations do.

### 0.4 — `tinyzoo upgrade` says what to do when there is no migration

Branch `fix/upgrade-next-steps`. Found while moving the four pitch sites to 0.3.0: `tinyzoo upgrade` printed "No schema changes, nothing to migrate" and then "Next: 1. Read the new migration in server/db/migrations". It now compares the drizzle journal before and after generating: without a new migration the first step says so (and points at step 4 for earlier ones still waiting); with one it names the file. `nextSteps()` in `cli/upgrade.ts`, two unit tests in `test/unit/upgrade-cli.spec.ts`.

### 0.4 — nuxt-auth-utils 0.6 and Nuxt 4.6

Branch `feat/0.4-auth-utils-06`, two commits: `chore(deps): Nuxt 4.6`, then the nuxt-auth-utils move. Why: 0.3 left nuxt-auth-utils on 0.5 (above), and real sites already run Nuxt 4.6.4 with tinyzoo. The release that has this is 0.4.0 (minor, breaking on 0.x: the peer ranges rise and everyone signs in again once).

- **Nuxt 4.4.8 → 4.6.4** (Vite 7.3.6 → 8.3.8, Nitro 2.13.4 → 2.13.6) in the workspace, playground, website, starter (so `tinyzoo init` gives new sites 4.6) and the consumer check (reads the playground's). `@nuxt/kit` ^4.6.4 and tinyzoo's `nuxt` peer ^4.6.4 (the peer was ^4.6.0 until the review, below): with the old range pnpm kept a second Nuxt 4.4.8 for the layer itself. Lockfile deduplicated; one copy each of `@tiptap/core`, `@tiptap/pm`, `prosemirror-model`, `-state`, `-view`.
- **What Nuxt 4.6 broke under the layer (found by `pnpm check` on the first commit).** Modules' server plugins now reach Nitro after `nitro:config` (`nuxt.options._serverPlugins`, collected by `@nuxt/nitro-server`), so the filter that drops nuxt-auth-utils 0.5's WebSocket plugin stopped matching, and **every anonymous response got a session cookie** again (`anonymous-cookies.spec.ts`, `login-post.spec.ts`). That means sites already on Nuxt 4.6 with tinyzoo 0.3 (the pitch sites) send that cookie on every page today; 0.4 fixes it. The first commit moves the filter to `nitro:init`; the second removes it, since 0.6 has no such plugin. Also: 0.5's types make `runtimeConfig.session.password` required on Nuxt 4.6 (a cast for one commit).
- **nuxt-auth-utils 0.5.29 → 0.6.2**, peer ^0.6.2. Read against its README ("Migrate from v0.5") and source, not only the changelog:
  - The cookie is `nuxt-auth-session` (`nuxt-session` is now Nuxt's own `useSession()` default; nuxt-auth-utils refuses that name and falls back to its own). `sessionCookieName()` follows (and treats a configured `nuxt-session` the same way), so the "no cookie, no session read" rule (no cookie for anonymous visitors) holds.
  - Sealing: Nuxt's `useSession` with `deriveSecret('nuxt-session:<name>')` = HKDF-SHA256 over `appSecret` (salt `nuxt`). `appSecret` must be a string of ≥ 32 characters, nothing more is checked; a build never generates one, `nuxt dev` does (`.nuxt/app-secret`).
  - WebSocket handlers: the session is read-only there. tinyzoo's realtime and shared-editing sockets only read it in `upgrade` (`admitAdminSocket`), so nothing changed; a stale cookie on a socket is refused, not cleared.
  - Removed `seal`, `crypto`, `generateId`, the session header: tinyzoo used none. `maxAge` now counts from the last write (sign-in, name, email or password change), was from creation; tinyzoo keeps its own sign-in time in the session so the admin's 14 days still count from signing in (the review's M1, below). The cookie now carries `Max-Age` only (0.5 sent `Expires` too; `security.spec.ts` read only that and failed on the first full run, it reads either now); the sealed session has the same 14-day limit on the server. Password hashes: the same adonisjs scrypt, `hashPassword`/`verifyPassword`/`passwordNeedsReHash` unchanged, so accounts survive (the upgrade check signs in with the old account).
- **NUXT_SESSION_PASSWORD as a stand-in for NUXT_APP_SECRET (deprecated, removed in 0.5).** Evaluated, and sound with one constraint:
  - *Where.* Nitro reads the environment into its runtime config once, when its config module is evaluated, and deep-freezes it; `deriveSecret` reads `useRuntimeConfig().appSecret` from that frozen object. A Nitro plugin runs too late, and nuxt-auth-utils strips a `password` from the session config, so there is no option to pass. So the module adds a Rollup transform (`appSecretFallback` in `module.ts`) that puts a few lines at the top of `nitropack/dist/runtime/internal/config.mjs` in the server bundle: when neither `NUXT_APP_SECRET` nor `NITRO_APP_SECRET` is set (and `runtimeConfig.appSecret` is empty at build time), `NUXT_SESSION_PASSWORD` is copied to `NUXT_APP_SECRET` before Nitro reads it. A build where that module is not found says so (no fallback, the start check then names the variable).
  - *Safe?* A set app secret always wins, so a site that already sets `NUXT_APP_SECRET` (the pitch sites, for nuxt-og-image's signed image URLs) is untouched. A site without one gets its session password as the app secret: other modules then derive their keys from it too, which is what an app secret is for; there is no second use of the same key, since every user derives its own key from the secret (HKDF, by purpose) and 0.6 no longer seals anything with the password directly. Length: tinyzoo has refused to start with a session password under 32 characters since 0.2, Nuxt asks the same of an app secret. Nitro parses environment values as JSON where it can (`destr`) for both names alike; the start check names a value that came out as an object or list.
  - *What sites see.* The start check (`cms-0-config-check.ts`) now checks the app secret (≥ 32 characters, text), names `NUXT_SESSION_PASSWORD (used because NUXT_APP_SECRET is not set)` when the stand-in is too short, and otherwise logs once `[tinyzoo] deprecated: NUXT_SESSION_PASSWORD is used as the app secret … Rename the variable to NUXT_APP_SECRET; with the same value nobody is signed out again.` nuxt-auth-utils prints its own "not used anymore" line next to it. Renaming with the same value keeps the sessions (tested).
- **`tinyzoo upgrade`** checks `nuxt-auth-utils` too (with `nuxt`, `@nuxt/ui`, `drizzle-orm`, `zod`), so a site that bumped tinyzoo but not 0.5 is told.
- **Tests.** `start-checks.spec.ts`: no/short/JSON `NUXT_APP_SECRET` refused by name; only `NUXT_SESSION_PASSWORD` → starts, one deprecation line, setup and sign-in work with a `nuxt-auth-session` cookie; the same server restarted with `NUXT_APP_SECRET` = the old value accepts that cookie, without the warning; a different `NUXT_APP_SECRET` next to the old variable wins (the cookie no longer opens the admin, no warning); a short stand-in is refused naming both. `anonymous-cookies.spec.ts`: the 0.3 cookie (`nuxt-session=…`) opens nothing, fails nothing and sets no cookie. The test servers, the starter check and the docs use `NUXT_APP_SECRET`.
- **Upgrade check.** The old site gets the variable its own starter documents (`.env.example` of the baseline: `NUXT_SESSION_PASSWORD` for 2506403 and 0.3.0), and the upgraded site the **same environment**, as a deploy nobody touched: it starts on the stand-in (the deprecation line is in the notes), "the old account signs in" now also checks that its session opens `/api/cms/_auth/me` as that account, a new step sends the old site's session cookie (must not cause a 5xx; it notes that the session no longer opens the admin), and a last step restarts the site with `NUXT_APP_SECRET` set to the old value as the changelog says and checks the session stays open. A baseline that already documents `NUXT_APP_SECRET` (0.4 and later) skips that step.
- **Docs.** `deploying.md` (environment table, Docker example, Pushbase steps), `getting-started.md` (settings, go-live checklist), `upgrading.md` "From 0.3 to 0.4", `.env.example` of the starter, playground and website.
- **Before 0.4.0 ships:** set `NUXT_APP_SECRET` (= the current `NUXT_SESSION_PASSWORD`) on the website and the demo, so they do not log the deprecation; the pitch sites already set it and keep theirs, so their admins sign in again once. Check first that each pitch site's `NUXT_APP_SECRET` is at least 32 characters: a shorter one (enough for nuxt-og-image) stops 0.4 from starting, and replacing it changes their signed share-image URLs.
- **Result** (`TEST_DATABASE_URL=…/cms_test_authutils`, starter and upgrade databases likewise, `TEST_REDIS_URL` on a throwaway Valkey 8; upgrade baselines `2506403` and `tinyzoo@0.3.0`). First commit (Nuxt 4.6), after the plugin-filter fix: `pnpm check` green, 97 files / 1296 tests passed, 2 files / 23 tests skipped; `check:starter`, `check:upgrade` (both baselines) and `check:consumer` green. Before the fix, `pnpm check` failed on the three cookie tests above (starter, upgrade and consumer were green: none of them looks at anonymous cookies). On the second commit the first full run failed twice, both in the checks themselves: the `Expires` test above, and the upgrade check's new last step, which asked the restarted site on its old port. The four checks on the second commit after those fixes: in the pull request's description.
- **Review** (independent security review of the pull request; three commits after it). One Medium, seven Low, nits:
  - **M1, no absolute session lifetime any more.** 0.5 (h3 v1) refused a session older than `maxAge` from its creation, which survived `replaceUserSession`; under 0.6 only the seal's age is checked and every reseal restarts it, so a stolen cookie could live forever by calling `PATCH /api/cms/_auth/me {"locale": null}` every 13 days. → The session carries the sign-in time (`cms.iat`, ms). Sign-ins (login, setup, invitation, reset, email revert) set it; the same browser's reseals keep it (`continueCmsSession`: name or language, own password change, confirming one's own email change; it refuses with 401 when the request has no sign-in time). `activeAccountOf` refuses a session without `iat` (sessions sealed before this, all from the unreleased branch) or older than `runtimeConfig.session.maxAge`, and the middleware drops its cookie. The collab socket's re-checks hold no session and use `activeAccount(uid, sv)`; a socket already open is not cut at the 14-day mark, as with 0.5. Test: `session-lifetime.spec.ts`, its own server with `NUXT_SESSION_MAX_AGE=6`: a session patched at 3 s is refused at 6.7 s while one signed in at 3 s still opens the admin, and signing in again works.
  - **L2, two contradicting log lines** (tinyzoo "is used as the app secret", nuxt-auth-utils "is not used anymore"). → tinyzoo's line says nuxt-auth-utils' one can be ignored until the variable is renamed; the changeset, `upgrading.md` and `deploying.md` say so.
  - **L3, `runtimeConfig.session.password` in nuxt.config** (0.3's start check accepted it) stopped the start. → Included in the stand-in: when no app secret is set at build time, that value becomes the build's `appSecret` (`planAppSecretFallback`, `src/appSecret.ts`). Safe because it is in the built runtime config already (as `session.password`, which nuxt-auth-utils does not remove), and a runtime `NUXT_APP_SECRET` or `NUXT_SESSION_PASSWORD` still wins, as in 0.3; the deprecation line then says to move it to `NUXT_APP_SECRET`. Docs: the changeset and `upgrading.md` say so.
  - **L4, an existing `NUXT_APP_SECRET` under 32 characters** (enough for nuxt-og-image) blocks the start, but the docs said "keep it as it is". → The changeset (new step 3) and `upgrading.md` step 3: it must be ≥ 32 characters, otherwise replace it, which changes nuxt-og-image's signed image URLs and signs everyone in again. "Before 0.4.0 ships" now says to check the pitch sites' length.
  - **L5, sites using nuxt-auth-utils themselves** → the Upgrade section and `upgrading.md` link its "Migrate from v0.5" guide and the 0.6.0 release notes, and name the breaking changes.
  - **L6, the "module not found" warning sat in the Rollup plugin's `buildEnd`**, added only in `rollup:before`. → An `installed` flag checked in Nitro's `compiled` hook.
  - **L7, the start-check tests inherited the shell's secrets.** → `startServer` and the shared test server drop `NUXT_APP_SECRET`, `NITRO_APP_SECRET`, `NUXT_SESSION_PASSWORD` and `NITRO_SESSION_PASSWORD` from the inherited environment.
  - **Nits.** (a) The stale-cookie test now says what happens: the seal does not open, Nuxt's `useSession` starts an empty session in its place, so exactly one `nuxt-auth-session` cookie is set and it opens neither `/me` nor a user in `/api/_auth/session`. (b) The start check names the variable Nitro read: `NITRO_APP_SECRET` when it is set (even empty), otherwise the site's `envPrefix` + `APP_SECRET`; the stand-in writes to an empty `NITRO_APP_SECRET`, which Nitro reads first. (c) The `nuxt` peer is ^4.6.4 like `@nuxt/kit` (changeset and docs too): moving kit to ^4.6.0 instead made pnpm resolve nuxt-auth-utils' optional peers again and put a second copy of it in the workspace; with the peer raised the lockfile changes one specifier line. (d) The transform returns a line-by-line source map (`prependedLinesMap`) instead of `map: null`; magic-string was tried and dropped, as a direct dependency caused the same pnpm re-resolution. (e) New tests: `NITRO_APP_SECRET` wins over the stand-in and is named when short; the test build gets three recognisable secrets in its environment (`BUILD_SECRETS`) and none of them is anywhere in `.output`, which still carries the stand-in (so an app secret in the build's environment does not drop it); `app-secret-fallback.spec.ts` (unit, 10 tests): a build-time `runtimeConfig.appSecret` skips the stand-in, the nuxt.config password, precedence, custom prefix, the source map.
  - **Result after the review** (`…/cms_test_authfix`, starter and upgrade databases likewise, `TEST_REDIS_URL` on a throwaway Valkey 8): `pnpm check` green, 99 files / 1317 tests passed, 2 files / 23 tests skipped (155 s for the tests); `check:starter` green; `check:upgrade` green on `2506403` and `tinyzoo@0.3.0`, no migration, both printing the new deprecation line; `check:consumer` green. All four on the commit before this roadmap entry (95f78a9); the entry changes nothing a check reads.


- **Second review** (independent, after the fixes): no High or Medium. The 14 days held for every HTTP path but not for sockets already open: the realtime and shared-editing sockets re-checked the account with its session version only, so one opened just before the end stayed usable (realtime up to its 12-hour cap, shared editing until a restart). The sign-in time now travels with the socket (`cmsSignedInAt` on admission, `iat` in the collab context and the realtime peer), and `activeAccount(id, sv, iat)` refuses a session past its lifetime on every re-check. Test: a realtime socket opened halfway through a 6-second session closes (4401) once it is over. Also noted, not changed: a flaky unhandled `unexpected end of file` from `test/unit/transfer.spec.ts` (truncated archive; once in one full local run, then 5/5 clean): `extractFrom` in `cli/tar.ts` can leave the gunzip stream's late error without a listener; for a later fix.

### 0.4 — The old form helpers are gone

Branch `chore/0.4-remove-old-form-helpers`. `defineForm` and `defineFormSettings` exported from `tinyzoo` (deprecated in 0.2, `removeIn: '0.4.0'`) are removed, with the internal `IMPLICIT_FORMS_REQUIREMENT` they used to register the plugin by themselves (the generic `create` of a plugin requirement stays). Nothing we run used them: the website, the playground, the starter and the two pitch sites with forms (autoservis-benesov, samoty) import from `tinyzoo/forms`. Tests that exercised the old import are removed; `test/unit/ops.spec.ts` now uses the plugin's `defineForm`. `docs/upgrading.md` ("From 0.3 to 0.4", step 5) and `docs/plugins.md` say what a site still on the old import does. The upgrade check's oldest baseline (`2506403`, a tinyzoo 0.1 starter) still had the old import: its hook `scripts/upgrade-check/2506403.mjs` now makes the documented change before `tinyzoo upgrade`, as a site does by hand. Checked by CI (typecheck, unit, API, upgrade, consumer).

### 0.5 — Released (2026-11-17)

`tinyzoo` and `@tinyzoo/client` 0.5.0 (sitemap through `@nuxtjs/sitemap`, the design system page moved to the website), released before Wave 4 starts.

### 1.0 — Wave 4 (started 2026-11-17)

Decisions above ("Decisions locked for Wave 4"). Four slices in parallel, one agent each in its own worktree and branch: M `feat/1.0-roles`, N `feat/1.0-locale-publishing`, O `feat/1.0-create`, P `feat/1.0-api-review`. Each uses its own databases (`cms_test_<slice>`, `cms_test_<slice>_starter`, `cms_test_<slice>_upgrade`). After they merge: two independent reviews of the merged wave, fix branches for what they find, then `check`, `check:starter`, `check:upgrade` and `check:consumer` green before the pull requests.

| Slice | Branch | State |
|---|---|---|
| M — custom roles, per-field permissions | `feat/1.0-roles` | merged into `feat/1.0-wave4`; admin screens not yet seen in a browser |
| N — per-language publishing | `feat/1.0-locale-publishing` | merged into `feat/1.0-wave4` |
| O — `pnpm create tinyzoo` | `feat/1.0-create` | merged into `feat/1.0-wave4` |
| P — API review before the freeze | `feat/1.0-api-review` | merged into `feat/1.0-wave4`; 11 proposals for Vojtěch in its write-up |

**Integration (`feat/1.0-wave4`, 2026-11-17).** The four slices merged in the order P, M, N, O. Conflicts by hand in `src/entity.ts` (the list-parameter deprecation next to the `perLocale` checks; `CmsRegistry.roles`), `cmsTranslationWrite.ts` (field rules and per-language state on one write), the content API's single item, the editor's translation save, `cli/index.ts` (`tinyzoo help` and the init flags), `forms/index.ts`, and the combined "From 0.5 to 0.6" in `docs/upgrading.md`. Only N adds a migration (`0022`), so nothing had to be regenerated (`pnpm db:generate`: no changes). The role helpers the server uses are `@internal`; `defineRoles`, the role types and `.access()` are public and in `docs/api-surface.md`; `tinyzoo init`'s flags are in `cli/usage.ts`; goldens updated. Typecheck and unit tests green (924). Two independent reviews running: A security and access, B upgrades, API freeze and integration.

### 0.6 P — API review before the freeze

Branch `feat/1.0-api-review`. Slice P of Wave 4: write down what 1.0 freezes, clean what would be painful to keep for years, remove what is due, mark internals, and guard the surface with golden tests. Changesets: `app-secret-required.md` (breaking) and `api-review.md`.

- **The public surface, written down.** `docs/api-surface.md`, linked from `CONTRIBUTING.md`, `docs/upgrading.md` and the docs index: every public export of `tinyzoo`, `tinyzoo/forms`, `tinyzoo/module` and `@tinyzoo/client` with one line each (`tinyzoo/layer` is a Nuxt config: what it sets up is listed), the `f.*` factories and field methods, the options of an entity, the `cms` module options with their `NUXT_CMS_*` variables, the other variables, the content API routes, the client, the webhook, the three Nitro hooks, the CLI with every flag, and the admin's extension points. A test (`api-surface.spec.ts`) keeps it true: the page names every public export, command, flag, route, hook, variable and webhook key, lists nothing `@internal` as an entry, and is linked from the two docs.
- **Internals marked.** `@internal` in the JSDoc of 161 of the 263 exports of `tinyzoo` (84 public, 18 re-exported from drizzle) (the tree, search, link, migration, path and block-upgrade helpers, the system tables, `buildRegistry`, `snake`/`buildColumn`, the column IR…), 3 of `tinyzoo/forms`, and members of public interfaces (`FieldDescriptor.spec`/`zod`/`dbDefault`, the system tables on `CmsRegistry`, `CmsEntity.enums`/`preset`/`requiresPlugin`…). They stay exported: the server, the admin and the CLI import them from `tinyzoo`, and the packages ship TypeScript source, so there is no declaration output to drop them from. Moving them to an internal entry point would have touched every server file the other slices edit; marking was the conservative choice. The API report drops them instead (names only) and tests fail if a public declaration names an `@internal` export, or if the docs, the website, the playground or the starter import one. Found and fixed by that test: `CmsRole` was derived from the internal `CMS_ROLES` (now a literal union, the constant checks itself against it), and `SqlRunner`, the type of an upgrade step's `ctx.run`, is public API, not internal.
- **Golden tests** (`test/contracts/`, `pnpm contracts:update`, which now runs both specs; readable diff as for the content API):
  - the exported API of each entry point, from the TypeScript compiler (`test/helpers/apiReport.ts`): `api-tinyzoo.txt`, `api-tinyzoo-forms.txt`, `api-tinyzoo-module.txt`, `api-client.txt`. Public declarations in full, re-exports from drizzle by name, deprecated and internal ones listed apart;
  - `module-options.json`: the module's `setup()` run against a stub of `@nuxt/kit`, so the defaults are what the module really writes, plus the `NUXT_CMS_*` variables that follow;
  - `nitro-hooks.d.ts` (the type template the module registers: the three hooks and the session user), `cli-usage.txt`, `webhook.json`, `content-routes.txt`, `layer-config.json`;
  - a typed config that uses every `f.*` field and every option of an entity, a global and the presets (`test/contracts/surface/cms.config.ts`), with `surface.client-types.ts`, `surface.openapi.json` and `surface.admin-graph.json` generated from it, and `surface-types.spec.ts` asserting `Row`, `Insert`, `Update`, the field kinds, and the client's types with `expectTypeOf` and `@ts-expect-error` (checked by `pnpm typecheck`; 34 tests). Checked that a changed field kind fails `tsc`.
  - `CONTRIBUTING.md` ("Contracts") lists each file and says when a change is breaking and that the changeset must say so.
- **Refactors for testability, no behaviour change.** `cli/usage.ts` holds the commands and flags (`tinyzoo help`, `--help`, `-h` print them, exit 0; an unknown command prints them to stderr and exits 1, as before); `src/changes.ts` has `CmsWebhookPayload`, `CMS_WEBHOOK_HEADERS` and `webhookPayload()`, which `cmsWebhooks.ts` now uses (the comment there listed the body without `globals`); `src/admin.ts` has `CmsAdminField`, `CmsFieldEditProps`, `CmsFieldCellProps`, the props a field renderer in `cms.fields` receives, and the admin graph's fields are typed with it.
- **Removed: `NUXT_SESSION_PASSWORD` as a stand-in for `NUXT_APP_SECRET`** (deprecated in 0.4 with `removeIn: '0.5.0'`, kept through 0.5). Gone: `src/appSecret.ts`, `appSecretFallback` and the `nitro:init` hook in `module.ts`, the deprecation, `test/unit/app-secret-fallback.spec.ts`. The start check (`cms-0-config-check.ts`) now says, when no app secret is set: `NUXT_APP_SECRET is not set; …`, and when `NUXT_SESSION_PASSWORD` or `NITRO_SESSION_PASSWORD` is set: `… is set, but no longer used … Rename the variable to NUXT_APP_SECRET and keep its value: nobody is signed out`; likewise for `runtimeConfig.session.password` in `nuxt.config`. It never prints the old value. An old variable next to a set `NUXT_APP_SECRET` is ignored without a word. No other `removeIn` ≤ 0.6 exists in the code (the old form helpers went in 0.4).
  - *Upgrade check.* A baseline whose starter documents `NUXT_SESSION_PASSWORD` (2506403, a 0.1 site) now: starts the upgraded site on the unchanged environment and expects a refusal that names `NUXT_APP_SECRET` and the rename; then renames the variable as the docs say (same value) and checks everything else on that site as before (the old account signs in, the content is identical…). The final "restart with `NUXT_APP_SECRET`" step is gone (it is the main path now). A baseline on `NUXT_APP_SECRET` (0.4, 0.5) has no step to skip.
  - *Tests.* `start-checks.spec.ts`: only the old variable is refused naming `NUXT_APP_SECRET` (also a short one, and `NITRO_SESSION_PASSWORD`, and the value is never printed); a set `NUXT_APP_SECRET` signs people in and an old variable next to it changes nothing (the session survives a restart with it); a different secret does not open the old session; `NITRO_APP_SECRET` still wins; the build contains no stand-in code and none of the three build-environment secrets.
- **Deprecated now, removed in 1.0** (each warns once at build or start): `cms.databaseUrl` (writes the database address, password included, into the build; nothing we run uses it), `FormOptions` imported from `tinyzoo` (a leftover duplicate of `tinyzoo/forms`; `FORM_FIELD_TYPES` next to it is `@internal`), and a field called `page`, `limit`, `sort`, `dir` or `q` in a public collection (the name of a parameter of the list: it cannot be a filter, and freezing that ambiguity would last for years; nothing we run has one). Deprecated exports and members show up under "deprecated" in the API report.
- **Fixed on the way:** the stale comment in `forms/index.ts` saying `defineForm` is also exported from `tinyzoo`; an unused `cmsDeprecated` import in `presets.ts`; the webhook comment above.

**Proposals, not done: for you to decide before 1.0.** Each is a rename or a behaviour that live sites may use, so none was touched:

1. **`f.number({ int: false })`: type and wire disagree.** `Row` and `Insert` say `number`, but the column is `numeric`: a select and the content API return a **string** (`"19.99"`; the client types and OpenAPI say string, `surface.client-types.ts` shows `price: string | null`). Frozen as it is. Either make the row type `string` for decimals (breaking for typed code; needs a generic on `int`), or convert on read (behaviour change), or document it. Most urgent: it is a trap.
2. **The frontend kit is not on the freeze list.** `<CmsBlocks>`, `<CmsImage>`, `<CmsContent>`, `<CmsNav>`, `<CmsHighlight>`, `<CmsForm>`, `useCmsSeo()` and `useCmsSearch()` are documented and every site uses them, but the decision lists only the admin extension points; the page says "not (yet) part of the freeze". Recommended: freeze them (their props are small).
3. **Client naming.** The package exports `createCmsClient`; the generated bindings export `createClient`. Types are half-prefixed: `CmsClient`, `CmsError`, `CmsTreeNode`, `CmsMenuLink` against `ClientOptions`, `ListParams`, `ListResponse`, `GetOptions`, `TreeOptions`, `SearchParams`, `SearchItem`, `SearchResponse`, `Collection`, `CollectionSpec`, `AnyContentSchema`. Proposal: add `Cms`-prefixed aliases and deprecate the short names (type aliases, so no site breaks).
4. **Two public addresses.** `cms.publicUrl` (emails, sitemap) and `cms.content.publicUrl` (the OpenAPI `servers[].url`). Merge, or fall back from the second to the first.
5. **Build-time variables outside the convention.** `CMS_SCHEDULER_CRON` and `CMS_RETENTION_CRON` are not `NUXT_CMS_*`; `scheduler.cron` is an option, the retention cron has none. Proposal: `scheduler.cron` and `retention.cron` options, the variables kept as aliases.
6. **Two ways to make a global.** `defineSingleton(name, def)` and `defineEntity(name, { singleton: true })`. Keep one in the docs; deprecate the other.
7. **`defineForm` returns `Entity<Record<string, AnyFieldDescriptor>>`**: the form's field types are lost (`Row<typeof ContactForm>` is loose). Typing it as `Entity<F>` is the precise fix; best before the freeze.
8. **`forms.notifyTo` (a comma-separated string) against `defineForm({ notify: { to: string[] } })`.**
9. **`access` rules get `{ user: any }`.** Typing the user is a narrowing, which breaks code if done after 1.0; M (custom roles) changes this area, so it is better done there. For the same reason `CmsRole` (a fixed union of three) will change with M.
10. **Env-only and undocumented variables.** `NUXT_CMS_AUTH_SETUP_TOKEN` has no option (the page says so); `CMS_ALLOW_REQUEST_ORIGIN` is read but documented nowhere (listed as not part of the surface).
11. **Two erased-entity types.** `Entity<F>` (typed) and `CmsEntity` (erased) are both public; the second is what plugin hooks get. Fine, but easy to confuse in the docs.

**Upgrade notes.** `docs/upgrading.md` "From 0.5 to 0.6" (created here; the other slices add their steps to it): rename `NUXT_SESSION_PASSWORD` to `NUXT_APP_SECRET` before deploying 0.6 (the only step that can stop a site), then the three deprecations, then `@internal` exports. No migration, no upgrade step, no change to the content API or the generated client types (`openapi.playground.json` and `client-types.playground.ts` are unchanged). `docs/upgrading.md` (version policy, the 0.3 → 0.4 `NUXT_APP_SECRET` paragraph) and `docs/deploying.md` (environment table) no longer promise the stand-in.

**At merge.**
- The new golden files will need `pnpm contracts:update` once M, N and O are in: M adds exports (`defineRoles`, field `.access()`) and changes `CmsRole` and `access`, N changes `CmsChange`, the webhook body and the content API, O touches no entry point. **`api-surface.spec.ts` also fails until `docs/api-surface.md` names every new public export** (or the export is tagged `@internal`): that is on purpose. Their changesets say what they break.
- `module.ts` changes in three small places (the removed import and hook, the `databaseUrl` deprecation, the `CmsModuleOptions` JSDoc): expect a trivial conflict if M or N add options.
- Many files got JSDoc-only edits (`@internal`); a conflict there is the tag on one line.
- `pnpm contracts:update` in `package.json` runs `contracts.spec.ts` and `api-surface.spec.ts`.

**Result** (`TEST_DATABASE_URL=…/cms_test_apireview`, starter and upgrade databases likewise, no Redis): `pnpm check` green on the code commit: typecheck (tsc, docs check with 30 blocks, playground, starter, website) and 100 files / 1374 tests passed, 3 files / 26 tests skipped (180 s for the tests); `check:starter` green; `check:upgrade` green on `2506403` and `tinyzoo@0.4.0` (the newest tag in this clone; no 0.5.0 tag was fetched), both going through the new "refused, then renamed" step, no migration; `check:consumer` green. New or changed tests: `api-surface.spec.ts` (27), `surface-types.spec.ts` (34), `contracts.spec.ts`, and `start-checks.spec.ts` (the old-variable cases).

**After review (2026-11-17).** The review of the merged wave took all eleven proposals as recommended. Branch `fix/1.0-w4-api-refine`, changeset `api-refine.md` (**Breaking:** first), `docs/upgrading.md` "From 0.5 to 0.6", steps 8 to 11. What was decided on each:

1. **Decimals: the type follows the wire.** `f.number({ int: false })` is `string` in `Row` (and in a block, list or group), and `Insert`/`Update` take `number | string`, through a generic on `int` (`f.number()` stays `number`). The wire stays a string; the validator accepts a number or a numeric string and stores the string (the admin used to fail on a decimal it had not touched, because the API gave it a string and the check wanted a number). `.withDefault()` on a decimal takes a string. Breaking for typed code: `Number(row.price)`.
2. **The frontend kit is frozen.** `<CmsBlocks>`, `<CmsImage>`, `<CmsContent>`, `<CmsNav>`, `<CmsHighlight>`, `<CmsForm>`, `useCmsSeo()`, `useCmsSearch()` and `useCmsUiLocale()` (the starter, the playground and the docs all use it for `<UApp :locale>`). Their props are interfaces in `src/frontend.ts`, exported from `tinyzoo`, which the components declare their props with; `frontend-kit.txt` (from the `.vue` and composable sources with the TypeScript compiler; no new dependency, `vue-component-meta` would have changed the lockfile) lists props, emits, slots, signatures and returned keys. Every other `Cms*` component is internal, **including the ones the website's design-system page and a plugin's admin pages use** (`CmsSection`, `CmsStatusBadge`, `CmsPage`…, and `useCmsI18n`): said in the docs, so a plugin follows the version it was written for.
3. **Client naming: no aliases.** The docs say that `createClient` is generated and typed and `createCmsClient` is the untyped runtime; the types keep their names.
4. **Two public addresses: both kept.** `cms.content.publicUrl` falls back to `cms.publicUrl` (read when the document is built, so `NUXT_CMS_PUBLIC_URL` is enough).
5. **Cron.** `cms.retention.cron` is new (`cms.scheduler.cron` existed); `CMS_SCHEDULER_CRON` and `CMS_RETENTION_CRON` are deprecated aliases (`removeIn` 1.0.0, the option wins). Both are build time, and the docs say so: there is no `NUXT_CMS_*` variable for them, because the value is written into the build.
6. **One way to make a global.** `defineSingleton`; `singleton: true` on `defineEntity` is `@deprecated` and warns (it keeps working). Nothing in the starter, the website, the playground or the docs used it; a test keeps it so.
7. **`defineForm` is typed.** It returns `Entity<F & { status: FormStatusField }>`: the form's fields and the `status` every form gets (a row has it), so `Row<typeof ContactForm>` is exact.
8. **`notifyTo`** takes `string | string[]`; the runtime value and `NUXT_CMS_FORMS_NOTIFY_TO` stay one comma-separated string.
9. **`access` rules are typed.** `CmsAccessUser = { id; email; name; role: string; base: CmsRole | null; locale: string | null } & Record<string, unknown>`, exported. What the server passes was `CmsUser` (with `email`, `name` and `locale` optional for an external sign-in) plus `base`; the server now fills the missing ones in (`''`, `''`, `null`) so the type is true. A claim an external sign-in adds is `unknown`: code that used it untyped must check it first (the one source change that can break a rule, in `upgrading.md`). The playground, the starter and the website still typecheck.
10. **Env-only variables.** `NUXT_CMS_AUTH_SETUP_TOKEN` stays an environment variable only (a secret: an option is written into the build and the committed `nuxt.config.ts`), with the reason in the docs. `CMS_ALLOW_REQUEST_ORIGIN` is **documented under its name, not renamed**: it is an escape hatch that weakens the Host-header protection, read when a link is written, not a setting; a `NUXT_CMS_*` name would be taken for one and would need a runtime-config key and an option, which would be frozen too.
11. **Two entity types.** Both kept. The docs write `Entity` (what `defineEntity`, `defineSingleton`, `defineForm` and the presets return); `CmsEntity` appears only for what a plugin's hooks and routes receive, with a paragraph on the difference in `api-surface.md`.

Also: **B-L1** the typed surface config has a `defineRoles` role, a field with `.access()` chained with `.label()` and an entity with `publish.perLocale`; `surface-types.spec.ts` asserts the role references (a typo is a compile error), that `Row`, `Insert` and the client item gained no key, and `surface.openapi.json` and `surface.client-types.ts` did not change when `perLocale` was added (only `surface.admin-graph.json` did). **B-L6** a line in `docs/guide/roles.md`: publish rights are role-wide, a role cannot be allowed to publish one language only. New tests: `test/unit/api-refine.spec.ts` (decimals, cron, `singleton`, `notifyTo`, what an `access` rule is given, what sites show), `test/unit/frontend-kit.spec.ts` (and its golden), `test/api/api-refine.spec.ts` (the OpenAPI server address), more types in `surface-types.spec.ts`.

### 0.6 M — Custom roles and per-field permissions

Branch `feat/1.0-roles`. Why: the roles were three fixed names with their rules spread over `cmsCrud.ts`, the media code and a few `user.role === 'author'` checks; a site could not give a translator edit rights on posts only, or keep a field from some people. Decisions are the ones locked for Wave 4 ("Role model", "Role removed from config"); what follows is what was built and what had to be decided on the way. Guide: `docs/guide/roles.md`. Changeset `custom-roles.md` (minor, `### Upgrade`); `docs/upgrading.md` gets "From 0.5 to 0.6", step 1.

- **API.** `export const roles = defineRoles({ translator: { from: 'editor', label, description, entities: { post: ['read', 'update'] }, publish: false, media: 'own' } })` (`src/roles.ts`; registry field `reg.roles`). `from` is `'editor'` or `'author'`; a built-in name, `from: 'admin'`, a bad name, an unknown operation or `update` without `read` throw in `defineRoles`; collection names, operations a global cannot have (`create`, `delete`), role names in field rules, a rule that lets a role edit what it cannot read, and a second `defineRoles` throw when the registry is built, with the collection or field in the message. Per field: `.access({ read: [...], edit: [...] })`, chainable with `.label()`/`.help()` in any order (stored in `meta.access` as role names). **Refinement of the sketch:** role names are typed through *references*, not strings: `defineRoles` returns `roles.translator` (and `roles.editor`…), and `.access()` takes `'admin' | 'editor' | 'author'` or a reference, so `roles.translatr` and `'translator'` are compile errors and need no global type registration (no `declare module`), at the price that `roles` must be defined above the entities that name it. `from: 'admin'` and redefining a built-in are also compile errors (`@ts-expect-error` tests in `test/unit/roles.spec.ts`, which `tsc` checks).
- **Semantics decided.** A collection listed in `entities` gets exactly the listed operations, one left out gets what `from` allows (as specified). `from` also fixes the row scope: author-based roles change and delete only entries they created; a grant on a global has no owner, so it applies to the row. The old author rule "no content that is live the moment it is saved, no settings" is now `publish: false` ("writing live content is publishing") plus, for an author-based role, "settings only where listed"; so an editor-based role with `publish: false` is held to it too. Admin always passes every field rule; `edit` needs `read`. Exact names, never inherited: a role that extends editor is not in a field's list because `'editor'` is. The title, publish state/date, `content.slug` and path keys, tree parent/order and `orderField` cannot get `read` rules (every screen shows them): config error; `edit` is fine. Rules are for the fields of a collection or global, not inside a block, a list or a group (config error), and not on the public API.
- **Role resolution** (`server/utils/cmsRoles.ts`, `resolveRole` in `src/roles.ts`): `roleOf(user)`, `mediaAccess`, `canPublish`, `requireCmsAdmin` (only the built-in `admin` has `manage`). The entities' own `access` rules get `user.base` (the built-in a role is or extends) next to `user.role`; the playground's rules and `formsReadAccess` use it. **Fail closed:** `requireCmsUser` answers `403 { code: 'role-removed' }` for an account whose role the site does not know; account pages (`me`, password, email) use `requireCmsAccount` and keep working; the realtime and collab sockets refuse it; the content API's session preview does not show it drafts. Team lists `roleRemoved` and the roles to pick (`roles`), invitations and role changes take any of them (`assignableRoleSchema`), the invitation email and page name a custom role by its label (cs/en/de), the audit log records `user.role` as before. **Admin screens:** "Your role no longer exists" (`CmsRoleRemoved`), roles and the flag on the Team page, read-only fields (`CmsFieldLock`, a `fieldset`), the media library closed for `none`, `can.arrange`/`can.move`; cs, en and de.
- **External sign-in.** Role names from the provider resolve against the same definitions. Conflict with fail-closed, decided: on a site that **defines roles** an unknown name has no access (a role removed from the config while the provider still sends it must not turn into an editor's reach); on a site that **defines none** an unknown name keeps today's behaviour (everything, the entities' `access` decide, may publish, never administrator), because that is what "no `roles` config behaves as before" means. With the built-in sign-in an unknown stored name always fails closed.
- **Upgrade, no migration.** `cms_users.role` is a text column (no enum, no check): nothing to migrate and no upgrade step; no schema or generated-client change; contract snapshots unchanged (the content API is not touched). Sites with no `roles` and no field rules behave exactly as before, shown by the existing suites (the playground defines roles now, and its built-in roles pass the same tests untouched), `roles-server.spec.ts` (the built-ins and "no roles" against the old rules) and the starter and upgrade checks (starters define none). Two differences, both in cases that did not arise through the admin, said in the changeset: a stored role that is not admin/editor/author now has no access (before: an editor's reach), and the `user.base` field on rule contexts.

**Paths covered — reads (unreadable fields stripped).** List (`GET /api/cms/:entity`: rows, relation labels and file previews; the search box, filters and sort refuse a hidden field, including by its column name `<key>Id`); one entry (`:id`, with `?locale=` translations and `__defaults`); the answers of create (`POST`), save (`PATCH`, translation `PATCH`), global read and save (`_singleton`); CSV export (columns, related names, filters); revisions (list: `changed`; one snapshot: `data` and `changed`); admin search `⌘K` (candidates come from the index, then every entry of a collection with a hidden field is matched again on text made from the readable fields only, so neither the match nor the excerpt shows it; singletons are not indexed); `usage` of a file and the refusal to delete something that is used (`usedBy`, `linksTo`: an entry that holds the reference only in a hidden field is counted, not named); the schema `_graph` (fields, list columns, searchable, tabs, sections; `readOnly`, `can.arrange`, `can.move`; `meta.access` never sent); the draft preview of the content API for a signed-in person (`?preview`); the overview and `_links`, `_tree`, `options` (titles and states only, which cannot be hidden); the realtime feeds (`change` events carry type, entity, id, version, who: no field); `GET _auth/me`.
**Writes (403 `field_forbidden`, naming the fields; checked on the keys sent, before validation).** Create, save, translation save, translation removal (needs every translated field editable), global save (non-editable fields omitted from the schema and the write, so a default never overwrites; the first save has nothing to keep), `_order` (the order field) and `_move` (parent and order); duplicate and bulk publish are client loops over these. The admin leaves read-only fields out of every body. **Decision: refuse (403), not ignore**, and even when the value equals the stored one; on create a default still fills a field the person may not write, and a required one with no default is a normal 422 ("this role cannot make that entry").
**Shared editing.** A rich-text field with a rule is not in the shared document (`collabFields`), so nobody receives it and nobody types into it; a stored document that holds a text outside the shared ones (a rule added later) is not reused: `ensureCollabDocument` starts it afresh with a new epoch. Socket admission and writing follow `collabAccess` (write/read per role); a role the site does not have gets no socket.
**Media** (`all`/`own`/`none`): list, upload, `exists`, `usage`, details (`PATCH`) and delete, cleanup after a save (`gcScope`: only own files unless `all`), public details of a live file (`publish`), the library page and the picker. `none` still lets `GET _media/:id` (and the file URLs) work: the files on entries a person may read must show.

**Left out on purpose.** The public content API (governed by `content.hidden`; only the signed-in `?preview` strips). Relation items populated *inside* a preview keep their own entity's fields (no role-level stripping there). Plugin routes under `/api/cms/_p/` (a plugin checks its own access; `access: 'admin'` follows `manage`). `tinyzoo export`/`import`/`seed` run as the operator and the seed account: seeds write through the API as that account, so field rules apply to it. Search ranking still uses the hidden text in the index (the order of results, not their content, can reflect it). Hiding a field from the *admin* does not hide it from an `access` row rule written in terms of that field (those are the site's). `GET _media/:id` is open to roles with `media: 'none'` (above).

**Tests.** `test/unit/roles.spec.ts` (37): `defineRoles` validation, resolution, `.access()` (shape, chaining, nested fields), the registry checks, the playground's roles, and the type negatives. `test/unit/roles-server.spec.ts` (17): `roleAccess` for the built-ins with no roles, custom roles (listed, unlisted, author-based, globals, `publish`), external sign-in with and without roles, fail-closed, field helpers. `test/api/custom-roles.spec.ts` (42): every path above against the playground, which has roles `translator`, `curator`, `marketer` and rules on `author.email`/`bio`/`position`, `post.location`, `siteSettings.siteName`/`brandColor` — including a socket test for a read-only role and a refused one, a stale-document test, a removed role on every route, invitations with a custom role, the Team page. Helper `newAccount` takes any role name; `docs/guide/roles.md` has a type-checked example (`pnpm docs:check`).
**Checks** (`TEST_DATABASE_URL=…/cms_test_roles`, no Redis): `pnpm check` — typecheck (root, docs, playground, starter, website) green, then one run failed on a test of the invitation's exact shape (a new `roleLabel` key; now only present for a role that has a label), fixed; on that run 100 files and 1406 tests passed, 3 files / 26 tests skipped; the two specs touched by the fix and `tsc` were rerun green (63 tests). `pnpm check:starter` green; `pnpm check:upgrade` green (both baselines, `tinyzoo status` nothing pending, no migration); `pnpm check:consumer` green. The admin screens were typechecked and built but **not looked at in a browser** (the browser tool was held by another profile): Team, the removed-role screen, a read-only field and the closed media library should be seen once.

### 0.6 N — Per-language publishing

Branch `feat/1.0-locale-publishing`. `publish: { …, perLocale: true }` on an entity (and `definePages({ perLocale: true })`): each translation has a state and a schedule of its own.

- **Model.** Two nullable columns on `<entity>_locales`: `published` (true / false / `null`) and `published_at`. `null` means **the language follows the default language**; the default language's state stays on the entry. Only an entity with the option gets the columns (`defineEntity` and `emitSchema`); the option needs a `.localized()` field, refuses a page tree (the pages below a page follow its state, which would then differ per language) and a localized field called `published` / `publishedAt`.
- **One condition for everything.** `publishedCond(e, locale)` (`cmsPublished.ts`) runs the entity's own rule (`content.published`, or the status, plus the schedule) against a *view* of the entry: a table whose status and date columns are SQL for the language's state (its own while `published` is set, else the entry's). So a site's custom `content.published` keeps working unchanged. The default language, no language and entities without the option get exactly the SQL as before (a unit test compares it). It feeds the content API (single, list, populated relations), the sitemap and its alternates, search, link addresses (`resolveLinkRefs`, `describeLinkRefs`, the link picker, `links:convert`), the media "is it on the website" check and the change snapshot.
- **Decision: follow, not copy.** The locked decision said an upgrade step copies the current state into every language. Nullable "follows the default" columns make that unnecessary, and a copy could not cover entries with no translation row (served through the fallback today) without inventing rows. So there is **no upgrade step**: a migration (two columns) and nothing else. The price: a language follows the default language until someone sets it, so a *new* translation of a live entry is live (in the default language's words) until an editor unpublishes it, exactly as without the option. Said in the guide, the changeset and `upgrading.md`.
- **Behaviour.** A language that is not published: `404` for the item (by its translated and by the default address), left out of that language's list and `total`, the sitemap, the `hreflang` alternates, the item's `locales` and `paths`, search and links (`null`, like a draft). Per-field fallback to the default language applies inside a published translation. `?preview` (session or content token) sees the draft. **Default language unpublished, translation published:** the translation is live on its own; nothing assumed the default row is live (tested for the item, list, sitemap, alternates, search). The editor's review step says it; the untranslated fields then show the default language's text, draft or not (documented).
- **Writes.** `PATCH /api/cms/<entity>/<id>?locale=en` also takes the entry's own status and date keys: `{status:'draft'}`, `{status:'published', publishedAt}`, `{status:null}` (follow again). A date needs its status; the publish date is stamped by the database's clock like an entry's. A state-only row is kept (it holds the state) but is not a translation: not in "Translated", not in the search index. `translation.updated` becomes `entry.published` / `entry.unpublished` (with `locale`) when the language went live or off. Roles: whoever may not publish (`assertPublishAllowed`, `canPublish`, kept at the call sites; M changes them) cannot set, clear or reschedule a language, nor change one that is live; they can write a language that is not live even when the default language is.
- **Webhooks, scheduler, cache.** Payload shape unchanged (`locale` was already there). `entry.published` / `entry.unpublished` for a language name it in `locale` and only its addresses in `paths`, an address served through the default language included (it is purged when the language flips; for other changes `paths` is as before). The scheduler also announces translations whose own date passed (`entry.published` + `locale`). A change to the default language names every live language.
- **Admin.** The editor shows the language's state in the status bar and aside; Publish… (the review step, with a note when the default language is a draft), Update, Unpublish and Schedule act on the language being edited; "Follow the default language again" in the menu; the language switcher and (form layout) the aside list each language's state. The list shows each language's state compactly in the Languages column (EN + dot, clock for scheduled, tooltip with why). cs, en and de strings. Editors' guide (`preklady.md`).
- **Carried along.** Export/import (`translations[].publish`, optional: an archive without it imports as "follows"), seeds (`translations: { en: { status: 'draft' } }`, idempotent), revisions (a language's history holds its status and date; restore keeps the workflow as for entries).
- **Not done / for later.** Page trees. The dashboard's "drafts" and "scheduled" and the admin search's status badge still describe the default language only. A language's live editor does not refresh when the default language is published and it follows it.
- **Upgrade notes.** Nothing for a site that does not set `perLocale`. To turn it on: set it, `tinyzoo generate` + commit, `tinyzoo up`; the website stays identical (below). `docs/upgrading.md` ("From 0.5 to 0.6"), changeset `per-language-publishing.md`. Contract snapshots unchanged (shape of the content API and client types is the same).
- **Tests.** `test/api/locale-publishing.spec.ts` (20: following, unpublishing, publishing alone, schedule + scheduler announcement, webhooks, roles, history, an entity without the option). `test/api/locale-publishing-switch.spec.ts`: **switching it on keeps the website identical**: the playground is built a second time without the option (`CMS_TEST_NO_PER_LOCALE=1`), started on the same database, and every list (both languages, sorts, filters, search), every item by every address, the sitemap with alternates and the search answers are compared as JSON with the build that has it; the data has live entries with and without translation, a draft, a scheduled one, partial translations. A second test sets one language's state and checks that only that language's answers change. `test/unit/locale-publishing.spec.ts` (validation, columns in `schema.ts`, the SQL), the transfer round trip and a seed test. The playground's `Post` has the option on; migration `0022_per_language_publishing` (regenerate on top of main at merge).
- **Checked in a browser** (the built playground on a scratch database): the list column, the editor of a draft English version, its review step and Publish (English live, Czech untouched). Not looked at: phone width, Schedule and "Follow again" in the UI.
- **Result** (`TEST_DATABASE_URL=…/cms_test_localepub`, starter and upgrade databases `…_starter`, `…_upgrade`): `pnpm check` green, 101 files / 1343 tests passed, 3 files / 26 tests skipped (typecheck included); `check:starter`, `check:upgrade` (no migration to write for a site that does not set the option) and `check:consumer` green.

### 0.6 O — pnpm create tinyzoo

Branch `feat/1.0-create`. Why: a new site took `pnpm dlx tinyzoo init`, a starter that was Czech and English with every part switched on, and a lot of deleting for anyone who wanted one language, no news or a different default. Now `pnpm create tinyzoo` asks, and `tinyzoo init` takes the same answers as flags, so both make the same site.

- **`create-tinyzoo`** (new package, unscoped, `packages/create-tinyzoo`; `pnpm create tinyzoo`, `npm create tinyzoo@latest`, `yarn create tinyzoo`, `npx create-tinyzoo`). Questions, in this order, each skipped when its flag was given: folder, content languages (`cs,en`; the first is the default), which parts (news, contact form, redirects, search; pages, settings, menus and SEO are always there), demo content (only when the first language is `cs` or `en`; otherwise it says why and skips), install now (and the package manager, asked only when `npm_config_user_agent` does not say). Flags: `--languages`, `--presets a,b|all|none`, `--demo`/`--no-demo`, `--install`/`--no-install`, `--package-manager`, `--yes`. Without a terminal or with `--yes` nothing is asked: defaults for what is not given, and no install unless `--install`. Prompts are `@clack/prompts` (its only dependency); the questions are a thin layer over `main(argv, { ui })`, so the tests answer them from a list. Ctrl-C at any question writes nothing and exits 0 (as create-vite does); a folder that is not empty is refused (also while typing the folder name); a failed install keeps the finished folder and says what to run; with `--install` it also runs `db:generate` / `cms:client` when the site needs them (below).
- **`tinyzoo init <folder>`** takes the same flags except the installing, and without flags makes exactly the site it made before (a unit test compares the default site file by file with the starter). Its code moved from `cli/index.ts` to **`cli/init.mjs`**: plain JavaScript on node's own modules (flag parsing, validation, the markers, the rewrites, next steps), with a hand-written `init.d.mts`. `index.ts` calls it; exit code 1 for a bad option, no folder, or a folder that is not empty, with the message (`docs/deploying.md` says so).
- **Decision: `create-tinyzoo` does not depend on `tinyzoo`.** The brief said to depend on it and run its init, or call an exported function. Measured: `tinyzoo` alone installs **724 packages, 388 MB** (Nuxt and the other peers come with it), 13 s with a warm store, minutes cold, to copy a folder; and the exported init would have had to be run from `node_modules`, where node refuses TypeScript. So `prepack` (`scripts/bundle.mjs`, run by `pnpm pack` and `pnpm publish`) copies `packages/cms/cli/init.mjs` and `packages/cms/starter` into `bundle/` (gitignored) with the version `tinyzoo` has. Nothing is duplicated in the repository, the package is 87 kB with one dependency, and the starter it carries is always the commit's own. If the owner prefers a real dependency, `loadTemplate()` in `src/create.mjs` is the one place to change (and `tinyzoo/init` would have to be exported).
- **The starter marks what can go.** Lines between `// #if <flag>` and `// #endif` (`<!-- #if … -->` in templates and Markdown, `# #if …` in `.env.example`) stay only when the site has that flag: `news`, `forms`, `redirects`, `search`, `demo`; `!flag` for the other way round; blocks nest. The workspace starter keeps every marker (they are comments), so it still typechecks and runs as it is, and a site made without options is the starter minus its markers. Markers are additive on purpose (no `#else`: the starter itself must compile with every block present). Removing a part removes its config (entity, plugin, redirect, block), its pages and components (`BlockContact.vue`, `search.vue`), the menu entries, the seed's content for it, its README lines, and the seed script when there is no demo. A handful of lines that depend on the languages are rewritten (`defineLocales`, the news addresses, the search route, the sitemap path, the admin's default language); each must be found exactly once, so a starter that drifts from `init.mjs` fails the unit tests and `check:starter`, not a site.
- **The starter's website follows its languages.** It was hardcoded to `cs`/`en` and Czech addresses. Now `app/utils/site.ts` has `LANGUAGES` (first = default) and the words it draws itself (news, search, landmarks, the error and welcome pages) for `cs`, `en` and `de`, English for any other code; addresses are `/<word>` for the default language and `/<code>/<word>` for the others; labels come from `Intl.DisplayNames`. The pages, layout, error page, `useSite`, the sitemap plugin and the search page read it. The search page file is `app/pages/search.vue` with `definePageMeta({ name: 'search', path, alias })` (init writes the address per language). **Demo content in either order:** every text in `seed/index.ts` is written as `cs` + `en` and `put()` makes the site's first language the entry and the other its translation, so `--languages en,cs` gets an English-first demo. The demo's home page button now leads to the About page as a reference instead of typing the news address (a fixed address would not exist without news). `scripts/typecheck.mjs` calls the site's own `nuxt` and `vue-tsc`, so `npm run typecheck` works.
- **Generated files.** The starter ships its schema, first migration and typed client for its own choices. Languages change only the client; parts change both. For other choices init does not ship them, and the next steps (or `--install`) say `db:generate` and `cms:client`. Writing the right ones at scaffold time would need drizzle-kit and the site's own install, which a scaffolder does not have.
- **Release wiring.** `create-tinyzoo` is in the `fixed` group of `.changeset/config.json` (`changeset version` takes the placeholder `0.0.0` to the shared `0.6.0`, tried and discarded), in `scripts/release.mjs`' package list (npm check, consumer check, `changeset publish` with provenance, tag and GitHub release) and in the comments of `release.yml`; `heavy.yml`'s consumer filter covers `packages/create-tinyzoo/**` and `cli/init.mjs`. **First publish:** CONTRIBUTING.md ("`create-tinyzoo`: how it is made, and its first publish") has the steps: `npm publish --access public --ignore-scripts` of `0.0.0` from `packages/create-tinyzoo` (no bundle in the placeholder, so it exits with a message), then the trusted publisher on npmjs.com (GitHub Actions, `tinyzookeeper` / `tinyzoo`, `release.yml`, no environment), both before the first "Version packages" pull request that contains the package. Nothing was published.
- **Docs.** `getting-started.md` leads with `pnpm create tinyzoo` and its options (and says `tinyzoo init` is the equivalent), the root and `tinyzoo` READMEs, a README for the new package, `recipes.md` (where `useSiteLocale` and `siteHref` live now), `upgrading.md` ("From 0.5 to 0.6", item 1: nothing to do), the website's seed texts (`site/scripts/seed.mjs`, `site/seed/translations/{en,de}.mjs`: the "Create a project" step says `pnpm create tinyzoo`). Changeset: `'create-tinyzoo': minor` + `'tinyzoo': minor`, **Upgrade: nothing** (no schema or behaviour change for an existing site; no upgrade step; contract snapshots unchanged).
- **Tests.** `test/unit/init.spec.ts` (45): flags, defaults and refusals, the marker language (every comment style, nesting, `!`, bad markers named by file and line), README commands per package manager, six site combinations (files, no marker left, languages and addresses written, versions pinned, what must be generated), the default site equals the starter minus markers, the folder rules (not empty, existing empty, nested, **nothing left behind** when the starter does not fit, also the folders made on the way), the word tables of `init.mjs` and `site.ts` agree. `test/unit/create-tinyzoo.spec.ts` (18): without questions, every answer from a flag, package manager from the user agent, refusals, install and generate steps and their failures, the questions asked and skipped, Ctrl-C at each question leaves the folder empty, validation of the answers as typed. `scripts/starter-check.mjs` is now a matrix of four packed-package sites, each installed from the tarballs, generated where needed, migrated, typechecked, built and started: **defaults** (`tinyzoo init`; the old deep check unchanged), **english-empty** (`--languages en --no-demo --presets none`: says it is ready, serves nothing it does not have), **all-with-german** (`create-tinyzoo --yes`, cs,en,de, every part: the words and addresses of each language, the switcher, a second seed changes nothing, the sitemap), **english-first** (`en,cs`, news and redirects: English demo, `/cs`, `/bakery` → `/about`, no contact form); `--only <name>` runs one. `scripts/consumer-check.mjs` also installs the packed `create-tinyzoo` on its own (one dependency, the bundle is complete and has no installed or built files, the version is tinyzoo's), runs it through `pnpm exec` with flags, checks the site it made and that a full folder is refused.
- **Not done.** `check:starter` is not in CI (it was not before; it needs a database and ten minutes). No `tinyzoo/init` export (see the decision). Words for languages other than cs, en and de are English until someone adds an entry to `WORDS`. The generated README keeps `pnpm` in comments inside `cms.config.ts` and the seed. A site's second-or-later language other than cs/en has no demo translation (it shows the first language's text, as any untranslated entry does).
- **Result** (`TEST_DATABASE_URL=…/cms_test_create`, starter and upgrade databases likewise, no Redis). `pnpm check` green: typecheck (root, docs check, playground, starter, website), then 100 files / 1374 tests passed, 3 files / 26 tests skipped (214 s for the tests). `pnpm check:starter` green: defaults, english-empty, all-with-german, english-first. `pnpm check:upgrade` green from `2506403` (106.5 s) and `tinyzoo@0.5.0` (76.3 s): no migration, no upgrade step. `pnpm check:consumer` green (the app from the tarballs, then the packed `create-tinyzoo`). All four on the code of this write-up's parent commit; the write-up changes nothing a check reads.
