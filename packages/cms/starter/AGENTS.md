# AGENTS.md

Notes for a coding assistant working in this website. It is a Nuxt 4 app with
[tinyzoo](https://github.com/tinyzookeeper/tinyzoo) inside: a code-first CMS. Editors work at `/admin`; the
pages read content from the content API at `/api/content`. Read `README.md` for how to start it.
The guides linked below are also on the website at https://tinyzoo.pushbase.app/en/docs, with an editors' guide
(Czech, English, German) to hand to the people who will write the content.

## The rule that shapes everything

**The content model is code.** Every collection, field, block, language and role is defined in
`cms.config.ts`, in TypeScript. There is no screen in the admin that changes the structure: editors change data,
developers change structure. The database schema, its migrations, the validation, the admin's forms and the typed
client are all generated from that one file. To change what editors can write, edit `cms.config.ts` and run the
workflow below. Never work around it by editing generated files or the database.

## Where things are

| | |
|---|---|
| `cms.config.ts` | the content model: entities, globals, blocks, `locales`, `roles`, `plugins`. tinyzoo reads every export |
| `server/db/schema.ts`, `server/db/migrations/` | **generated** from `cms.config.ts`. Committed, never edited by hand |
| `app/lib/cms-content.ts` | the **generated** typed client and types for the content API. Committed, never edited |
| `app/pages/[...slug].vue` | every CMS page (and news list and item, if the site has news), in each language |
| `app/components/global/Block<Type>.vue` | how each block of the pages looks (`hero` → `BlockHero.vue`), typed from the client |
| `app/composables/useSite.ts`, `app/utils/site.ts` | the visitor's language, settings and menus; the site's languages (`LANGUAGES`, first = default) and its own few words per language |
| `seed/` | demo content (`defineSeed`), if the site has it |
| `.env` | `DATABASE_URL`, `NUXT_APP_SECRET` (required, 32+ characters). Not committed |

## Commands

Run the scripts with this site's package manager (the lockfile says which: `pnpm db:generate`, `npm run
db:generate`, …) and the CLI through its exec (`pnpm exec tinyzoo status`, `npx tinyzoo status`).

| Script | Runs | What it does |
|---|---|---|
| `dev`, `build`, `typecheck` | Nuxt, `vue-tsc` | develop, build, check types (run `typecheck` after every model change) |
| `db:generate` | `tinyzoo generate` | writes `server/db/schema.ts` and a migration for the difference |
| `db:migrate` | `tinyzoo up` | applies migrations and tinyzoo's upgrade steps to `DATABASE_URL` |
| `cms:client` | `tinyzoo client app/lib/cms-content.ts` | regenerates the typed client |
| `seed` | `tinyzoo seed` | puts `seed/index.ts` into a running site (only with demo content) |

Other CLI commands: `tinyzoo status` (applied and pending; exit 1 when something is pending), `tinyzoo upgrade`,
`tinyzoo export` / `import`, `tinyzoo backup` / `restore`, `tinyzoo openapi`, `tinyzoo help` (every command and flag).

## Changing the content model

1. Edit `cms.config.ts`.
2. `db:generate`. **Read the new migration** in `server/db/migrations/`. `tinyzoo generate` stops on SQL that
   loses data (a removed or renamed field, a type change: `--allow-drop`) or may fail on existing rows (a new
   required field without a default: `--allow-risky`). Do not pass those flags to get past the guard; fix the
   model instead (`.optional()` or `.withDefault()` first), unless the person you work for decided the data can go.
3. `db:migrate`, then `cms:client`, then `typecheck`. A renamed block field makes `typecheck` point at every
   component that still uses the old name.
4. Commit `cms.config.ts`, the migration, `schema.ts` and `cms-content.ts` together.

Renames, removals, type changes and adding required fields have recipes in
[upgrading.md](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/upgrading.md#recipes): read the one you need first.

**After updating tinyzoo** (`tinyzoo` and `@tinyzoo/client` always on the same version, updated with
`--latest`): read the **Upgrade** section of the release in the changelog, run `typecheck`, then
`tinyzoo upgrade` (checks versions, writes the schema and the migration, regenerates the client, prints the status).
Review and commit what it wrote. Files this site was made with are never updated for you.

## Fields

`import { defineEntity, defineSingleton, defineBlock, defineLocales, defineRoles, f } from 'tinyzoo'`.
The `f` set is closed: `f.text` (`required`, `format: 'email' | 'url' | 'path' | 'link'`, `multiline`, `max`),
`f.slug` (`from`, `unique`), `f.number` (`int`, `min`, `max`; `int: false` is a decimal, typed **`string`**),
`f.boolean`, `f.datetime` (`allDay`), `f.select` (`options: [...] as const`, `default`, `labels`), `f.richtext`,
`f.color`, `f.media`, `f.file`, `f.gallery`, `f.relation` (`to: () => Entity`, `kind`), `f.list` (`fields`, `max`),
`f.group` (`fields`), `f.blocks` (`defineBlock`s).

Modifiers: `.optional()` (**every field is required unless you say so**, except relations), `.localized()` (one
value per language, falls back to the default language; text, slug, rich text, blocks, lists and groups only),
`.unique()`, `.withDefault(v)`, `.label()`, `.help()`, `.position('sidebar')`, `.group(label)`, `.icon()`,
`.access({ read, edit })`. Labels take one string or one per admin language: `{ cs: 'Název', en: 'Title' }`.

**Languages** are `export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })`. To add one, put
its code there and in `LANGUAGES` in `app/utils/site.ts`, then `cms:client` (languages are text columns: no migration).

Make a global with `defineSingleton(name, def)`. An entity's other options: `titleField`, `content` (the public
API: `public`, `published`, `slug`, `path`, `populate`, `hidden`), `publish` (the draft/published workflow),
`access` (row-level rules), `admin` (list columns, editor layout, sections), `tree`.
Full reference: [content-model.md](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/guide/content-model.md).

## Roles and per-field permissions

The built-in roles are `admin`, `editor` and `author`. A site's own roles extend `editor` or `author`:

```ts
// Export it from cms.config.ts, above the entities that name its roles.
export const roles = defineRoles({
  translator: {
    from: 'editor',
    label: { cs: 'Překladatel', en: 'Translator' },
    entities: { post: ['read', 'update'] },
    publish: false,
    media: 'own',
  },
})

export const Post = defineEntity('post', {
  label: { cs: 'Články', en: 'Posts' },
  titleField: 'title',
  fields: {
    title: f.text({ required: true }).localized(),
    // Only editors (and administrators) change it; everyone else sees it locked.
    category: f.select({ options: ['news', 'event'] as const, default: 'news' }).access({ edit: ['editor'] }),
    // The translator may edit this one too.
    body: f.richtext().localized().access({ edit: ['editor', roles.translator] }),
  },
})
```

- A collection listed in `entities` gets exactly those operations; one left out gets what `from` allows, so list
  every collection a narrow role must not change.
- Name your own roles by reference (`roles.translator`), built-ins as strings. A role is never inherited:
  `'editor'` in a list does not include a role that extends editor.
- `.access()` is for fields of a collection or global, not inside a block, list or group. The title, the publish
  status and date, the slug and the tree position cannot have a `read` rule.
- In row-level `access` rules test `user.base` (the built-in the role is or extends), not `user.role`.
- Field rules apply in the admin only. The public content API follows `content.hidden` and `content.published`.
- Removing a role from the config locks its people out (they see "Your role no longer exists"); `tinyzoo status`
  warns. Roles need no migration.

Guide: [roles.md](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/guide/roles.md).

## Publishing per language

`publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', dateField: 'publishedAt', perLocale: true }`
gives each translation its own state and schedule. It needs a `.localized()` field, is not for page trees, and adds
three columns (`db:generate`). A language follows the default language until an editor publishes or unpublishes it on
its own, so turning it on changes nothing on the website. A first translation of a live entry is **being translated**:
visitors keep the default language there until an editor publishes it (send `"status": null` through the API to have
it follow, and go live, at once). **The default language gates**: a translation is live only
while the default language is live. An unpublished language is a 404 in that language and is left out of its lists,
the sitemap, `hreflang` and search. See
[content-model.md](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/guide/content-model.md#publishing-each-language-on-its-own).

## The website side

- Types for pages and blocks come from the generated client: `import type { Page } from '~/lib/cms-content'`. For
  typed requests use `createClient` from the same file (`cms.<entity>.list({ … })`, `cms.<entity>.get(slug)`,
  `cms.global('siteSettings', { locale })`); filters and sort keys are checked by the compiler. The plain routes are `GET /api/content/<entity>`,
  `/api/content/<entity>/<slug>`, `/api/content/_global/<name>`, `/api/content/_search?q=`, all with `?locale=`.
- The frontend kit, available everywhere without imports: `<CmsBlocks>`, `<CmsImage>`, `<CmsContent>` (rich text;
  never render it as HTML yourself), `<CmsNav>`, `<CmsHighlight>`, `<CmsForm>`, `useCmsSeo()`, `useCmsSearch()`,
  `useCmsUiLocale()`. Other `Cms*` components belong to the admin and are internal.
- A decimal (`f.number({ int: false })`) is a string in the API and in `Row`: `Number(item.price)`.

Guide: [content-api.md](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/guide/content-api.md).

## What is stable

From 1.0, [the public API](https://github.com/tinyzookeeper/tinyzoo/blob/main/docs/api-surface.md) follows semver:
the config API (`define*`, `f.*`, presets), the content API and `@tinyzoo/client`, the `cms` options in
`nuxt.config.ts` and `NUXT_CMS_*` variables, the webhook and Nitro hooks, the CLI, the frontend kit and the admin's
extension points. **Anything else exported from `tinyzoo` is tagged `@internal`** in its JSDoc and can change in any
minor release.

## Don'ts

- Do not run `drizzle-kit push`. It drops tinyzoo's own bookkeeping table and skips the migration history and the
  guard. Change the schema with `db:generate` and apply it with `db:migrate`.
- Do not edit `server/db/schema.ts`, files in `server/db/migrations/` or `app/lib/cms-content.ts`. Regenerate them.
  Do not change or delete a migration that has run on any database.
- Do not import anything tagged `@internal` from `tinyzoo`, and do not call the admin's API (`/api/cms/**`) from
  the website: it is internal too. Use the content API, the client and the frontend kit.
- Do not put secrets in `nuxt.config.ts` (it is built into the app). `DATABASE_URL` and `NUXT_APP_SECRET` go in the
  environment.
- Do not make the structure editable at run time (no settings table that defines fields). Change `cms.config.ts`.
