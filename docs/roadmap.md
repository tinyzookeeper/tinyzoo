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
itself there.

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
