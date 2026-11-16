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
  journal entry to delete, then `tinyzoo generate` again). Matched by `created_at`,
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
- **Not done / left:** `ALTER COLUMN … SET NOT NULL` and `ADD COLUMN … NOT NULL`
  without a default (fail on existing rows) are not flagged; the changelog **Upgrade**
  sections arrive with slice B; the backups link in upgrading.md waits for slice D's
  recipe. The migrations folder is fixed at `server/db/migrations` for the CLI, as it
  was for `generate`.
