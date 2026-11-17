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
  `@tinyzoo/client`, the config API (`defineEntity`, `f.*`, presets, plugins), the webhook and
  the Nitro hooks, the CLI, the `cms` options and `NUXT_CMS_*` variables, and the admin's
  extension points only break in a new major version, and anything that goes away is marked
  deprecated for at least one minor version first. **[The public API](api-surface.md)** lists
  every one of them; everything else (other `Cms*` components, server utilities, anything
  tagged `@internal`, the database tables) can change in any minor release, with its
  changeset, and tinyzoo migrates the tables for you.

## From 0.1 to 0.2

Everything below is also in the changelog of 0.2.0. Do it in this order, on a copy of
the production database first (`tinyzoo backup`, then `tinyzoo restore` into a scratch
database: [deploying.md](deploying.md#backups-and-restore)).

1. **Update** both packages: `pnpm up tinyzoo @tinyzoo/client --latest`.
2. **Table names are `snake_case` now** (breaking). A site whose entities have a
   camelCase name (every site made from the 0.1.0 starter: `siteSettings`, `contactForm`,
   `formSettings`) has tables that change name. Entities named with one lowercase word
   (`post`, `page`, `news`) keep theirs. Run `pnpm exec tinyzoo generate` **in a terminal**.
   For every table and enum that changes, drizzle-kit asks whether it was *renamed* from
   another one or is new. Answer **renamed** every time, and pick the old table whose name
   matches the new one (`siteSettings` → `site_settings`, `siteSettings_locales` →
   `site_settings_locales`, `contactForm_status` → `contact_form_status`). The first entry,
   *create*, is highlighted: use the arrow keys. *Created* would drop the old table and its
   content, and the wrong source would move one table's rows into another.
3. **Read the migration.** It must hold only renames (`ALTER TABLE "siteSettings" RENAME TO
   "site_settings"`, `ALTER TYPE … RENAME TO …`) and, for tables with foreign keys or unique
   indexes, a constraint or index dropped and added again under the new name. It must
   **not** hold `DROP TABLE`, `CREATE TABLE` for one of your tables or `DROP COLUMN`: if it
   does, delete the migration (its `.sql`, `meta/<number>_snapshot.json` and its entry in
   `meta/_journal.json`) and start again from step 2. `tinyzoo generate` lists the renames
   and asks to keep the migration; here that is what you want, answer `y`.
4. **Search** arrives in the same migration: the `cms_search` table and the `pg_trgm`
   extension (the database user needs the right to `CREATE EXTENSION`, or the database
   owner does it once). The index fills itself on the next start.
5. **Apply it** with `pnpm exec tinyzoo up`, or at start with `NUXT_CMS_MIGRATIONS_ON_START=true`.
   Stop the old instances first: the old version does not find the renamed tables. Search
   your own code for raw SQL that names a table by its old camelCase name.
6. **Forms moved to a plugin.** The old `import { defineForm } from 'tinyzoo'` still works in
   0.2 and 0.3 and logs one deprecation line per helper; 0.4 removes it. Change the import to
   `tinyzoo/forms` and register the plugin. No migration, no change in the tables:

   ```ts
   import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'

   export const plugins = [formsPlugin()]   // next to your entities
   ```

   Restart `nuxt dev` after adding a plugin.
7. **Regenerate the typed client** (`pnpm cms:client`) and fix what the compiler finds: a
   required link field (a menu link's `url`) is `string | null` now, because the page it
   points at may be gone. Render a link only when it has an address; `cmsMenuTree` and
   `<CmsNav>` already skip links without one.
8. **Optional, when you want them:** the page tree ([turning it
   on](#turning-on-the-page-tree)), links that follow their page ([converting
   links](#converting-links-to-follow-their-page)), groups ([adding a group](#adding-a-group)),
   a seed file (`pnpm seed` in the new starter). The starter's own files
   (`cms.config.ts`, `app/pages/[...slug].vue`, `package.json`'s `seed` script, `seed/`) changed
   too: they are yours, so copy what you want from a fresh `tinyzoo init`.
9. **Nuxt UI's own words in the admin language** (optional, one line). Without it, the
   labels Nuxt UI draws itself ("Close", "Previous month", "Show password") stay English in
   a Czech or German admin. In `app/app.vue`:

   ```vue
   <script setup lang="ts">
   const uiLocale = useCmsUiLocale()   // the admin's language on /admin pages, nothing elsewhere
   </script>
   <template>
     <UApp :locale="uiLocale"> … </UApp>
   </template>
   ```

## From 0.2 to 0.3

Everything below is also in the changelog of 0.3.0.

1. **Update** both packages: `pnpm up tinyzoo @tinyzoo/client --latest`.
2. **drizzle-orm 0.45.** In your `package.json`, set `drizzle-orm` to `^0.45.4` and
   `drizzle-kit` to `^0.31.11`, then `pnpm install`. Your schema and migrations stay as
   they are: `tinyzoo generate` writes no new migration for this.

## From 0.3 to 0.4

Everything below is also in the changelog of 0.4.0. tinyzoo 0.4 runs on nuxt-auth-utils 0.6,
which needs Nuxt 4.6 and seals the sign-in cookie differently.

1. **Update** both packages: `pnpm up tinyzoo @tinyzoo/client --latest`.
2. **Nuxt 4.6 and nuxt-auth-utils 0.6.** In your `package.json`, set `nuxt` to `^4.6.4` and
   `nuxt-auth-utils` to `^0.6.2`, then `pnpm install`. Until you do, `tinyzoo upgrade` warns that
   they do not fit. Nuxt 4.6 builds with Vite 8; if your own `nuxt.config.ts` has Vite or Rollup
   options, check them against [Vite 8's migration guide](https://vite.dev/guide/migration).
   Your schema and migrations stay as they are: `tinyzoo generate` writes no new migration for this.
   If your site uses nuxt-auth-utils itself (member sign-in, OAuth, WebAuthn), read its
   [migration guide from 0.5](https://github.com/atinux/nuxt-auth-utils#migrate-from-v05) and the
   [0.6.0 release notes](https://github.com/atinux/nuxt-auth-utils/releases/tag/v0.6.0) too:
   sessions are read-only in WebSocket handlers, the cookie is renamed, a session's `maxAge`
   counts from its last write, and the `seal`, `crypto`, `generateId` and session header options
   are gone.
3. **`NUXT_APP_SECRET`.** The sign-in cookie is now sealed with a key derived from Nuxt's app
   secret, `NUXT_APP_SECRET`, and nuxt-auth-utils no longer reads `NUXT_SESSION_PASSWORD`.
   - Rename the variable on your platform (and in `.env`), **keeping its value**:
     `NUXT_SESSION_PASSWORD=…` becomes `NUXT_APP_SECRET=…`.
   - If you set `runtimeConfig.session.password` in `nuxt.config.ts`, move that value to
     `NUXT_APP_SECRET` in the environment and remove it from the config.
   - If your site already sets `NUXT_APP_SECRET` (for `nuxt-og-image`, say), remove
     `NUXT_SESSION_PASSWORD` and check that `NUXT_APP_SECRET` is **at least 32 characters** long.
     A shorter one stops the server from starting: replace it with a new one
     (`openssl rand -base64 32`). Everything signed with the old one changes with it:
     `nuxt-og-image`'s signed image URLs change, and everyone signs in again.

   Tinyzoo 0.4 and 0.5 let a deploy that still had only `NUXT_SESSION_PASSWORD` (or the
   `nuxt.config` password) keep working, with a deprecation warning: its value stood in for
   `NUXT_APP_SECRET`. **0.6 removed that** ([From 0.5 to 0.6](#from-05-to-06)): rename the variable
   before you update to it. With no app secret (or with one shorter than 32 characters), the
   server does not start and names the variable. In development Nuxt makes an app secret by
   itself when there is none.
4. **Everyone signs in again, once.** The sign-in cookie has a new name (`nuxt-auth-session`, was
   `nuxt-session`) and a new format, so the sessions from before the update no longer open the
   admin. Accounts and passwords are unchanged. Renaming the variable later, with the same value,
   does not sign anyone out again; a new value does. A session still ends 14 days
   (`runtimeConfig.session.maxAge`) after signing in, however often it is written since.
5. **Forms only from `tinyzoo/forms`.** `defineForm` and `defineFormSettings` are no longer
   exported from `tinyzoo` (deprecated since 0.2). If your `cms.config.ts` still imports them
   from there, `pnpm typecheck` says so; change the import and register the plugin, as in
   step 6 of "From 0.1 to 0.2" above. No migration, the tables stay:

   ```ts
   import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'

   export const plugins = [formsPlugin()]
   ```

## From 0.4 to 0.5

Everything below is also in the changelog of 0.5.0.

1. **`/sitemap.xml` comes from `@nuxtjs/sitemap`.** tinyzoo installs [Nuxt SEO's sitemap
   module](https://nuxtseo.com/docs/sitemap) itself and hands it the same entries as before
   (`cms.sitemap.paths` and the `cms:sitemap` hook work as they did; see
   [the sitemap](guide/content-api.md#the-sitemap)). Open `/sitemap.xml` after the update and check:
   - **It is there.** If your `nuxt.config.ts` has `sitemap: { enabled: false }` (sites with
     `@nuxtjs/seo` that switched its sitemap off because tinyzoo served one), remove it: it now
     turns off the only sitemap. If your site has its own `server/routes/sitemap.xml*`, remove
     that, or keep it and set `sitemap: { enabled: false }`.
   - **The addresses start with the website's.** They come from `NUXT_SITE_URL` (or `site.url`)
     when set, otherwise `NUXT_CMS_PUBLIC_URL`. Without either, a production sitemap is a `404`,
     as before.
   - **Your own pages are listed too.** The module adds the site's static pages
     (`pages/kontakt.vue`), so an address you also had in `cms.sitemap.paths` is listed once. Leave
     a page out with `sitemap: { exclude: ['/hledat'] }`, or a `robots: false` route rule.

   Nothing else changes: `/api/content/_sitemap`, the tables and the content API are as they were.
   The sitemap now carries `x-default` next to the languages, and it is cached for an hour
   (`Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600`); a content
   change clears the server's copy at once.

## From 0.5 to 0.6

Everything below is also in the changelog of 0.6.0. 0.6 is the last minor before 1.0: it removes what was
deprecated, marks what is internal, and writes down [the public API](api-surface.md) that 1.0 freezes.

1. **Update** both packages: `pnpm up tinyzoo @tinyzoo/client --latest`.
2. **`NUXT_APP_SECRET` is required; `NUXT_SESSION_PASSWORD` is no longer read.** A site that was set up
   before 0.4 may still have only `NUXT_SESSION_PASSWORD` (or `runtimeConfig.session.password` in
   `nuxt.config.ts`): 0.4 and 0.5 used it as the app secret and warned. 0.6 does not: the server
   **refuses to start** and says `NUXT_APP_SECRET is not set` and to rename the variable. **Before you
   deploy 0.6**, on your platform and in `.env`:
   - rename `NUXT_SESSION_PASSWORD=…` to `NUXT_APP_SECRET=…`, **keeping the value**: nobody is
     signed out;
   - or move `runtimeConfig.session.password` from `nuxt.config.ts` to `NUXT_APP_SECRET` in the
     environment and remove it from the config;
   - the value is at least 32 characters (`openssl rand -base64 32` makes one). A site that
     already sets `NUXT_APP_SECRET` needs nothing: an old `NUXT_SESSION_PASSWORD` next to it is
     ignored, and can be deleted.

   A site that already runs 0.5 without the deprecation warning (`[tinyzoo] deprecated:
   NUXT_SESSION_PASSWORD is used as the app secret…`) in its log has nothing to do, **unless its secret
   is the example value** (next point).

   **The example secret is refused in production.** The starter's `.env.example` has always held
   `NUXT_APP_SECRET=change-me-to-a-long-random-string-32-chars-min` (before 0.4 as `NUXT_SESSION_PASSWORD`),
   and `cp .env.example .env` followed by a deploy with it set a secret that anyone can read: with it, anyone
   can forge a sign-in cookie. With `NODE_ENV=production` the server now **refuses to start** with that exact
   value, naming the variable. Look at what your server runs with (the platform's environment, not
   only `.env`); if it is the example, set a new one **before you deploy 0.6** (`openssl rand -base64 32`).
   That signs everyone out once, accounts and passwords stay. Do not "keep the value" when renaming
   `NUXT_SESSION_PASSWORD` if it is this one. In development the server starts and warns. A site made by
   0.6's `tinyzoo init` or `pnpm create tinyzoo` has a `.env` with a random secret of its own, and its next steps
   no longer say to copy `.env.example`.
3. **Deprecations that start now** (a warning at build or start; removed in 1.0, so change them
   during 0.6):
   - `cms.databaseUrl` in `nuxt.config.ts` writes the database address, password included, into the
     build. Set `DATABASE_URL` (or `NUXT_CMS_DATABASE_URL`) in the environment and delete the option.
   - `import type { FormOptions } from 'tinyzoo'`: import it from `tinyzoo/forms`.
   - A field named `page`, `limit`, `sort`, `dir` or `q` in a collection of the public content API has the
     name of a parameter of its list, so it cannot be a filter. Rename the field (a rename is a
     migration: [Renaming a field](#renaming-a-field)).
4. **Internal exports.** Many helpers exported from `tinyzoo` (the tree, search, link and migration
   functions, the system tables, `buildRegistry`…) are tagged `@internal`: the server, the admin and
   the CLI use them, a site should not. They still work, and can change in any minor release. Everything
   else that `tinyzoo`, `tinyzoo/forms`, `tinyzoo/module` and `@tinyzoo/client` export is listed in
   [the public API](api-surface.md). If your code imports an `@internal` name, tell us what it needs
   and use the documented API meanwhile.
5. **Custom roles and per-field permissions.** A site can now define roles of its own and say, per
   field, who reads and who edits it ([Roles and permissions](guide/roles.md)). **A site that does neither
   behaves exactly as before: there is nothing to do, and no migration** (`cms_users.role` is a text column; the
   roles live in `cms.config.ts`). To use them:
   - `export const roles = defineRoles({ translator: { from: 'editor', … } })` from `cms.config.ts`, above the
     entities that name it; `f.text().access({ read: [...], edit: [...] })` on a field. Then give people the
     new role in Settings → Team.
   - Your own row-level `access` rules get the person with a new `base` (the built-in role they are or
     extend, `'admin' | 'editor' | 'author'`) next to `role`. If a rule says `user.role === 'author'` and you add a
     role built on author, change it to `user.base === 'author'`, or that role is not held to it.
   - Two behaviours differ from 0.5, in cases that did not arise through the admin:
     an account whose stored role is **not** `admin`, `editor` or `author` (typed into the database by hand, or
     left by a role you removed) now has **no access** and sees "Your role no longer exists", where before it was
     treated as an editor; and with `cms.auth.mode: 'external'`, once you define roles, a role name from your
     sign-in that you did not define has no access either (a site without `defineRoles` keeps the old behaviour).
     `tinyzoo status` lists accounts whose role the config does not know.

6. **Per-language publishing (optional).** An entity can now publish each language on its own:
   `publish: { …, perLocale: true }` ([the guide](guide/content-model.md#publishing-each-language-on-its-own)).
   **If you do not turn it on, nothing changes**: no step, no migration, the same pages, lists,
   sitemap and webhooks as in 0.5. To turn it on for an entity with `.localized()` fields:

   1. Add `perLocale: true` to its `publish` in `cms.config.ts`.
   2. `tinyzoo generate`, review and commit the migration. It adds two nullable columns to the
      entity's translation table (`<entity>_locales`: `published`, `published_at`), nothing else.
   3. `tinyzoo up` (or start with `NUXT_CMS_MIGRATIONS_ON_START`).

   There is no data to move. Every language starts **following the default language**, so every
   page, list, sitemap entry and `hreflang` alternate is exactly as before, translations and
   entries without a translation alike. A language gets a state of its own when an editor
   publishes, unpublishes or schedules it. Not for page trees (`tree`) yet; the config check
   says so when the option is combined with one.

   What is new for a site that turns it on: a language that is not published answers `404` for
   the item and is left out of its list, the sitemap, the `hreflang` alternates, the search and
   links; the webhook for it names the language in `locale` (`entry.published` and
   `entry.unpublished`, the payload keeps its shape). A site that had its own code deciding
   what to show per language can drop it.

7. **`pnpm create tinyzoo`: nothing to do.** A new package, `create-tinyzoo`, makes a site and
   asks for the languages, the parts (news, contact form, redirects, search) and the demo content.
   `tinyzoo init <folder>` gets the same options (`--languages`, `--presets`, `--demo` /
   `--no-demo`, `--package-manager`) and makes the same site as before without them. A site you already
   have is not touched: its files are yours. If you want what a fresh starter does now (its
   website reads the languages and its own few words from `app/utils/site.ts`, the search page
   is `app/pages/search.vue`), make a scratch site and compare it with yours
   (`pnpm dlx tinyzoo init ../scratch`, then `diff -r app ../scratch/app`).

8. **A decimal is a string in your types (`f.number({ int: false })`).** The column is `numeric`, and a select and
   the content API have always returned a string (`"19.99"`), but `Row`, `Insert` and `Update` said `number`.
   In 0.6 the types tell the truth: a `Row` has `string`, and an `Insert` or `Update` takes `number | string`.
   **Typed code that reads a decimal as a number stops compiling** (`row.price * 2`, `price.toFixed(2)`). Run
   `tsc` / `nuxt typecheck` after updating and fix each place with `Number(...)`:

   ```ts
   const total = Number(row.price) * quantity      // was: row.price * quantity
   const shown = Number(row.price).toFixed(2)      // was: row.price.toFixed(2)
   ```

   Nothing changes at run time: no migration, and the content API, the OpenAPI document and the generated client
   types are the same (they already said string). Two small things that are new: a decimal sent to a write
   may be a number or a numeric string (the admin used to fail on a decimal it had not touched), and it is
   stored as the string; a default is now written as a string (`.withDefault('0')`). A decimal inside a block, a list or a
   group is typed `string` too; items saved before 0.6 may hold a number there, so read it with `Number(...)` as well.
   A whole number (`f.number()`, `int: true`) is a number, as before.
9. **More deprecations** (a warning at build or start; removed in 1.0, so change them during 0.6):
   - `defineEntity('settings', { singleton: true, … })`: write `defineSingleton('settings', { … })`, which takes the same options.
     Nothing else changes (same table, same address, same admin).
   - The variables `CMS_SCHEDULER_CRON` and `CMS_RETENTION_CRON`: set `scheduler: { cron: '…' }` and
     `retention: { cron: '…' }` in the `cms` options of `nuxt.config.ts` (new). They are read **when the site is built**,
     as before: a change needs a rebuild, and setting them on a running server does nothing. The option wins over the variable.
10. **An `access` rule's `user` is typed** (`CmsAccessUser`: `id`, `email`, `name`, `role`, `base`, `locale`; it was `any`).
    Rules that read those fields compile unchanged. A rule that reads something your external sign-in adds to the person
    (a tenant, groups) gets it as `unknown`: check it before you use it (`typeof user.tenant === 'string'`), or write
    `(user as { tenant?: string }).tenant`. With external sign-in, `email` and `name` are now `''` and `locale` is `null`
    where your sign-in did not send them (they were missing).
11. **Smaller changes, nothing to do:**
    - `cms.content.publicUrl` falls back to `cms.publicUrl` (the OpenAPI `servers[].url` was relative when only the second was set).
    - `cms.forms.notifyTo` also takes a list of addresses (`NUXT_CMS_FORMS_NOTIFY_TO` stays one comma-separated string).
    - `defineForm` returns an `Entity` typed from its fields (and `status`): `Row<typeof ContactForm>` is no longer loose.
    - The [frontend kit](api-surface.md#the-frontend-kit) (`<CmsBlocks>`, `<CmsImage>`, `<CmsContent>`, `<CmsNav>`,
      `<CmsHighlight>`, `<CmsForm>`, `useCmsSeo()`, `useCmsSearch()`, `useCmsUiLocale()`) is part of what 1.0 freezes; their props
      are exported as types (`CmsImageProps`…). Other `Cms*` components are the admin's and internal.
    - `createClient` (generated, typed) and `createCmsClient` (the untyped runtime in `@tinyzoo/client`) keep their names; the
      [client guide](guide/content-api.md#typed-clients--openapi) says which is which.
    - `CMS_ALLOW_REQUEST_ORIGIN` and why `NUXT_CMS_AUTH_SETUP_TOKEN` is an environment variable only are documented
      ([deploying](deploying.md)).

**Also new:** `tinyzoo help` prints every command and flag. `CmsWebhookPayload`, `CmsAdminField`,
`CmsFieldEditProps` and `CmsFieldCellProps` are exported as types for webhook receivers and your own
field renderers, and `CMS_WEBHOOK_HEADERS` as a constant (the names of the webhook's headers). A custom
field renderer now gets a `readOnly` prop (`true` when the person's role may read the field but not edit
it, or the entry is read-only for them): a renderer that is not made of native form controls should stop
editing when it is set ([the admin guide](guide/admin.md#extensibility--the-field--view-registry)).

## On every upgrade

```bash
pnpm up tinyzoo @tinyzoo/client --latest   # 1. update both packages together
pnpm typecheck                       # 2. the compiler finds what changed in the config API and client types
pnpm exec tinyzoo upgrade            # 3. versions, migration, typed client, what is pending
git diff                             # 4. read the new migration (server/db/migrations) and the schema
git commit                           # 5. package update, migration, schema.ts and typed client in one commit
git push                             # 6. deploy
```

**Why `--latest`.** `tinyzoo init` writes `^0.2.0`, and on 0.x a caret range stops at
the next minor (`^0.2.0` means `>=0.2.0 <0.3.0`), so a plain `pnpm up` never moves a
site from 0.2 to 0.3, which is exactly where breaking changes live. `--latest` ignores
the range and rewrites it. Read the new version's entry in `CHANGELOG.md` (the
**Upgrade** headings; it is in the repository and on each release, not inside the
package) before you update. The two packages always share one version number; keep them
on the same.

**The files `tinyzoo init` made are yours.** An upgrade never rewrites your
`cms.config.ts`, your pages or your components. When a release changes the starter
(a new page route, a new script), the **Upgrade** notes say what to copy. To see
the difference for yourself, make a scratch site with the new version (`pnpm dlx
tinyzoo init ../scratch`) and compare it with yours (`diff -r app ../scratch/app`).

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

### Adding a group

`f.group({ fields })` is one jsonb column. On an existing entity add it `.optional()`:
the migration is a nullable `ADD COLUMN`, which is safe on rows that already exist (the
same goes for a `.localized()` group, whose column is added to the translations table).
A required group is a `NOT NULL` column and needs a default first — see "Adding a
required field" above. Changing the fields inside a group later is a change to stored
JSON, not to the schema: no migration is generated. Adding an optional field is free, and
a field that was renamed or removed has no `version` / `upgrade` hook yet (groups are
not versioned): keep both names readable for one release, or move the data in a script.

### Converting links to follow their page

Links picked in the admin before this version were stored as the page's address, so
renaming the page broke them. Links picked now are stored as `cms:<entity>/<id>` and
follow the page; the old ones keep working as the addresses they are until you convert
them:

```bash
tinyzoo links:convert --dry-run   # what it would convert, and what it could not match
tinyzoo links:convert             # do it
```

Run both from the site's folder; the database is `DATABASE_URL` from the environment or
the site's `.env`, like `tinyzoo up`.

An address is converted only when it is exactly the current address of **one published**
entry **in the language the link is served in** (with the website's fallbacks): an entry's
own row and its default-language content count as the default language, a translation as
its language. A reference is served as the target's address in the language asked for, so
any other match would change what visitors get. Addresses no entry has, another language's
address of an entry, addresses of entries not published yet, addresses two entries share
and addresses with a `#anchor` or `?query` are listed and left as typed: pick those
entries again in the link picker. The home page (`/`), a list page that is not an entry
(`/aktuality`) and every other fixed page of the site are never converted: they are not
entries, so there is nothing to follow, and they stay as typed. External links, `mailto:` and `tel:` are
not touched; neither are saved versions (History) or `updatedAt`. If it reports blocks
stored at an older version, run `tinyzoo content:migrate` first. Afterwards purge the
website's cache (the content API answers changed), and make sure whatever consumes the
API handles a link field that is `null` (the target is gone or not published).

A site with a **seed** (`seed/index.ts`) that writes typed addresses with `s.upsert` would
write them back over the converted links on its next run: have the seed write references
(`s.link('', entry).url`, as the starter's does), or use `s.create` for those pages
([Seeding](guide/seeding.md)).

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
- **`--allow-drop` does not write the conversion for you.** The guard stops on a type
  change, and `tinyzoo generate --allow-drop` keeps the generated migration *as it is*:
  without `USING` Postgres refuses it (`column "bio" cannot be cast automatically to type
  jsonb`) when `tinyzoo up` runs it. Edit the `.sql` file before you apply it. The guard's
  message points here for that reason.
- **Plain text to rich text** (`f.text()` → `f.richtext()`, a `text` column becoming `jsonb`)
  is such a case: wrap each text in a one-paragraph document, and do the same for the
  `<entity>_locales` table if the field is `.localized()`:

  ```sql
  ALTER TABLE "team_member" ALTER COLUMN "bio" SET DATA TYPE jsonb
    USING CASE WHEN "bio" IS NULL OR "bio" = '' THEN NULL
      ELSE jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', "bio"))))) END;
  ```

- **To keep the old values until you are sure**: two-step. In release N add a new
  field of the new type, fill it from the old one in the migration
  (`UPDATE "post" SET "n_new" = "n"::integer;`), switch the site over; in N+1 drop
  the old one.

### Turning on the page tree

`definePages({ tree: true })` is opt-in and the migration is safe on existing data, but it
changes a constraint and your website needs one change, so know what it does:

1. Add `tree: true` to `definePages({ … })`, run `tinyzoo generate`. The migration is
   five statements (the names are for a pages collection called `page`):

   ```sql
   ALTER TABLE "page" DROP CONSTRAINT "page_slug_unique";
   DROP INDEX "page_locales_slug_unique";
   ALTER TABLE "page" ADD COLUMN "parent_id" uuid;
   ALTER TABLE "page" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
   ALTER TABLE "page" ADD CONSTRAINT "page_parent_id_page_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."page"("id") ON DELETE restrict ON UPDATE no action;
   ```

   The address part is only unique under a parent now (the server checks the whole address
   instead). The guard has nothing to say about it: no table or column is dropped, and the new
   column has a default, so it needs neither `--allow-drop` nor `--allow-risky`.
2. `tinyzoo up`. Existing pages stay at the top level at the same addresses.
3. **Change the website's page route.** The site has to ask the content API for a page by its
   *whole* address, with the slashes escaped, as one path segment. A route written before the
   tree (`/api/content/page/${slug.join('/')}`) finds top-level pages as before and answers
   **404 for every nested page**: the API sees `page/o-nas/tym` as a different address. In the
   starter's `app/pages/[...slug].vue` it is one word:

   ```ts
   `/api/content/page/${encodeURIComponent(parts.value.join('/') || 'home')}`
   ```

   With `@tinyzoo/client`, `cms.page.get('o-nas/tym')` does the escaping for you. The new
   starter's version of that file also draws the breadcrumbs from the page's `breadcrumbs`.
4. Add `defineRedirects()` if the site has none: moving a page or renaming its address part
   moves every page below it, and the redirects from the old addresses are what keeps old
   links and search results working. Without it the change report (`cms:change`, the webhooks:
   `moved`, `paths`) still lists every address that changed, so the site can purge its cache.
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

**Plugins** (see [plugins.md](plugins.md)) bring their own steps. They run in the same
pass, in the same transaction and lock, and show in `status` with the plugin's name
and its own version, not tinyzoo's:

```
Upgrade steps: 2 applied, 1 pending
  pending  events:backfill-place (events 0.1.0) — Events saved without a place get "To be announced"
```

Updating a plugin is the same routine as updating tinyzoo: read its changelog, run
`tinyzoo generate` (its collections may have changed), and `tinyzoo up`. The plugin's
steps are recorded as `<plugin>:<id>`; never rename a plugin, or its steps would run
again.

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

### The upgrade test

Every pull request runs a real upgrade: a site made on an older tinyzoo is moved to the
code in the pull request with the steps this guide gives (`tinyzoo upgrade`, then start with
migrations on start), and its content is compared before and after. If it fails, a site on
that version would have failed too: fix the change, or give it the steps and the changeset
**Upgrade** section it needs. What it checks, which versions it starts from and how to add a
hook for a documented manual step: CONTRIBUTING.md ("The upgrade test") and
`scripts/upgrade-check/README.md`.

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

Add it to `CORE_UPGRADE_STEPS` in `packages/cms/src/upgrades.ts`. (A plugin lists its
own in `upgrades` of `defineCmsPlugin`: [plugins.md](plugins.md#upgrade-steps).)

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
