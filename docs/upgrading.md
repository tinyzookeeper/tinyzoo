# Upgrading

How a site moves from one tinyzoo version to the next without losing content, and
how to change your own content model (rename a field, remove a language) safely.
Written for people who build sites with tinyzoo; the last section is for the people
who work on tinyzoo itself.

## Version policy

- **0.x (now):** a minor version (0.2 → 0.3) may break things. Every such change is
  in the package's `CHANGELOG.md` under an **Upgrade** heading that says what your
  site has to do. A patch version (0.2.1 → 0.2.2) never needs anything from you.
- **From 1.0:** [semver](https://semver.org). The content API, the types of
  `@tinyzoo/client` and the config API (`defineEntity`, `f.*`, presets, plugins)
  only break in a new major version, and anything that goes away is marked
  deprecated for at least one minor version first.

## On every upgrade

```bash
pnpm up tinyzoo @tinyzoo/client      # 1. update both packages together
pnpm typecheck                       # 2. the compiler finds what changed in the config API and client types
pnpm exec tinyzoo upgrade            # 3. versions, migration, typed client, what is pending
git diff                             # 4. read the new migration (server/db/migrations) and the schema
git commit                           # 5. package update, migration, schema.ts and typed client in one commit
git push                             # 6. deploy
```

**Before you deploy, look at production.** Run `pnpm exec tinyzoo status` with
`DATABASE_URL` pointing at the production database (or at a restored copy of it).
It only reads. If it reports a migration under **Out of order**, the new version
would refuse to start there: a migration that drizzle once skipped silently (two
branches had each generated one, and the older one was merged second) is now
stopped instead of ignored. Fix it first —
["Migration … was never applied"](#migration--was-never-applied-but-a-newer-one-was)
below says how, and why deleting the migration is the wrong fix once it has run
anywhere. Also read the new migration for statements the guard flagged (see
[the guard](#the-guard-in-tinyzoo-generate)).

`tinyzoo upgrade` does five things, and stops at the first that fails:

1. checks that your `nuxt`, `@nuxt/ui`, `drizzle-orm` and `zod` fit what this
   tinyzoo asks for (it warns, it does not stop);
2. writes `server/db/schema.ts` from `cms.config.ts`;
3. generates the migration for the difference, with the
   [guard against statements that lose data](#the-guard-in-tinyzoo-generate);
4. regenerates the typed client when your `package.json` has a `cms:client` script;
5. runs `tinyzoo status` against `DATABASE_URL` (if it can reach it) and prints the
   next steps.

**Deploy.** With `NUXT_CMS_MIGRATIONS_ON_START=true` the app applies the new
migrations and upgrade steps itself when it starts (see
[deploying.md](deploying.md#migrations)). Without it, run `pnpm exec tinyzoo up`
against the production database before the new version starts. Take a backup first
if the migration changes data.

**Rollback** is restoring the backup you took before the deploy (see the backups
notes in [deploying.md](deploying.md#pushbase-step-by-step)) and deploying the previous version.
Migrations only go forward; there are no "down" migrations.

**Do not use `drizzle-kit push`** on a tinyzoo site. It compares the database with
your `schema.ts` and makes them equal — and tinyzoo's own bookkeeping table,
`cms_upgrades`, is deliberately not in `schema.ts`, so `push` proposes to drop it
(the next start would then re-run every upgrade step). It also skips the migration
history, the guard and the order check. Change the schema with `tinyzoo generate`
and apply it with `tinyzoo up` or at start, as above.

## The two-step rule

> A release that changes the shape of the database never removes what the
> previous release still uses.

Why: a deploy is not instant. For a while the **old** version of your site is still
serving visitors while the **new** one has already migrated the database (with
several replicas, or a platform that starts the new instance before it stops the
old one). If the migration dropped or renamed a column, the old version fails on
every request that touches it until it is replaced.

So a breaking change takes two releases:

| Release | What you do |
|---|---|
| **N** | Add the new column, field or table. Keep the old one in `cms.config.ts`. Fill the new one from the old (a line of SQL in the migration, see below) and make the site use the new one. |
| **N+1** | Once N is deployed everywhere and nothing reads the old one: remove it from `cms.config.ts` and generate the migration with `tinyzoo generate --allow-drop`. |

Not every site needs this care. A staging site, or one with a single instance that
can answer errors for a few seconds during a deploy, can do it in one release and
accept the short gap. That is a choice you make with `--allow-drop` (or `y` at the
question); tinyzoo never makes it for you.

### The guard in `tinyzoo generate`

After drizzle-kit has written a migration, tinyzoo reads it and stops on two kinds
of statements, each in plain words.

**Statements that lose data or break the running version** — `DROP TABLE`,
`DROP COLUMN`, `DROP TYPE`, a column type change and a rename of a table, column
or type:

```
⚠ 0018_blushing_white_queen.sql would:
  • drops column `tagline` of `site_settings` — its content is lost
```

**Statements that may fail on rows that already exist** — a required column
without a default, `SET NOT NULL` on a column, a new unique constraint or unique
index, a new `CHECK`:

```
⚠ 0019_quick_thing.sql would:
  • adds required column `summary` to `post` without a default — fails if `post` has rows; give the field a default, or add it optional first, fill it, then make it required
```

These do not lose anything, but when the new version starts and applies the
migration, Postgres refuses it on the rows that are there; the process exits,
the platform restarts it, and it fails again — the site is down (with one
replica, completely) until someone fixes the migration. Statements on a table the
same migration creates are not flagged: it is empty. See
[Adding a required field](#adding-a-required-field).

- In a terminal it asks **Keep the migration anyway? [y/N]**.
- Without a terminal (CI) or on **N** it deletes the new migration, its snapshot
  and its journal entry, and exits with code 1. Nothing was applied.
- `tinyzoo generate --allow-drop` keeps a migration whose statements lose data
  without asking; `tinyzoo generate --allow-risky` does the same for the second
  kind. One flag never covers the other: a migration with both needs both.

The question drizzle-kit itself asks about renames ("is this column created or
renamed from another column?") needs a terminal. Without one `tinyzoo generate`
fails and points here, instead of waiting for an answer that cannot come.

## Recipes

### Adding a required field

A field is required unless you write `.optional()`. Adding one to a collection that
already has entries makes drizzle-kit write
`ALTER TABLE "post" ADD COLUMN "summary" text NOT NULL;` — and Postgres cannot add a
column without a value to rows that exist. The guard stops on it
("adds required column `summary` to `post` without a default"). Pick one:

- **The field has a sensible value for old entries** — give it a default and
  generate again. The column is added as `DEFAULT '' NOT NULL` and every existing row
  gets the default:

  ```ts
  summary: f.text().withDefault(''),   // required; old entries start empty
  ```

  New entries may still leave it empty, since `''` is a value; if you want editors
  to be forced to write one, use the next option.
- **Old entries must be filled in first** — three releases, no gap:
  1. Add it **optional**: `summary: f.text().optional()`. Generate, deploy. The column
     is added as nullable; nothing can fail.
  2. Fill it: write the text in the admin for every entry, or set it with one SQL
     statement (`UPDATE "post" SET "summary" = "title" WHERE "summary" IS NULL;`,
     a statement in the next migration, or by hand against the database). Check that
     nothing is left: `SELECT count(*) FROM "post" WHERE "summary" IS NULL;`.
  3. Remove `.optional()`. Generate: the migration is `ALTER COLUMN "summary" SET NOT NULL`,
     which the guard flags too. Now you know no row is empty, so answer `y` (or use
     `--allow-risky`).

The same goes for **a new unique field** or a unique index (`SELECT "slug", count(*) FROM
"post" GROUP BY 1 HAVING count(*) > 1;` shows what would collide) and for turning an
optional field required.

On a site with no entries yet (a new site, a staging copy) there is nothing to
fail, and `--allow-risky` is fine.

### Renaming a field

Renaming `title` to `headline` in `cms.config.ts`; the database column follows.

1. Change the key in `cms.config.ts` (and the places that use it).
2. Run `pnpm exec tinyzoo generate` **in a terminal**. drizzle-kit asks *"Is
   `headline` column in `post` table created or renamed from another column?"*:
   choose **renamed from `title`**. Choosing "create" makes the migration add
   `headline` and **drop `title`** — the content of the field is gone.
3. The migration now contains `ALTER TABLE "post" RENAME COLUMN "title" TO "headline";`.
   tinyzoo lists it as a rename; answer `y` (or use `--allow-drop`) if a short gap
   during the deploy is fine.
4. Typecheck, regenerate the typed client, commit.

If you answered "create" by mistake, or you are working without a terminal: edit the
SQL by hand. Replace the pair

```sql
ALTER TABLE "post" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "post" DROP COLUMN "title";
```

with the single statement above. The snapshot drizzle-kit keeps describes the
schema, not the SQL, so it stays correct.

For a rename without any gap, use the two-step rule instead: in release N keep
`title`, add `headline`, copy in the migration (`UPDATE "post" SET "headline" = "title";`)
and have the site read `headline`; in release N+1 remove `title`.

A field that is `.localized()` lives in the `<entity>_locales` table — the same steps
apply to its column there.

### Renaming an entity

Renaming `defineEntity('post', …)` to `'article'` renames its table, its
`<entity>_locales` table, its many-to-many junction tables, its enums, and the
address of its content API (`/api/content/article`). The new name appears
everywhere else too: the typed client, `content.path` templates, redirects.

1. Rename it in `cms.config.ts` and run `tinyzoo generate` in a terminal.
2. drizzle-kit asks about each table that "appeared" — the entity's table, its
   `_locales` table and its junctions. Answer **renamed from …** every time. A "create"
   answer means a new empty table and the old one dropped, which tinyzoo will stop on.
3. Check the SQL: only `RENAME` and constraint changes, no `DROP TABLE`.
4. The CMS's own tables remember the entity's name as text. Add these to the migration
   (put them after the rename):

   ```sql
   UPDATE "cms_revisions" SET "entity" = 'article' WHERE "entity" = 'post';--> statement-breakpoint
   UPDATE "cms_audit" SET "entity" = 'article' WHERE "entity" = 'post';
   ```

   The search index rebuilds itself on the next start.
5. Keep the old address working for visitors with a redirect (the `redirects` preset).

### Removing `.localized()` from a field

Making a field localized is safe: what was written stays as the default language's
value. Removing it is not: the translations (every language but the default) live in
the `<entity>_locales` column, and the migration drops that column.

1. Export the translations you want to keep, one language at a time — for instance
   from the content API (`/api/content/post?locale=en`) — or copy them by hand.
2. Run `tinyzoo generate --allow-drop`.
3. The field now has the default language's text for everyone.

### Changing a field's type

drizzle-kit writes `ALTER COLUMN … SET DATA TYPE …`, which Postgres can only do
when it knows how to convert the values — text to a number it does not, and
values that do not convert fail the whole migration.

- **Values convert plainly** (a number to text, a short text to a longer one): the
  generated migration is fine. Answer `y`.
- **They need converting** (text to a number, text to a date): add the conversion by
  hand — `ALTER TABLE "post" ALTER COLUMN "n" SET DATA TYPE integer USING "n"::integer;`.
  Try it on a copy of your data first.
- **To keep the old values until you are sure**: two-step. In release N add a new
  field of the new type, fill it from the old one in the migration
  (`UPDATE "post" SET "n_new" = "n"::integer;`), switch the site over; in N+1 drop
  the old one.

### Turning on the page tree

`definePages({ tree: true })` is opt-in and the migration is safe on existing data, but it
changes a constraint, so know what it does:

1. Add `tree: true`, run `tinyzoo generate`. The migration **drops** `page_slug_unique` and
   `page_locales_slug_unique` (the address part is only unique under a parent now; the whole
   address is checked by the server instead) and adds `parent_id` and `position` (default 0).
   Dropping a constraint is not flagged by the guard, so it needs no `--allow-drop`.
2. `tinyzoo up`. Existing pages stay at the top level at the same addresses.
3. Add `defineRedirects()` if the site has none: moving a page or renaming its address part
   moves every page below it, and the redirects from the old addresses are what keeps old
   links and search results working. Without it the change report (`cms:change`, the webhooks:
   `moved`, `paths`) still lists every address that changed, so the site can purge its cache.
4. A website that fetches a page by its address sends the whole address as one path segment,
   slashes escaped (`/api/content/page/o-nas%2Ftym`; `@tinyzoo/client` does it).
5. Turning it **off** again is a two-step change like any other removal of a column (see the
   two-step rule): move every page to the top level first, and mind that the address part must
   then be unique again.

Lowering `maxDepth` later does not move pages that are already deeper; it only refuses new
nesting.

### Removing a block type

The blocks of a page are stored as JSON inside the entry, so a migration neither
sees nor changes them. If you delete a block type from the config while entries
still contain it, those entries cannot be saved until the block is removed from
them (older saved versions in the history keep the old shape).

1. Before removing the type, remove or convert its blocks. Find the entries:
   `SELECT id FROM "page" WHERE "blocks" @> '[{"type": "hero"}]';`
2. Then remove the type from `cms.config.ts`.

The same goes for renaming a field *inside* a block: the old values are not carried
over and are dropped on the next save. Rename it in two steps — keep both fields for
a release, copy the values over by editing the entries (or with a one-off SQL
`UPDATE` on the JSON), then remove the old one.

## Upgrade steps and `tinyzoo status`

Some upgrades need more than a schema change: a column that has to be filled for
existing rows, an extension the database has to enable. tinyzoo ships these as
**upgrade steps**. Every step has an id, the tinyzoo version that introduced it and
a one-line description, and runs once per database. You do not write them or run
them by hand: the app runs them when it starts (with `NUXT_CMS_MIGRATIONS_ON_START`)
and `tinyzoo up` runs them, in the same transaction and lock as your own migrations —
so an upgrade either happens completely or not at all. Steps that need the new
schema run after your migrations, steps that your migrations need run before them.
On an empty database (a new site) steps are recorded without running: there is
nothing to fill.

`pnpm exec tinyzoo status` shows where a database stands, and reads it only:

```
Database: db.example.com:5432/site
Migrations: 17 applied, 1 pending
  pending  0018_add_summary
Upgrade steps: 1 applied, 0 pending

✗ not up to date — run `tinyzoo up`, or start the app with NUXT_CMS_MIGRATIONS_ON_START=true
```

The exit code is `0` when nothing is pending, `1` when a migration or step is
pending or out of order, and `2` when the database could not be reached — so a
deploy script can use it. It needs `DATABASE_URL` (from the environment or the
site's `.env`).

### "Migration … was never applied, but a newer one was"

The app refuses to start, and `tinyzoo status` lists the file under **Out of order**.
Two branches each generated a migration; one was merged and applied first, and the
other has an older timestamp. drizzle-kit would skip it for good, silently — so
tinyzoo stops instead. (This check is new: a site where drizzle *had* silently skipped
a migration in the past will now refuse to start. Run `tinyzoo status` against
production before you deploy a tinyzoo version that has it, as the
[checklist](#on-every-upgrade) says.)

What to do depends on whether the migration ever ran on another database.

**It ran nowhere else** (only the branch that was merged second has it):

1. Delete the migration's `.sql` file, its snapshot (`meta/<number>_snapshot.json`)
   and its entry in `meta/_journal.json`.
2. Run `tinyzoo generate` again. It writes one migration on top of the newest one,
   dated now, so it sorts after the others.

**It ran somewhere** — production applied it before the second branch was merged, or
you found it with `tinyzoo status` against production, or a colleague's database has
it. Deleting it and regenerating is **wrong on its own**: that database recorded the
old migration under its old date, so the regenerated one is a new migration to it, and
it would run the same `ADD COLUMN` / `CREATE TABLE` a second time and fail — the
deploy is stuck exactly as it was. Give the migration a later date *and* make its SQL
safe to run twice:

1. Do the same two steps as above, so the migration is regenerated with a date that sorts
   after the others (and a correct snapshot). Copy anything you had written by hand in
   the old file into the new one.
2. Edit the new `.sql` so it can run on a database that already has its changes:
   `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE [UNIQUE] INDEX IF NOT EXISTS`,
   `DROP … IF EXISTS`, and for a constraint `DROP CONSTRAINT IF EXISTS "name";` right before
   `ADD CONSTRAINT "name" …`. Data fixes (`UPDATE`) need a `WHERE` that matches nothing the second time.
3. Try it on a copy of production: `tinyzoo status`, then `tinyzoo up`.

The database that ran the old one keeps its record of it; `tinyzoo status` then
notes that it has a migration this code does not know. That is harmless.

Editing a migration that was already applied is not an error (it is matched by when
it was generated, not by its text) — but it does not change databases that applied it.
Add a new migration instead.

## For tinyzoo maintainers

### When a change needs an upgrade step

Whenever existing sites need something done that `tinyzoo generate` cannot write:

- a change to a `cms_*` table that needs **data** — a new column that must be filled
  for existing rows with something other than a constant default (the library flag on
  media had to be set `true` for every file that was already there);
- a database **extension** or any other statement drizzle-kit does not generate;
- a one-off repair of stored data after a bug.

Schema changes alone need no step: the site's own `tinyzoo generate` writes the
migration. Never write a step that depends on the names of the site's own entity
tables — those are the site's to name; steps may only touch `cms_*` tables.

### Writing one

Add it to `CORE_UPGRADE_STEPS` in `packages/cms/src/upgrades.ts` (plugins pass theirs
to the runner as well):

```ts
{
  id: 'fill-media-checksum',         // kebab-case; never changes once released (this one is an example)
  since: '0.3.0',                    // the tinyzoo version that introduces it
  description: 'Fill the checksum of media uploaded before the column existed',
  phase: 'after',                    // 'before': ahead of pending migrations; 'after': behind them
  // freshInstall: 'run',            // only when the migrations themselves need it
  // when: ({ pendingStatements }) => …   // run whenever this holds, instead of once
  run: async ({ run }) => {
    await run('UPDATE "cms_media" SET "checksum" = md5("key") WHERE "checksum" IS NULL')
  },
}
```

Rules:

- **Idempotent.** It runs again if its record was lost (a database restored from a
  backup that predates it) and, with `when`, whenever the condition holds. Write
  `WHERE col IS NULL`, `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`.
- **Order of phases.** A `before` step runs before the pending migrations: it can
  prepare what they need (an extension) but the new columns do not exist yet. An
  `after` step sees the new schema.
- **Fresh installs.** On a database with no applied migration steps are recorded
  without running, because a backfill has nothing to fill. Set
  `freshInstall: 'run'` for a step the first migration depends on (enabling pg_trgm).
- **`when`** receives `{ run, pendingStatements, freshInstall }`; `pendingStatements`
  is the SQL of the migrations about to be applied. Use it for a step that only
  matters for some migrations, as the pg_trgm step does for `gin_trgm_ops`.
- **Everything goes through `ctx.run`**, which is the migration transaction. Do not
  open another connection; a failure anywhere rolls the whole upgrade back.
- **Test it** in `test/unit/migrate.spec.ts`: a database migrated by the previous
  version's migrations, then `runUpgrade` with the step.
- **Say so in the changelog** under **Upgrade** if the site has anything to do
  beyond updating (usually nothing: the step runs by itself).

Bookkeeping is the `cms_upgrades` table (`id`, `since`, `applied_at`), created by the
runner itself. It is not part of the site's `schema.ts` on purpose: it must exist
before the first site migration runs, and a site that dropped or renamed it would
silently re-run every step.
