# Upgrading

This page shows how to move a site from one tinyzoo version to the next without losing content. It also shows how to change your own content model, for example how to rename a field or remove a language.

It is written for people who build sites with tinyzoo. The last section is for the people who work on tinyzoo itself.

## Version policy

- **Since 1.0:** [semver](https://semver.org). These only break in a new major version, and anything that goes away is marked deprecated for at least one minor version first:
  - the content API and the types of `@tinyzoo/client`
  - the config API (`defineEntity`, `f.*`, presets, plugins)
  - the webhook and the Nitro hooks
  - the CLI, the `cms` options and the `NUXT_CMS_*` variables
  - the admin's extension points
- **[The public API](api-surface.md)** lists every one of them. Everything else can change in any minor release, with a changeset. That covers the other `Cms*` components, the server utilities, anything tagged `@internal`, and the SQL tables and their column names (an entity's `table` object is frozen for reading, see [the public API](api-surface.md#types)). tinyzoo migrates the tables for you, and its own `cms_*` tables only gain things within 1.x.
- **Minor versions** (1.1, 1.2) add things. When one asks something of your site, such as a new migration, its `CHANGELOG.md` entry has an **Upgrade** heading that says what to do.
- **You can skip minor versions** within 1.x. See [Skipping minor versions](#skipping-minor-versions).
- **Patch versions** (1.0.1 → 1.0.2) never need anything from you.
- **Before 1.0 (0.x)**, a minor version (0.2 → 0.3) could break things. Each break is under the **Upgrade** heading of that version, and each one has its section below.

## On every upgrade

1. **Read the changelog.** Open the new version's entry in `CHANGELOG.md` and read its **Upgrade** headings. The file is in the repository and on each release, not inside the package.
2. **Update, check, upgrade.** Run the first four commands below. `tinyzoo upgrade` may rewrite the typed client, so the compiler runs once more after it. The first command stays within 1.x. To a new major, or from 0.x, name the version instead ([how](#why---latest)).
3. **Read the result.** Run `git diff` and read the new migration and the schema.
4. **Look at production.** With the new version installed, run `pnpm exec tinyzoo status` against the production database. An older CLI may not see what the new version refuses. See [Before you deploy, look at production](#before-you-deploy-look-at-production).
5. **Commit.** Put the package update, the migration, `schema.ts` and the typed client in one commit.
6. **Deploy.** The migrations must run before the new version starts. [Deploy](#deploy) says how; on a host that deploys on every push, set that up before you push.

```bash
pnpm up tinyzoo @tinyzoo/client      # update both packages together, within 1.x
pnpm typecheck                       # the compiler finds what changed in the config API and client types
pnpm exec tinyzoo upgrade            # versions, migration, typed client, what is pending
pnpm typecheck                       # again, against the new typed client
git diff                             # read the new migration (server/db/migrations) and the schema
git commit                           # package update, migration, schema.ts and typed client in one commit
git push                             # deploy
```

### Skipping minor versions

Within 1.x you can go from any version to any later one in one step: 1.1 straight to 1.4 is safe.

- tinyzoo's own tables (`cms_*`) only gain things within 1.x. No column that holds data is dropped, renamed or given a new type before 2.0.
- Upgrade steps are never removed within 1.x. Each one still works on every later 1.x schema.

So `tinyzoo upgrade` and the start of the new version catch up on everything in between. Read the **Upgrade** headings of every version you skip, oldest first.

### Why `--latest`

Since 1.0 you do not need `--latest`.

`tinyzoo init` writes `^1.0.0`. A caret range takes every 1.x minor and patch, so a plain `pnpm up tinyzoo @tinyzoo/client` gets the newest 1.x. It never moves you to 2.0 by itself.

The two packages always share one version number. Keep them on the same one.

**To a new major, or from 0.x,** name the version: `pnpm up tinyzoo@^1.0.0 @tinyzoo/client@^1.0.0`. Then do every section below from your version up to the new one, oldest first. Do not use `--latest` for this. It jumps to the newest major before you have read its section.

If your site is more than one version behind, pick one of these:

- **One version at a time.** Name the next one: `pnpm up tinyzoo@^0.4.0 @tinyzoo/client@^0.4.0`. Do that version's section below, build, start and check the site, then take the next one.
- **All at once.** Name the version you want, then do every section from your version up to it, oldest first, before you deploy.

Both work. A site made with 0.2.0 has been taken to 1.0 both ways.

**Before 1.0.** `tinyzoo init` wrote `^0.2.0`. On 0.x a caret range stops at the next minor: `^0.2.0` means `>=0.2.0 <0.3.0`. So a plain `pnpm up` never moved a site from 0.2 to 0.3, where the breaking changes were. That is why these notes used to say `--latest`.

### The files `tinyzoo init` made are yours

An upgrade never rewrites your `cms.config.ts`, your pages or your components. When a release changes the starter (a new page route, a new script), the **Upgrade** notes say what to copy.

To see the difference for yourself:

1. Make a scratch site with the new version: `pnpm dlx tinyzoo init ../scratch`.
2. Compare it with yours: `diff -r app ../scratch/app`.

### Before you deploy, look at production

Run `pnpm exec tinyzoo status` with `DATABASE_URL` pointing at the production database, or at a restored copy of it. It only reads.

If it reports a migration under **Out of order**, the new version would refuse to start there. Drizzle once skipped that migration silently: two branches had each generated one, and the older one was merged second. Now it is stopped instead of ignored.

Fix it first. ["Migration … was never applied"](#migration--was-never-applied-but-a-newer-one-was) below says how, and why deleting the migration is the wrong fix once it has run anywhere.

Also read the new migration for statements the guard flagged (see [the guard](#the-guard-in-tinyzoo-generate)).

### What `tinyzoo upgrade` does

It does five things and stops at the first that fails:

1. It checks that your `nuxt`, `@nuxt/ui`, `drizzle-orm` and `zod` fit what this tinyzoo asks for. It also warns when the site has `drizzle-kit` 1.0, which 1.x does not support ([why](stability.md#platform-and-dependencies)). It warns and does not stop.
2. It writes `server/db/schema.ts` from `cms.config.ts`.
3. It generates the migration for the difference, with the [guard against statements that lose data](#the-guard-in-tinyzoo-generate).
4. It regenerates the typed client when your `package.json` has a `cms:client` script.
5. It runs `tinyzoo status` against `DATABASE_URL` (if it can reach it) and prints the next steps.

### Deploy

Pick one of these:

- Start the app with `NUXT_CMS_MIGRATIONS_ON_START=true`. The app applies the new migrations and upgrade steps itself when it starts (see [deploying.md](deploying.md#migrations)).
- Run `pnpm exec tinyzoo up` against the production database before the new version starts.

Take a backup first if the migration changes data.

### Rollback

1. Restore the backup you took before the deploy (see the backups notes in [deploying.md](deploying.md#pushbase-step-by-step)).
2. Deploy the previous version.

Migrations only go forward. There are no "down" migrations.

### Do not use `drizzle-kit push`

`drizzle-kit push` compares the database with your `schema.ts` and makes them equal. tinyzoo's own bookkeeping table, `cms_upgrades`, is deliberately not in `schema.ts`, so `push` proposes to drop it. The next start would then re-run every upgrade step.

`push` also skips the migration history, the guard and the order check.

Change the schema with `tinyzoo generate` and apply it with `tinyzoo up` or at start, as above.

## From 0.1 to 0.2

Everything below is also in the changelog of 0.2.0. Do the steps in this order, on a copy of the production database first. Make the copy with `tinyzoo backup`, then `tinyzoo restore` into a scratch database ([deploying.md](deploying.md#backups-and-restore)).

> **What you have to do**
>
> 1. Update both packages: `pnpm up tinyzoo@^0.2.0 @tinyzoo/client@^0.2.0`.
> 2. If an entity has a camelCase name, run `pnpm exec tinyzoo generate` in a terminal. Answer **renamed** for every table and enum drizzle-kit asks about.
> 3. Read the migration. It must hold only renames.
> 4. Apply it with `pnpm exec tinyzoo up`, or at start with `NUXT_CMS_MIGRATIONS_ON_START=true`. Stop the old instances first.
> 5. Change `import { defineForm } from 'tinyzoo'` to `tinyzoo/forms` and register the forms plugin.
> 6. Regenerate the typed client (`pnpm cms:client`) and fix what the compiler finds.
> 7. Optional: the steps under "Optional, when you want them" below.

### Table names are `snake_case` now

This is a breaking change. A site whose entities have a camelCase name has tables that change name. Every site made from the 0.1.0 starter is one: `siteSettings`, `contactForm`, `formSettings`. Entities named with one lowercase word (`post`, `page`, `news`) keep their names.

1. Run `pnpm exec tinyzoo generate` **in a terminal**.
2. For every table and enum that changes, drizzle-kit asks whether it was *renamed* from another one or is new. Answer **renamed** every time.
3. Pick the old table whose name matches the new one:
   - `siteSettings` → `site_settings`
   - `siteSettings_locales` → `site_settings_locales`
   - `contactForm_status` → `contact_form_status`

The first entry, *create*, is highlighted, so use the arrow keys. *Created* would drop the old table and its content. The wrong source would move one table's rows into another.

### Read the migration

The migration must hold only renames (`ALTER TABLE "siteSettings" RENAME TO "site_settings"`, `ALTER TYPE … RENAME TO …`). For tables with foreign keys or unique indexes it may also drop a constraint or index and add it again under the new name.

It must **not** hold `DROP TABLE`, `CREATE TABLE` for one of your tables or `DROP COLUMN`. If it does:

1. Delete the migration: its `.sql`, `meta/<number>_snapshot.json` and its entry in `meta/_journal.json`.
2. Start again from step 1: run `tinyzoo generate` and answer **renamed** for every table and enum it asks about.

`tinyzoo generate` lists the renames and asks to keep the migration. Here that is what you want, so answer `y`.

### Search arrives in the same migration

The migration adds the `cms_search` table and the `pg_trgm` extension. The database user needs the right to `CREATE EXTENSION`, or the database owner has to do it once. The index fills itself on the next start.

### Apply it

Apply the migration with `pnpm exec tinyzoo up`, or at start with `NUXT_CMS_MIGRATIONS_ON_START=true`.

Stop the old instances first. The old version does not find the renamed tables. Search your own code for raw SQL that names a table by its old camelCase name.

### Forms moved to a plugin

The old `import { defineForm } from 'tinyzoo'` still works in 0.2 and 0.3. It logs one deprecation line per helper, and 0.4 removes it.

Change the import to `tinyzoo/forms` and register the plugin. There is no migration and the tables do not change:

```ts
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'

export const plugins = [formsPlugin()]   // next to your entities
```

Restart `nuxt dev` after adding a plugin.

### Regenerate the typed client

Run `pnpm cms:client` and fix what the compiler finds.

A required link field (a menu link's `url`) is `string | null` now, because the page it points at may be gone. Render a link only when it has an address. `cmsMenuTree` and `<CmsNav>` already skip links without one.

### Optional, when you want them

- The page tree: [turning it on](#turning-on-the-page-tree).
- Links that follow their page: [converting links](#converting-links-to-follow-their-page).
- Groups: [adding a group](#adding-a-group).
- A seed file: `pnpm seed` in the new starter.

The starter's own files changed too: `cms.config.ts`, `app/pages/[...slug].vue`, the `seed` script in `package.json`, and `seed/`. They are yours, so copy what you want from a fresh `tinyzoo init`.

### Nuxt UI's own words in the admin language

This is optional and takes one line. Without it, the labels Nuxt UI draws itself ("Close", "Previous month", "Show password") stay English in a Czech or German admin.

In `app/app.vue`:

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

> **What you have to do**
>
> 1. Update both packages: `pnpm up tinyzoo@^0.3.0 @tinyzoo/client@^0.3.0`.
> 2. In your `package.json`, set `drizzle-orm` to `^0.45.4` and `drizzle-kit` to `^0.31.11`, then run `pnpm install`.

Your schema and migrations stay as they are. `tinyzoo generate` writes no new migration for this.

## From 0.3 to 0.4

Everything below is also in the changelog of 0.4.0. tinyzoo 0.4 runs on nuxt-auth-utils 0.6. That version needs Nuxt 4.6 and seals the sign-in cookie differently.

> **What you have to do**
>
> 1. Update both packages: `pnpm up tinyzoo@^0.4.0 @tinyzoo/client@^0.4.0`.
> 2. In your `package.json`, set `nuxt` to `^4.6.4` and `nuxt-auth-utils` to `^0.6.2`, then run `pnpm install`.
> 3. Move the sign-in secret to `NUXT_APP_SECRET`, on your platform, in `.env` and in your `.env.example`. Which step depends on what you have now; see the `NUXT_APP_SECRET` section below. A site that already sets `NUXT_APP_SECRET` keeps it, and does not copy the old password over it.
> 4. If your `cms.config.ts` still imports `defineForm` or `defineFormSettings` from `tinyzoo`, import them from `tinyzoo/forms` and register the plugin.
> 5. Tell your editors that everyone signs in again, once.

### Nuxt 4.6 and nuxt-auth-utils 0.6

Until you update them, `tinyzoo upgrade` warns that they do not fit. Your schema and migrations stay as they are. `tinyzoo generate` writes no new migration for this.

Nuxt 4.6 builds with Vite 8. If your own `nuxt.config.ts` has Vite or Rollup options, check them against [Vite 8's migration guide](https://vite.dev/guide/migration).

If your site uses nuxt-auth-utils itself (member sign-in, OAuth, WebAuthn), also read:

- its [migration guide from 0.5](https://github.com/atinux/nuxt-auth-utils#migrate-from-v05)
- the [0.6.0 release notes](https://github.com/atinux/nuxt-auth-utils/releases/tag/v0.6.0)

The changes to expect:

- Sessions are read-only in WebSocket handlers.
- The cookie is renamed.
- A session's `maxAge` counts from its last write.
- The `seal`, `crypto`, `generateId` and session header options are gone.

### `NUXT_APP_SECRET`

The sign-in cookie is now sealed with a key derived from Nuxt's app secret, `NUXT_APP_SECRET`. nuxt-auth-utils no longer reads `NUXT_SESSION_PASSWORD`.

- Rename the variable on your platform (and in `.env`), **keeping its value**: `NUXT_SESSION_PASSWORD=…` becomes `NUXT_APP_SECRET=…`.
- Rename it in your site's `.env.example` too. A site made by `tinyzoo init` before 0.4 still has `NUXT_SESSION_PASSWORD=change-me-…` there, and the next person who copies the file gets the old name. Keep the example value in that file: it is only an example, and from 0.6 production refuses it.
- If you set `runtimeConfig.session.password` in `nuxt.config.ts`, move that value to `NUXT_APP_SECRET` in the environment and remove it from the config.
- If your site already sets `NUXT_APP_SECRET` (for `nuxt-og-image`, say), remove `NUXT_SESSION_PASSWORD`. Then check that `NUXT_APP_SECRET` is **at least 32 characters** long.

  If it is shorter, the server does not start. Replace it with a new one (`openssl rand -base64 32`). Everything signed with the old one changes with it: `nuxt-og-image`'s signed image URLs change, and everyone signs in again.

Tinyzoo 0.4 and 0.5 let a deploy that still had only `NUXT_SESSION_PASSWORD` (or the `nuxt.config` password) keep working, with a deprecation warning. Its value stood in for `NUXT_APP_SECRET`. **0.6 removed that** ([From 0.5 to 0.6](#from-05-to-06)), so rename the variable before you update to it.

With no app secret, or one shorter than 32 characters, the server does not start and names the variable. In development Nuxt makes an app secret by itself when there is none.

### Everyone signs in again, once

The sign-in cookie has a new name (`nuxt-auth-session`, was `nuxt-session`) and a new format. Sessions from before the update no longer open the admin. Accounts and passwords are unchanged.

- Renaming the variable later, with the same value, does not sign anyone out again. A new value does.
- A session still ends 14 days (`runtimeConfig.session.maxAge`) after signing in, however often it is written since.

### Forms only from `tinyzoo/forms`

`defineForm` and `defineFormSettings` are no longer exported from `tinyzoo`. They have been deprecated since 0.2.

If your `cms.config.ts` still imports them from there, `pnpm typecheck` says so. Change the import and register the plugin, as in [Forms moved to a plugin](#forms-moved-to-a-plugin) under "From 0.1 to 0.2". There is no migration and the tables stay:

```ts
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'

export const plugins = [formsPlugin()]
```

## From 0.4 to 0.5

Everything below is also in the changelog of 0.5.0.

> **What you have to do**
>
> 1. Update both packages: `pnpm up tinyzoo@^0.5.0 @tinyzoo/client@^0.5.0`.
> 2. Make sure production sets `NUXT_SITE_URL` (or `NUXT_CMS_PUBLIC_URL`). Without either, `/sitemap.xml` is a `404` in production.
> 3. Open `/sitemap.xml` and check that it is there.
> 4. If your `nuxt.config.ts` has `sitemap: { enabled: false }`, remove it.
> 5. If your site has its own `server/routes/sitemap.xml*`, remove it, or keep it and set `sitemap: { enabled: false }`.
> 6. If your site has a search page, leave it out of the sitemap, with its address in every language: `sitemap: { exclude: ['/hledat', '/en/search'] }` in `nuxt.config.ts` for the starter's Czech and English search. The page says `noindex`, but the module lists it anyway.

### `/sitemap.xml` comes from `@nuxtjs/sitemap`

tinyzoo installs [Nuxt SEO's sitemap module](https://nuxtseo.com/docs/sitemap) itself. It hands the module the same entries as before. `cms.sitemap.paths` and the `cms:sitemap` hook work as they did (see [the sitemap](guide/content-api.md#the-sitemap)).

Open `/sitemap.xml` after the update and check these three things.

**It is there.**

- Sites with `@nuxtjs/seo` may have `sitemap: { enabled: false }` in `nuxt.config.ts`. They switched the module's sitemap off because tinyzoo served one. Remove it: it now turns off the only sitemap.
- If your site has its own `server/routes/sitemap.xml*`, remove that. Or keep it and set `sitemap: { enabled: false }`.

**The addresses start with the website's.**

- They come from `NUXT_SITE_URL` (or `site.url`) when set. Otherwise they come from `NUXT_CMS_PUBLIC_URL`.
- Without either, a production sitemap is a `404`, as before.

**Your own pages are listed too.**

- The module adds the site's static pages (`pages/kontakt.vue`). An address you also had in `cms.sitemap.paths` is listed once.
- A `robots` meta tag in the page (`noindex`) does not keep it out. The starter's search page has one and is listed.
- To leave a page out, use `sitemap: { exclude: ['/hledat', '/en/search'] }` (each language's address) or a `robots: false` route rule.

Nothing else changes: `/api/content/_sitemap`, the tables and the content API are as they were.

Three details are new. The sitemap now carries `x-default` next to the languages. It is served as `text/xml` (was `application/xml`). It is also cached for an hour (`Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600`). A content change clears the server's copy at once.

## From 0.5 to 0.6

Everything below is also in the changelog of 0.6.0. 0.6 is the last minor before 1.0. It removes what was deprecated and marks what is internal. It also writes down [the public API](api-surface.md) that 1.0 freezes.

> **What you have to do**
>
> 1. Update both packages: `pnpm up tinyzoo@^0.6.0 @tinyzoo/client@^0.6.0`.
> 2. Before you deploy, check that the server runs with `NUXT_APP_SECRET`: set, at least 32 characters, and not the example value from `.env.example`. Rename `NUXT_SESSION_PASSWORD` if that is all you have, in `.env.example` too.
> 3. Remove the deprecated settings: `cms.databaseUrl`, `FormOptions` imported from `tinyzoo`, `defineEntity(…, { singleton: true })` and the `CMS_SCHEDULER_CRON` and `CMS_RETENTION_CRON` variables. Rename a field called `page`, `limit`, `sort`, `dir` or `q` in a public collection.
> 4. Run `pnpm typecheck`. Wrap each decimal you read as a number in `Number(...)`, and check the `access` rules that read the signed-in person.
> 5. Run `pnpm exec tinyzoo status`. It lists accounts whose stored role is not `admin`, `editor` or `author`. From 0.6 those accounts have **no access**, so give each one a role. See [Custom roles](#custom-roles-and-per-field-permissions) below.
> 6. Everything else on this page is optional or needs nothing from you.

### `NUXT_APP_SECRET` is required

`NUXT_SESSION_PASSWORD` is no longer read.

A site that was set up before 0.4 may still have only `NUXT_SESSION_PASSWORD` (or `runtimeConfig.session.password` in `nuxt.config.ts`). 0.4 and 0.5 used it as the app secret and warned. 0.6 does not: the server **refuses to start**, says `NUXT_APP_SECRET is not set` and tells you to rename the variable.

**Before you deploy 0.6**, on your platform and in `.env`, do one of these:

- Rename `NUXT_SESSION_PASSWORD=…` to `NUXT_APP_SECRET=…`, **keeping the value**. Nobody is signed out.
- Move `runtimeConfig.session.password` from `nuxt.config.ts` to `NUXT_APP_SECRET` in the environment, and remove it from the config.

The value must be at least 32 characters. `openssl rand -base64 32` makes one.

A site that already sets `NUXT_APP_SECRET` needs nothing. An old `NUXT_SESSION_PASSWORD` next to it is ignored and can be deleted.

A site that already runs 0.5 without the deprecation warning in its log has nothing to do. The warning reads `[tinyzoo] deprecated: NUXT_SESSION_PASSWORD is used as the app secret…`. The one exception is a site whose secret is the example value (next section).

### The example secret is refused in production

The starter's `.env.example` has always held `NUXT_APP_SECRET=change-me-to-a-long-random-string-32-chars-min`. Before 0.4 it was `NUXT_SESSION_PASSWORD`.

If you ran `cp .env.example .env` and deployed with it, you set a secret that anyone can read. With it, anyone can forge a sign-in cookie.

With `NODE_ENV=production` the server now **refuses to start** with that exact value, and it names the variable. In development the server starts and warns.

1. Look at what your server runs with. Check the platform's environment, not only `.env`.
2. If the secret is the example, set a new one **before you deploy 0.6**: `openssl rand -base64 32`.
3. Do not "keep the value" when you rename `NUXT_SESSION_PASSWORD`, if it is this one.

A new secret signs everyone out once. Accounts and passwords stay.

A site made by 0.6's `tinyzoo init` or `pnpm create tinyzoo` has a `.env` with a random secret of its own. Its next steps no longer say to copy `.env.example`.

### Deprecations that start now

Each one gives a warning at build or start. They are removed in 1.0, so change them during 0.6.

- **`cms.databaseUrl` in `nuxt.config.ts`** writes the database address, password included, into the build. Set `DATABASE_URL` (or `NUXT_CMS_DATABASE_URL`) in the environment and delete the option.
- **`import type { FormOptions } from 'tinyzoo'`:** import it from `tinyzoo/forms`.
- **A field named `page`, `limit`, `sort`, `dir` or `q`** in a collection of the public content API. The name is the name of a parameter of the list, so the field cannot be a filter. Rename the field. A rename is a migration: [Renaming a field](#renaming-a-field).

### More deprecations

These also give a warning at build or start, and 1.0 removes them.

- **`defineEntity('settings', { singleton: true, … })`:** write `defineSingleton('settings', { … })`, which takes the same options. Nothing else changes: same table, same address, same admin.
- **The variables `CMS_SCHEDULER_CRON` and `CMS_RETENTION_CRON`:** set `scheduler: { cron: '…' }` and `retention: { cron: '…' }` in the `cms` options of `nuxt.config.ts`. These options are new.
  - They are read **when the site is built**, as before. A change needs a rebuild, and setting them on a running server does nothing.
  - The option wins over the variable.

### Internal exports

Many helpers exported from `tinyzoo` are tagged `@internal`. They include the tree, search, link and migration functions, the system tables and `buildRegistry`. The server, the admin and the CLI use them. A site should not.

They still work, and they can change in any minor release.

Everything else that `tinyzoo`, `tinyzoo/forms`, `tinyzoo/module` and `@tinyzoo/client` export is listed in [the public API](api-surface.md). If your code imports an `@internal` name, tell us what it needs, and use the documented API meanwhile.

### Custom roles and per-field permissions

A site can now define roles of its own and say, per field, who reads and who edits it. See [Roles and permissions](guide/roles.md).

**A site that does neither behaves exactly as before.** There is nothing to do and no migration. `cms_users.role` is a text column, and the roles live in `cms.config.ts`.

To use them:

1. In `cms.config.ts`, export `roles = defineRoles({ translator: { from: 'editor', … } })`. Put it above the entities that name the role.
2. Add `f.text().access({ read: [...], edit: [...] })` to a field.
3. Give people the new role in Settings → Team.

Your own row-level `access` rules now get the person with a new `base`. It is the built-in role they are, or extend: `'admin' | 'editor' | 'author'`. It sits next to `role`.

If a rule says `user.role === 'author'` and you add a role built on author, change it to `user.base === 'author'`. Otherwise that role is not held to the rule.

Two behaviours differ from 0.5, in cases that did not arise through the admin:

- An account whose stored role is **not** `admin`, `editor` or `author` now has **no access**. The role may have been typed into the database by hand, or left by a role you removed. The person sees "Your role no longer exists". Before, such an account was treated as an editor.
- With `cms.auth.mode: 'external'`, once you define roles, a role name from your sign-in that you did not define has no access either. A site without `defineRoles` keeps the old behaviour.

`tinyzoo status` lists accounts whose role the config does not know.

### Per-language publishing (optional)

An entity can now publish each language on its own: `publish: { …, perLocale: true }` ([the guide](guide/content-model.md#publishing-each-language-on-its-own)).

**If you do not turn it on, nothing changes.** There is no step and no migration. Pages, lists, the sitemap and webhooks are the same as in 0.5.

To turn it on for an entity with `.localized()` fields:

1. Add `perLocale: true` to its `publish` in `cms.config.ts`.
2. Run `tinyzoo generate`, review the migration and commit it. It adds three nullable columns to the entity's translation table (`<entity>_locales`): `published`, `published_at` and `first_live_at`. It adds nothing else.
3. Run `tinyzoo up`, or start with `NUXT_CMS_MIGRATIONS_ON_START`.

No migration comes with this beyond the three columns. It is not available for page trees (`tree`) yet. The config check says so when you combine the option with one.

#### What it does

There is no data to move. Every language starts **following the default language**. Every page, list, sitemap entry and `hreflang` alternate is exactly as before, for translations and for entries without a translation alike.

A language gets a state of its own when an editor publishes, unpublishes or schedules it.

For a site that turns it on, a language that is not published:

- answers `404` for the item;
- is left out of its list, the sitemap, the `hreflang` alternates, the search and links.

The webhook for it names the language in `locale` (`entry.published` and `entry.unpublished`). The payload keeps its shape. A site that had its own code deciding what to show per language can drop it.

#### A translation that has never been published is being translated

A first translation of an entry that is already live starts as one. Visitors keep getting the default language there, through fallback, as before. This lasts until an editor publishes the translation. People who may not publish can write it.

This also holds for a translation written through the admin API. A first translation of a published entry, without a status, is not on the website yet.

A script that should put a translation on the website at once sends `"status": null` with it. The translation then follows the default language, as before. Seeds do that for a translation without a status.

#### The default language gates every language

A translation is on the website only while the default language is too.

- Unpublish the default language and every language goes off. The translations' own states are kept and apply again when it is published.
- A language can still be unpublished or scheduled on its own.
- A scheduled language is live from the later of its date and the default language's.
- A language that follows is live exactly when the default language is.

A webhook for the default language going off names the address of each language that went off with it. As for any change to the default language, one served only through it, with no translation row, is not listed.

The editor says **Waiting for the default language** for a language that is published but held back.

Whoever may not publish also cannot remove a translation that holds a state of its own. The language would follow the default language again and could go live. Shared editing and the editor's read-only switch judge a translation by its own state, as saving does.

If you run an integration that reads `locales` or `paths` of a published item, there is nothing to change. A draft is as private as before.

#### Export and import

The content model of an archive now says which entities publish per language. It uses a `perLocale` key, only where the option is on, so every other site keeps its fingerprint.

- An archive from 0.5, or from a site without the option, imports into a site that has it as before. Its translations follow the default language, and `--merge` leaves the states already there alone.
- An archive that carries per-language states into a site where the entity does not publish per language is reported as a difference. `--allow-mismatch` imports it with a warning that the states were left out.
- An archive made by 0.6 with per-language states cannot be imported into 0.5 faithfully. 0.5 does not know the key and drops the states without a word. Keep both sites on 0.6 for it.

#### With roles

**Publish is offered to a role only if it may edit the publish status field and the date field of that entity** (`.access({ edit })` on them), because a publish writes both. If you put such a rule on those fields, add the roles that should publish.

### `pnpm create tinyzoo`: nothing to do

A new package, `create-tinyzoo`, makes a site. It asks for the languages, the parts (news, contact form, redirects, search) and the demo content.

`tinyzoo init <folder>` gets the same options: `--languages`, `--presets`, `--demo` / `--no-demo` and `--package-manager`. Without them it makes the same site as before.

A site you already have is not touched. Its files are yours.

A fresh starter does a few things differently now. Its website reads the languages and its own few words from `app/utils/site.ts`, and the search page is `app/pages/search.vue`. To get that, make a scratch site and compare it with yours: `pnpm dlx tinyzoo init ../scratch`, then `diff -r app ../scratch/app`.

A new site also gets an `AGENTS.md`. It is a short guide for the coding assistant you work with: the content model workflow, the commands, what is frozen and what not to touch. To give your site the same:

1. After updating, copy `node_modules/tinyzoo/starter/AGENTS.md` into the site's root.
2. Add your own notes to it.

### A decimal is a string in your types

This concerns `f.number({ int: false })`. The column is `numeric`. A select and the content API have always returned a string (`"19.99"`), but `Row`, `Insert` and `Update` said `number`.

In 0.6 the types tell the truth:

- A `Row` has `string`.
- An `Insert` or `Update` takes `number | string`.

**Typed code that reads a decimal as a number stops compiling.** Examples are `row.price * 2` and `price.toFixed(2)`. To fix it:

1. Run `tsc` or `nuxt typecheck` after updating.
2. Fix each place with `Number(...)`:

   ```ts
   const total = Number(row.price) * quantity      // was: row.price * quantity
   const shown = Number(row.price).toFixed(2)      // was: row.price.toFixed(2)
   ```

Nothing changes at run time. There is no migration, and the content API, the OpenAPI document and the generated client types are the same. They already said string.

Two small things are new:

- A decimal sent to a write may be a number or a numeric string. It is stored as the string. The admin used to fail on a decimal it had not touched.
- A default is now written as a string: `.withDefault('0')`.

A decimal inside a block, a list or a group is typed `string` too. Items saved before 0.6 may hold a number there, so read it with `Number(...)` as well.

A whole number (`f.number()`, `int: true`) is a number, as before.

### An `access` rule's `user` is typed

`user` is now a `CmsAccessUser` with `id`, `email`, `name`, `role`, `base` and `locale`. It was `any`. Rules that read those fields compile unchanged.

A rule that reads something your external sign-in adds to the person (a tenant, groups) gets it as `unknown`. Check it before you use it: `typeof user.tenant === 'string'`. Or write `(user as { tenant?: string }).tenant`.

With external sign-in, `email` and `name` are now `''` and `locale` is `null` where your sign-in did not send them. They were missing before.

### Smaller changes, nothing to do

- `cms.content.publicUrl` falls back to `cms.publicUrl`. The OpenAPI `servers[].url` was relative when only the second was set.
- `cms.forms.notifyTo` also takes a list of addresses. `NUXT_CMS_FORMS_NOTIFY_TO` stays one comma-separated string.
- `defineForm` returns an `Entity` typed from its fields (and `status`). `Row<typeof ContactForm>` is no longer loose.
- The [frontend kit](api-surface.md#the-frontend-kit) is part of what 1.0 freezes. It holds `<CmsBlocks>`, `<CmsImage>`, `<CmsContent>`, `<CmsNav>`, `<CmsHighlight>`, `<CmsForm>`, `useCmsSeo()`, `useCmsSearch()` and `useCmsUiLocale()`. Their props are exported as types (`CmsImageProps`…). Other `Cms*` components are the admin's and internal.
- `createClient` (generated, typed) and `createCmsClient` (the untyped runtime in `@tinyzoo/client`) keep their names. The [client guide](guide/content-api.md#typed-clients--openapi) says which is which.
- `CMS_ALLOW_REQUEST_ORIGIN` is documented, and so is why `NUXT_CMS_AUTH_SETUP_TOKEN` is an environment variable only ([deploying](deploying.md)).

### Also new

- `tinyzoo help` prints every command and flag.
- `CmsWebhookPayload`, `CmsAdminField`, `CmsFieldEditProps` and `CmsFieldCellProps` are exported as types. They are for webhook receivers and your own field renderers.
- `CMS_WEBHOOK_HEADERS` is exported as a constant: the names of the webhook's headers.
- A custom field renderer now gets a `readOnly` prop. It is `true` when the person's role may read the field but not edit it, or when the entry is read-only for them. A renderer that is not made of native form controls should stop editing when it is set ([the admin guide](guide/admin.md#extensibility--the-field--view-registry)).

## From 0.6 to 0.7

Everything below is also in the changelog of 0.7.0. 0.7 lets the admin carry the client's brand: a colour, a logo set and the emails. No schema change and no migration.

> **What you have to do**
>
> 1. Update both packages: `pnpm up tinyzoo@^0.7.0 @tinyzoo/client@^0.7.0`.
> 2. Nothing else is required. A site that sets none of the new options looks as before, apart from the accessibility fixes under [What changes by itself](#what-changes-by-itself).
> 3. If something sits in front of `/api/cms` (a proxy rule, basic auth, an IP allowlist), let `GET /api/cms/_theme` and `/api/cms/_brand/*` through without a sign-in. See [New public routes](#new-public-routes).

### Optional: brand the admin

All of it goes in `cms.admin` in `app.config.ts` ([the admin guide](guide/admin.md#what-you-can-brand)):

- **A brand colour:** `accent: '#B4532A'`, any hex. tinyzoo derives the shades, dark mode and the text on buttons, and keeps everything readable. The built-in accents stay.
- **Logos:** put the files in `public/brand/` and set `logo: { full: '/brand/logo.svg', mark: '/brand/mark.svg' }` (`fullDark` and `markDark` are optional). Set `name` too: it is the logo's text for screen readers.
- **`signature: false`** hides tinyzoo's quiet signature under the sidebar and on the sign-in pages.
- **`animals: false`** hides tinyzoo's animals everywhere.

### What changes by itself

These apply to every site, with or without a brand:

- **Focus rings** are a solid 2 px ring in the accent's link colour, 3:1 or more on every surface. They were the accent at 25 %, which was hard to see.
- **A button under the pointer** takes a shade of its own instead of the button colour at 75 %, so its text stays readable.
- **In dark mode the colour presets' buttons** (`indigo`, `blue`, `violet`, `emerald`) carry dark text instead of white. Light mode and `mono` look as before.
- **Emails** (invitations, password resets, a changed sign-in address) carry the full logo (or the site's name in bold), a button in the accent colour and a readable, coloured link under it. Without a logo and with `mono` they look much as before.
- **The folded sidebar** stays folded after a reload. The admin's Nuxt UI sidebar cookie was renamed, so a sidebar width someone dragged in the current browser session is forgotten once.

### An accent is read strictly

`accent` takes a built-in name or a hex. Names are read in any case, with spaces around them ignored.

- An accent that is neither (a typo, `'red'`) now falls back to `mono`, with a warning in development. Before, it gave mono greys with an odd dark-mode button.
- `data-cms-accent` on the admin's `<html>` is only ever `mono`, `indigo`, `blue`, `violet`, `emerald` or `brand`. Before, it held whatever the config said. Host CSS keyed to another value, such as `[data-cms-accent='Indigo']` or a hex, stops matching.

### With a hex accent, the moments follow the brand

The sign-in pages, the welcome card and the current page in the sidebar become a faint tint of the brand instead of cream, and the animals take a muted shade of it. A site that already had a hex accent in 0.6 sees this after the upgrade. `mono` and the built-in colour accents keep cream and the colourful animals.

### Host CSS in the admin

- With a hex accent the admin writes the brand's colours in a `<style>` under `html[data-cms-admin][data-cms-accent='brand']`. Host CSS that sets `--ui-primary`, `--ui-color-primary-*` or the moments' variables under `html[data-cms-admin]` loses to it.
- What a host sets is never checked for contrast. Use `accent` for the colour.
- A site that styled the admin's focus rings or the hover of its buttons itself should check that its rules still apply.

### New public routes

- `GET /api/cms/_theme` gives the admin its theme (name, colour, logos). The sign-in page needs it before anyone signs in.
- `GET /api/cms/_brand/<file>` serves the PNG versions of the logo (for emails, the tab and the phone's home screen) and the admin's web manifest.

Neither needs a sign-in, and neither holds anything the sign-in page does not show. A proxy or access rule in front of `/api/cms` must let them through. Otherwise the PNG tab icons, the home-screen icon and the logo in emails do not load.

### Logos and where they are read from

- Mail clients load the logo from `NUXT_CMS_PUBLIC_URL`, so that address must be reachable from the internet. Production already needs it for the links in emails.
- A logo in `public/` must be a picture file: `.svg`, `.png`, `.webp`, `.jpg`, `.jpeg` or `.avif`.
- An `https://` logo on a host inside your own network cannot be made into the PNG versions; put it in `public/`. An `http://` logo is never downloaded.
- A replaced logo reaches the tab icons and new emails within 15 minutes in production. Emails already sent keep the old picture.

### Changing `cms.admin` in the browser

The server resolves the name, colour and logos and the admin uses what it sends. A site that changes `cms.admin` in the browser at run time (`updateAppConfig`) no longer changes them.

### The email helpers take the request first

The server's email builders (`inviteEmail`, `resetEmail`, the ones for a changed sign-in address, and `emailContext`) are internal. They are now async and take the request first: `await inviteEmail(event, { … })`, `await emailContext(event, locale)`. Only a site that calls them from its own server code has to change that call.

## From 0.7 to 1.0

1.0 freezes the public API ([what that covers](api-surface.md)). Before the freeze, it removes what 0.6 deprecated. No schema change and no migration.

> **What you have to do**
>
> 1. Update both packages: `pnpm up tinyzoo@^1.0.0 @tinyzoo/client@^1.0.0`.
> 2. Check that Node fits `^22.22.3 || ^24.15.0 || >=26.0.0`, where the site is built and where it runs ([below](#node-drizzle-orm-and-the-starters-scripts)).
> 3. If your site saw no deprecation warning on 0.6 or 0.7, that is all. They are lines that start with `[tinyzoo] deprecated:`, in the output of `nuxt build` or in the server's log.
> 4. Otherwise, change what is left over. Each step is below. The build, `defineEntity` or `pnpm typecheck` stops on anything you missed, and says what to write instead.

### `cms.databaseUrl` is gone

Delete `databaseUrl` from the `cms` options in `nuxt.config.ts`. The build stops while it is there.

Set `DATABASE_URL` (or `NUXT_CMS_DATABASE_URL`) where the site runs, and in `.env` for the CLI. The CLI no longer reads the address from `nuxt.config.ts`. If `backup`, `restore`, `export` or `import` finds only the old option, it says so and links here.

### `singleton: true` on `defineEntity` is gone

Write `defineSingleton` instead. It takes the same options:

```ts
// before
export const Settings = defineEntity('settings', { singleton: true, label: 'Settings', titleField: 'siteName', fields })
// after
export const Settings = defineSingleton('settings', { label: 'Settings', titleField: 'siteName', fields })
```

Same table, same address, same admin. With `singleton: true`, `defineEntity` now throws, and the option is a type error.

### `FormOptions` comes from `tinyzoo/forms` only

Change `import type { FormOptions } from 'tinyzoo'` to `import type { FormOptions } from 'tinyzoo/forms'`.

### The cron variables are gone

`CMS_SCHEDULER_CRON` and `CMS_RETENTION_CRON` are no longer read. If your build sets one, the build stops and names the option to write:

```ts
export default defineNuxtConfig({
  cms: { scheduler: { cron: '*/5 * * * *' }, retention: { cron: '30 2 * * *' } },
})
```

Then remove the variables. The options are read when the site is built, as the variables were.

### A field named like a list parameter is an error

A public collection cannot have a field called `page`, `limit`, `sort`, `dir` or `q`. These are parameters of the content API's list. 0.6 warned; 1.0 stops at the config. A global (`defineSingleton`) may have such a field, since it has no list. 0.6 and 0.7 warned about a global too, by mistake: you need not rename it.

Rename the field. A rename is a migration: see [Renaming a field](#renaming-a-field).

### The search helpers are internal again

`searchTerms`, `matchEntry`, `highlightRanges`, `SEARCH_MAX_QUERY` and `SearchMatch` are `@internal`. 0.6 made them public. They are not frozen, because the search may change how it matches.

- They are still exported, so code that imports them keeps working for now.
- They can change in any release. Use `useCmsSearch()` and `<CmsHighlight>`, which stay public.

### Node, drizzle-orm and the starter's scripts

- **Node.** tinyzoo 1.0 asks for `^22.22.3 || ^24.15.0 || >=26.0.0`, the same as Nuxt. An older Node 22 or 24 gets a warning from the package manager. Update Node where the site is built and where it runs.
- **`drizzle-orm` is a peer dependency.** A site made by `tinyzoo init` already lists it in `package.json`. Keep it there, in the range `tinyzoo upgrade` checks.
- **`drizzle-kit` stays on 0.x.** `tinyzoo status` and `tinyzoo upgrade` warn when it is 1.0 ([why](stability.md#platform-and-dependencies)).
- **The starter's scripts call `tinyzoo`.** A new site's `db:generate` is `tinyzoo generate`, and so on. Your own scripts may still run the CLI's file inside the package. That path is not part of the public API, so change them to call `tinyzoo` too.

### An entity's zod schemas are internal

`insertSchema` and `updateSchema` on an entity are `@internal`. They follow zod's major versions, so they are not frozen. They are still there. If your code validates with them, it keeps working, but it may need a change when tinyzoo moves to a new zod.

An entity's `table` is frozen for reading: its columns under the fields' config keys, and `id`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`. The access rules you wrote keep working. See [the public API](api-surface.md#types).

## The two-step rule

> A release that changes the shape of the database never removes what the
> previous release still uses.

A deploy is not instant. For a while the **old** version of your site is still serving visitors while the **new** one has already migrated the database. This happens with several replicas, or on a platform that starts the new instance before it stops the old one.

If the migration dropped or renamed a column, the old version fails on every request that touches it until it is replaced.

So a breaking change takes two releases:

| Release | What you do |
|---|---|
| **N** | Add the new column, field or table. Keep the old one in `cms.config.ts`. Fill the new one from the old (a line of SQL in the migration, see below) and make the site use the new one. |
| **N+1** | Once N is deployed everywhere and nothing reads the old one: remove it from `cms.config.ts` and generate the migration with `tinyzoo generate --allow-drop`. |

Not every site needs this care. A staging site, or one with a single instance that can answer errors for a few seconds during a deploy, can do it in one release and accept the short gap.

That is a choice you make with `--allow-drop` (or `y` at the question). tinyzoo never makes it for you.

### The guard in `tinyzoo generate`

After drizzle-kit has written a migration, tinyzoo reads it and stops on two kinds of statements. It describes each in plain words.

**Statements that lose data or break the running version.** These are `DROP TABLE`, `DROP COLUMN`, `DROP TYPE`, a column type change, and a rename of a table, column or type:

```
⚠ 0018_blushing_white_queen.sql would:
  • drops column `tagline` of `site_settings` — its content is lost
```

**Statements that may fail on rows that already exist.** These are a required column without a default, `SET NOT NULL` on a column, a new unique constraint or unique index, and a new `CHECK`:

```
⚠ 0019_quick_thing.sql would:
  • adds required column `summary` to `post` without a default — fails if `post` has rows; give the field a default, or add it optional first, fill it, then make it required
```

These do not lose anything. But when the new version starts and applies the migration, Postgres refuses it on the rows that are there. The process exits, the platform restarts it, and it fails again. The site is down (with one replica, completely) until someone fixes the migration.

Statements on a table the same migration creates are not flagged, because that table is empty. See [Adding a required field](#adding-a-required-field).

What the guard does when it stops:

- In a terminal it asks **Keep the migration anyway? [y/N]**.
- Without a terminal (CI), or on **N**, it deletes the new migration, its snapshot and its journal entry, and exits with code 1. Nothing was applied.
- `tinyzoo generate --allow-drop` keeps a migration whose statements lose data, without asking.
- `tinyzoo generate --allow-risky` does the same for the second kind.
- One flag never covers the other. A migration with both kinds needs both.

The question drizzle-kit itself asks about renames ("is this column created or renamed from another column?") needs a terminal. Without one, `tinyzoo generate` fails and points here, instead of waiting for an answer that cannot come.

## Recipes

### Adding a required field

A field is required unless you write `.optional()`. Adding one to a collection that already has entries makes drizzle-kit write `ALTER TABLE "post" ADD COLUMN "summary" text NOT NULL;`. Postgres cannot add a column without a value to rows that exist.

The guard stops on it ("adds required column `summary` to `post` without a default"). Pick one of these.

**The field has a sensible value for old entries.** Give it a default and generate again. The column is added as `DEFAULT '' NOT NULL`, and every existing row gets the default:

```ts
summary: f.text().withDefault(''),   // required; old entries start empty
```

New entries may still leave it empty, since `''` is a value. If you want editors to be forced to write one, use the next option.

**Old entries must be filled in first.** This takes three releases, with no gap:

1. Add the field **optional**: `summary: f.text().optional()`. Generate and deploy. The column is added as nullable, so nothing can fail.
2. Fill it. Write the text in the admin for every entry. Or set it with one SQL statement: `UPDATE "post" SET "summary" = "title" WHERE "summary" IS NULL;`. That can be a statement in the next migration, or run by hand against the database. Check that nothing is left: `SELECT count(*) FROM "post" WHERE "summary" IS NULL;`.
3. Remove `.optional()` and generate. The migration is `ALTER COLUMN "summary" SET NOT NULL`, which the guard flags too. Now you know no row is empty, so answer `y` (or use `--allow-risky`).

The same goes for:

- **a new unique field** or a unique index. `SELECT "slug", count(*) FROM "post" GROUP BY 1 HAVING count(*) > 1;` shows what would collide;
- turning an optional field required.

On a site with no entries yet (a new site, a staging copy) there is nothing to fail, and `--allow-risky` is fine.

### Adding a group

`f.group({ fields })` is one jsonb column.

On an existing entity, add it `.optional()`. The migration is a nullable `ADD COLUMN`, which is safe on rows that already exist. The same goes for a `.localized()` group, whose column is added to the translations table.

A required group is a `NOT NULL` column and needs a default first. See "Adding a required field" above.

Changing the fields inside a group later is a change to stored JSON, not to the schema, so no migration is generated.

- Adding an optional field is free.
- A field that was renamed or removed has no `version` / `upgrade` hook yet, because groups are not versioned. Keep both names readable for one release, or move the data in a script.

### Converting links to follow their page

Links picked in the admin before this version were stored as the page's address, so renaming the page broke them. Links picked now are stored as `cms:<entity>/<id>` and follow the page. The old ones keep working as the addresses they are until you convert them.

Run the dry run first, then convert:

```bash
tinyzoo links:convert --dry-run   # what it would convert, and what it could not match
tinyzoo links:convert             # do it
```

Then:

1. Purge the website's cache, because the content API answers changed.
2. Make sure whatever consumes the API handles a link field that is `null`. That happens when the target is gone or not published.

Run both commands from the site's folder. The database is `DATABASE_URL` from the environment or the site's `.env`, like `tinyzoo up`.

If it reports blocks stored at an older version, run `tinyzoo content:migrate` first.

#### What gets converted

An address is converted only when it is exactly the current address of **one published** entry **in the language the link is served in** (with the website's fallbacks).

- An entry's own row and its default-language content count as the default language.
- A translation counts as its language.

A reference is served as the target's address in the language asked for, so any other match would change what visitors get.

These are listed and left as typed. Pick those entries again in the link picker:

- addresses no entry has
- another language's address of an entry
- addresses of entries not published yet
- addresses two entries share
- addresses with a `#anchor` or `?query`

These are never converted and stay as typed:

- the home page (`/`)
- a list page that is not an entry (`/aktuality`)
- every other fixed page of the site

They are not entries, so there is nothing to follow.

External links, `mailto:` and `tel:` are not touched. Neither are saved versions (History) or `updatedAt`.

#### A seed that writes typed addresses

A site with a **seed** (`seed/index.ts`) that writes typed addresses with `s.upsert` would write them back over the converted links on its next run. Do one of these:

- Have the seed write references: `s.link('', entry).url`, as the starter's does.
- Use `s.create` for those pages ([Seeding](guide/seeding.md)).

### Renaming a field

This example renames `title` to `headline` in `cms.config.ts`. The database column follows.

1. Change the key in `cms.config.ts` (and the places that use it).
2. Run `pnpm exec tinyzoo generate` **in a terminal**. drizzle-kit asks *"Is `headline` column in `post` table created or renamed from another column?"* Choose **renamed from `title`**. Choosing "create" makes the migration add `headline` and **drop `title`**, and the content of the field is gone.
3. The migration now contains `ALTER TABLE "post" RENAME COLUMN "title" TO "headline";`. tinyzoo lists it as a rename. Answer `y` (or use `--allow-drop`) if a short gap during the deploy is fine.
4. Typecheck, regenerate the typed client and commit.

A field that is `.localized()` lives in the `<entity>_locales` table. The same steps apply to its column there.

#### If you answered "create" by mistake

This also applies when you are working without a terminal. Edit the SQL by hand:

1. Find this pair:

   ```sql
   ALTER TABLE "post" ADD COLUMN "headline" text;--> statement-breakpoint
   ALTER TABLE "post" DROP COLUMN "title";
   ```

2. Replace it with the single `RENAME COLUMN` statement from step 3 above.

The snapshot drizzle-kit keeps describes the schema, not the SQL, so it stays correct.

#### A rename without any gap

Use the two-step rule instead:

1. In release N, keep `title` and add `headline`. Copy in the migration (`UPDATE "post" SET "headline" = "title";`) and have the site read `headline`.
2. In release N+1, remove `title`.

### Renaming an entity

Renaming `defineEntity('post', …)` to `'article'` renames these:

- its table
- its `<entity>_locales` table
- its many-to-many junction tables
- its enums
- the address of its content API (`/api/content/article`)

The new name appears everywhere else too: the typed client, `content.path` templates and redirects.

1. Rename it in `cms.config.ts` and run `tinyzoo generate` in a terminal.
2. drizzle-kit asks about each table that "appeared": the entity's table, its `_locales` table and its junctions. Answer **renamed from …** every time. A "create" answer means a new empty table and the old one dropped, which tinyzoo will stop on.
3. Check the SQL. It should hold only `RENAME` and constraint changes, no `DROP TABLE`.
4. The CMS's own tables remember the entity's name as text. Add these statements to the migration, after the rename:

   ```sql
   UPDATE "cms_revisions" SET "entity" = 'article' WHERE "entity" = 'post';--> statement-breakpoint
   UPDATE "cms_audit" SET "entity" = 'article' WHERE "entity" = 'post';
   ```

   The search index rebuilds itself on the next start.
5. Keep the old address working for visitors with a redirect (the `redirects` preset).

### Removing `.localized()` from a field

Making a field localized is safe. What was written stays as the default language's value.

Removing it is not safe. The translations (every language but the default) live in the `<entity>_locales` column, and the migration drops that column.

1. Export the translations you want to keep, one language at a time. You can use the content API (`/api/content/post?locale=en`), or copy them by hand.
2. Run `tinyzoo generate --allow-drop`.
3. The field now has the default language's text for everyone.

### Changing a field's type

drizzle-kit writes `ALTER COLUMN … SET DATA TYPE …`. Postgres can only do that when it knows how to convert the values. It does not know how to turn text into a number, and values that do not convert fail the whole migration.

Choose by the kind of change.

**Values convert plainly** (a number to text, a short text to a longer one). The generated migration is fine. Answer `y`.

**Values need converting** (text to a number, text to a date). Add the conversion by hand: `ALTER TABLE "post" ALTER COLUMN "n" SET DATA TYPE integer USING "n"::integer;`. Try it on a copy of your data first.

**Plain text to rich text** (`f.text()` → `f.richtext()`, a `text` column becoming `jsonb`) is such a case. Wrap each text in a one-paragraph document. Do the same for the `<entity>_locales` table if the field is `.localized()`:

```sql
ALTER TABLE "team_member" ALTER COLUMN "bio" SET DATA TYPE jsonb
  USING CASE WHEN "bio" IS NULL OR "bio" = '' THEN NULL
    ELSE jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', "bio"))))) END;
```

**To keep the old values until you are sure,** use the two-step rule:

1. In release N, add a new field of the new type. Fill it from the old one in the migration (`UPDATE "post" SET "n_new" = "n"::integer;`) and switch the site over.
2. In release N+1, drop the old one.

#### `--allow-drop` does not write the conversion for you

The guard stops on a type change. `tinyzoo generate --allow-drop` then keeps the generated migration *as it is*.

Without `USING`, Postgres refuses it when `tinyzoo up` runs it: `column "bio" cannot be cast automatically to type jsonb`. Edit the `.sql` file before you apply it. The guard's message points here for that reason.

### Turning on the page tree

`definePages({ tree: true })` is opt-in, and the migration is safe on existing data. It changes a constraint, though, and your website needs one change.

1. Add `tree: true` to `definePages({ … })` and run `tinyzoo generate`. The migration is five statements (the names are for a pages collection called `page`):

   ```sql
   ALTER TABLE "page" DROP CONSTRAINT "page_slug_unique";
   DROP INDEX "page_locales_slug_unique";
   ALTER TABLE "page" ADD COLUMN "parent_id" uuid;
   ALTER TABLE "page" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
   ALTER TABLE "page" ADD CONSTRAINT "page_parent_id_page_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."page"("id") ON DELETE restrict ON UPDATE no action;
   ```

   The address part is only unique under a parent now. The server checks the whole address instead. The guard has nothing to say about it: no table or column is dropped, and the new column has a default. So it needs neither `--allow-drop` nor `--allow-risky`.
2. Run `tinyzoo up`. Existing pages stay at the top level at the same addresses.
3. **Change the website's page route.** The site has to ask the content API for a page by its *whole* address, with the slashes escaped, as one path segment. See below.
4. Add `defineRedirects()` if the site has none. Moving a page or renaming its address part moves every page below it. The redirects from the old addresses keep old links and search results working.

   Without redirects, the change report (`cms:change`, and the webhooks: `moved`, `paths`) still lists every address that changed. The site can use it to purge its cache.

#### The page route

A route written before the tree (`/api/content/page/${slug.join('/')}`) finds top-level pages as before. It answers **404 for every nested page**, because the API sees `page/o-nas/tym` as a different address.

In the starter's `app/pages/[...slug].vue` the fix is one word:

```ts
`/api/content/page/${encodeURIComponent(parts.value.join('/') || 'home')}`
```

With `@tinyzoo/client`, `cms.page.get('o-nas/tym')` does the escaping for you. The new starter's version of that file also draws the breadcrumbs from the page's `breadcrumbs`.

#### Turning it off, and `maxDepth`

Turning the tree **off** again is a two-step change, like any other removal of a column (see [the two-step rule](#the-two-step-rule)).

1. Move every page to the top level first.
2. Mind that the address part must then be unique again.

Lowering `maxDepth` later does not move pages that are already deeper. It only refuses new nesting.

### Removing a block type

The blocks of a page are stored as JSON inside the entry, so a migration neither sees nor changes them. If you delete a block type from the config while entries still contain it, those entries cannot be saved until the block is removed from them. Older saved versions in the history keep the old shape.

1. Before removing the type, remove or convert its blocks. Find the entries: `SELECT id FROM "page" WHERE "blocks" @> '[{"type": "hero"}]';`
2. Then remove the type from `cms.config.ts`.

Renaming a field *inside* a block works the same way. The old values are not carried over and are dropped on the next save. Rename it in two steps:

1. Keep both fields for a release.
2. Copy the values over by editing the entries, or with a one-off SQL `UPDATE` on the JSON.
3. Then remove the old field.

## Upgrade steps and `tinyzoo status`

Some upgrades need more than a schema change. Examples are a column that has to be filled for existing rows, or an extension the database has to enable. tinyzoo ships these as **upgrade steps**.

Every step has an id, the tinyzoo version that introduced it and a one-line description. It runs once per database.

You do not write them or run them by hand. The app runs them when it starts (with `NUXT_CMS_MIGRATIONS_ON_START`), and `tinyzoo up` runs them. They run in the same transaction and lock as your own migrations, so an upgrade either happens completely or not at all.

- Steps that need the new schema run after your migrations.
- Steps that your migrations need run before them.
- On an empty database (a new site) steps are recorded without running, because there is nothing to fill.

`pnpm exec tinyzoo status` shows where a database stands, and only reads it:

```
Database: db.example.com:5432/site
Migrations: 17 applied, 1 pending
  pending  0018_add_summary
Upgrade steps: 1 applied, 0 pending

✗ not up to date — run `tinyzoo up`, or start the app with NUXT_CMS_MIGRATIONS_ON_START=true
```

The exit code is a signal for a deploy script:

| Code | Meaning |
|---|---|
| `0` | Nothing is pending. |
| `1` | A migration or step is pending or out of order. |
| `2` | The database could not be reached. |

It needs `DATABASE_URL`, from the environment or the site's `.env`.

### Plugins

**Plugins** (see [plugins.md](plugins.md)) bring their own steps. They run in the same pass, in the same transaction and lock. They show in `status` with the plugin's name and its own version, not tinyzoo's:

```
Upgrade steps: 2 applied, 1 pending
  pending  events:backfill-place (events 0.1.0) — Events saved without a place get "To be announced"
```

Updating a plugin is the same routine as updating tinyzoo:

1. Read its changelog.
2. Run `tinyzoo generate`, because its collections may have changed.
3. Run `tinyzoo up`.

The plugin's steps are recorded as `<plugin>:<id>`. Never rename a plugin, or its steps would run again.

### "Migration … was never applied, but a newer one was"

The app refuses to start, and `tinyzoo status` lists the file under **Out of order**.

Two branches each generated a migration. One was merged and applied first, and the other has an older timestamp. drizzle-kit would skip it for good, silently, so tinyzoo stops instead.

This check is new. A site where drizzle *had* silently skipped a migration in the past will now refuse to start. Run `tinyzoo status` against production before you deploy a tinyzoo version that has the check, as the [checklist](#on-every-upgrade) says.

What to do depends on whether the migration ever ran on another database.

**It ran nowhere else** (only the branch that was merged second has it):

1. Delete the migration's `.sql` file, its snapshot (`meta/<number>_snapshot.json`) and its entry in `meta/_journal.json`.
2. Run `tinyzoo generate` again. It writes one migration on top of the newest one, dated now, so it sorts after the others.

**It ran somewhere.** Production applied it before the second branch was merged, or you found it with `tinyzoo status` against production, or a colleague's database has it.

Deleting it and regenerating is **wrong on its own**. That database recorded the old migration under its old date, so the regenerated one is a new migration to it. It would run the same `ADD COLUMN` / `CREATE TABLE` a second time and fail, and the deploy is stuck exactly as it was.

Give the migration a later date *and* make its SQL safe to run twice:

1. Do the same two steps as above. The migration is regenerated with a date that sorts after the others, and with a correct snapshot. Copy anything you had written by hand in the old file into the new one.
2. Edit the new `.sql` so it can run on a database that already has its changes:
   - `ADD COLUMN IF NOT EXISTS`
   - `CREATE TABLE IF NOT EXISTS`
   - `CREATE [UNIQUE] INDEX IF NOT EXISTS`
   - `DROP … IF EXISTS`
   - for a constraint, `DROP CONSTRAINT IF EXISTS "name";` right before `ADD CONSTRAINT "name" …`
   - for data fixes (`UPDATE`), a `WHERE` that matches nothing the second time
3. Try it on a copy of production: `tinyzoo status`, then `tinyzoo up`.

The database that ran the old one keeps its record of it. `tinyzoo status` then notes that it has a migration this code does not know. That is harmless.

#### Editing a migration that was already applied

This is not an error. A migration is matched by when it was generated, not by its text. But the edit does not change databases that applied it. Add a new migration instead.

## For tinyzoo maintainers

### The upgrade test

Every pull request runs a real upgrade. A site made on an older tinyzoo is moved to the code in the pull request with the steps this guide gives: `tinyzoo upgrade`, then start with migrations on start. Its content is compared before and after.

If it fails, a site on that version would have failed too. Fix the change, or give it the steps and the changeset **Upgrade** section it needs.

For what it checks, which versions it starts from and how to add a hook for a documented manual step, see CONTRIBUTING.md ("The upgrade test") and `scripts/upgrade-check/README.md`.

### When a change needs an upgrade step

Write one whenever existing sites need something done that `tinyzoo generate` cannot write:

- A change to a `cms_*` table that needs **data**. An example is a new column that must be filled for existing rows with something other than a constant default. The library flag on media had to be set `true` for every file that was already there.
- A database **extension**, or any other statement drizzle-kit does not generate.
- A one-off repair of stored data after a bug.

Schema changes alone need no step. The site's own `tinyzoo generate` writes the migration.

Never write a step that depends on the names of the site's own entity tables. Those are the site's to name. Steps may only touch `cms_*` tables.

### Within 1.x, tinyzoo's tables only grow

A site may skip minor versions ([Skipping minor versions](#skipping-minor-versions)). So, until 2.0:

- A change to a `cms_*` table only adds: a table, a nullable column, a column with a default, an index.
- A column that holds data is never dropped, renamed or given another type. Stop writing to it instead, and drop it in 2.0.
- An upgrade step stays in `CORE_UPGRADE_STEPS` for all of 1.x. It must still work against every later 1.x schema. Since nothing is taken away, it can rely on what existed when it was written.

### Writing one

Add it to `CORE_UPGRADE_STEPS` in `packages/cms/src/upgrades.ts`. A plugin lists its own in `upgrades` of `defineCmsPlugin` ([plugins.md](plugins.md#upgrade-steps)).

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

- **Idempotent.** The step runs again if its record was lost (a database restored from a backup that predates it). With `when`, it runs again whenever the condition holds. Write `WHERE col IS NULL`, `IF NOT EXISTS` and `ON CONFLICT DO NOTHING`.
- **Order of phases.** A `before` step runs before the pending migrations. It can prepare what they need (an extension), but the new columns do not exist yet. An `after` step sees the new schema.
- **Fresh installs.** On a database with no applied migration, steps are recorded without running, because a backfill has nothing to fill. Set `freshInstall: 'run'` for a step the first migration depends on (enabling pg_trgm).
- **`when`** receives `{ run, pendingStatements, freshInstall }`. `pendingStatements` is the SQL of the migrations about to be applied. Use it for a step that only matters for some migrations, as the pg_trgm step does for `gin_trgm_ops`.
- **Everything goes through `ctx.run`**, which is the migration transaction. Do not open another connection. A failure anywhere rolls the whole upgrade back.
- **Test it** in `test/unit/migrate.spec.ts`: a database migrated by the previous version's migrations, then `runUpgrade` with the step.
- **Say so in the changelog** under **Upgrade** if the site has anything to do beyond updating. Usually there is nothing: the step runs by itself.

Bookkeeping is the `cms_upgrades` table (`id`, `since`, `applied_at`). The runner creates it itself. It is not part of the site's `schema.ts`, on purpose. It must exist before the first site migration runs, and a site that dropped or renamed it would silently re-run every step.
