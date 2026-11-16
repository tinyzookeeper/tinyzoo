# Plugins

A plugin adds a feature to a tinyzoo site without changing tinyzoo: its own
collections, admin pages, server routes, field editors, texts, scheduled clean-up and
upgrade steps. Website forms are the first plugin (`tinyzoo/forms`), and the
playground has a small second one, `events` (`playground/cms-plugins/events/`), that
you can read start to finish.

- [Using a plugin](#using-a-plugin)
- [Writing a plugin](#writing-a-plugin)
- [What a plugin can bring](#what-a-plugin-can-bring) — entities, routes, pages, navigation, field editors, texts, retention, graph notes, Nitro plugins, upgrade steps
- [Names: how plugins stay out of each other's way](#names-how-plugins-stay-out-of-each-others-way)
- [Shipping a plugin as an npm package](#shipping-a-plugin-as-an-npm-package)
- [Forms](#forms)

## Using a plugin

Register it in `cms.config.ts`, next to your own entities:

```ts
// cms.config.ts
import { formsPlugin } from 'tinyzoo/forms'
import { eventsPlugin } from './cms-plugins/events'

export const plugins = [formsPlugin(), eventsPlugin()]
```

Then, as after any change to the content model:

```sh
pnpm exec tinyzoo generate   # the plugin's collections become tables in a new migration
pnpm exec tinyzoo up         # or start the app with NUXT_CMS_MIGRATIONS_ON_START=true
```

`tinyzoo generate` treats a plugin's collections exactly like yours: the migration
goes into your `server/db/migrations`, you read it, and the guard stops anything that
loses data. The plugin's **upgrade steps** are run by the same `up`, in the same
transaction as your migrations, and `tinyzoo status` lists them as `<plugin>:<id>`.

The plugin list is read at **build time** (the admin pages, routes and components
have to be registered before the build starts), so adding or removing a plugin needs a
restart of `nuxt dev`. Editing a plugin's own files, or your entities, hot-reloads as
usual.

## Writing a plugin

```ts
// cms-plugins/events/index.ts
import { defineCmsPlugin, defineEntity, f, pluginFile } from 'tinyzoo'

export const Events = defineEntity('events', {
  label: { en: 'Events', cs: 'Akce' },
  titleField: 'title',
  fields: {
    title: f.text({ required: true }),
    startsAt: f.datetime(),
  },
})

export function eventsPlugin() {
  return defineCmsPlugin({
    name: 'events',
    version: '0.1.0',
    entities: [Events],
    serverHandlers: [
      { method: 'get', route: '/summary', handler: pluginFile(import.meta.url, './server/summary.get.ts') },
    ],
    adminPages: [{ path: '', file: pluginFile(import.meta.url, './pages/index.vue') }],
    navItems: [{ label: { en: 'Events overview', cs: 'Přehled akcí' }, icon: 'i-lucide-calendar-days', page: '' }],
    i18n: { en: { title: 'Events overview' }, cs: { title: 'Přehled akcí' } },
  })
}
```

`defineCmsPlugin` checks everything it can at once and throws a message that starts
with `Plugin "events":`. The pieces are plain files:

```
cms-plugins/events/
  index.ts                  the definition above
  server/summary.get.ts     a Nitro handler: export default defineEventHandler(…)
  pages/index.vue           an admin page (definePageMeta({ layout: 'admin' }))
  components/               Vue components, when the plugin brings field editors
```

**Paths are absolute.** Build them with `pluginFile(import.meta.url, './server/x.ts')`
so they are right wherever the plugin lives, in the site or in `node_modules`.

Return the plugin from a function (`eventsPlugin()`), even if it takes no options:
that is what lets a plugin grow options without breaking the sites that use it.

## What a plugin can bring

| Option | What it does |
|---|---|
| `name`, `version` | The plugin's name (`events`, `my-shop`) namespaces everything below; the version is recorded with its upgrade steps. |
| `entities`, `singletons` | Collections (`defineEntity`) and single-row globals (`defineSingleton`). They behave exactly like the site's own: admin lists and editors, the CMS API, access rules, revisions, search, the content API (`content.public`), the typed client, the OpenAPI document. |
| `serverHandlers` | Nitro routes, under `/api/cms/_p/<plugin>/…`, optionally also on the public content API. |
| `adminPages`, `navItems` | Pages under `/admin/p/<plugin>/…` and their entries in the sidebar. |
| `fields`, `components` | Editors and list cells for field types. |
| `i18n` | The plugin's admin texts, per language. |
| `hooks` | Code tinyzoo calls at defined moments (today: `retention`). |
| `graph` | Notes under a collection's list, or no "New" button. |
| `serverPlugins` | Nitro plugins (`defineNitroPlugin`), started with the server. |
| `upgrades` | Upgrade steps (data work a migration cannot do). |

### Entities

```ts
export const Events = defineEntity('events', { … })          // the plugin's name
export const Tickets = defineEntity('events_ticket', { … })  // or `<name>_…`
```

A plugin's entities are named like the plugin, or `<name>_<something>` (dashes of the
plugin's name written as underscores: `my-shop` → `my_shop_order`). The table has the
same name in `snake_case`. That keeps two plugins, and a plugin and the site, from
taking one name; a plugin that breaks the rule is refused when it is defined.

Do **not** also export a plugin's entity from `cms.config.ts`: the plugin brings it.
Relations to the site's entities work (`f.relation(() => Post)`), and the site can
relate to a plugin's entity by importing it from the plugin.

### Server routes

```ts
serverHandlers: [
  // GET /api/cms/_p/events/summary — a signed-in person (the default)
  { method: 'get', route: '/summary', handler: pluginFile(import.meta.url, './server/summary.get.ts') },
  // POST /api/cms/_p/events/orders/42/ship — administrators only
  { method: 'post', route: '/orders/:id/ship', access: 'admin', handler: … },
  // GET /api/cms/_p/events/next and GET /api/content/_events/next — anyone
  { method: 'get', route: '/next', contentPath: '_events/next', access: 'public', handler: … },
]
```

- `route` is relative to `/api/cms/_p/<plugin>`; `:param` matches one path segment,
  `**` everything below. A trailing slash reaches the same handler and gets the same rule.
- **`access`** (default `user`) is enforced **before your handler runs**: `user` a
  signed-in person of any role, `admin` an administrator, `public` anyone. An address
  under `/api/cms/_p/<plugin>/` that no handler declares (or a declared route called
  with another method) gets the strictest rule your plugin uses anywhere: `admin` if
  any of your routes is admin-only, otherwise a signed-in person. A typo never opens
  something. Inside a handler you still decide *what* the person
  may see or do (`useCms()`, `requireCmsUser(event)`, `accessWhere(entity, 'update', user)`,
  as the CMS's own handlers do).
- State-changing requests under `/api/cms/` must carry JSON (the CMS's CSRF rule);
  nothing to do on your side.
- `contentPath` (optional, instead of or next to `route`) serves the handler on the
  public content API at `/api/content/<contentPath>`: for a plugin that gives the
  *website* something to call (the forms plugin's `_form/:name`). The first segment
  must start with `_` and cannot be `_global`, `_search` or `_sitemap`. These routes
  are open (`access` does not apply): the handler checks what it needs, such as the
  content token or a spam check.

A handler file is an ordinary Nitro handler. Nitro's auto-imports work in it
(`defineEventHandler`, `createError`, `readBody`, `useRuntimeConfig`) and so do
tinyzoo's server helpers (`useCms()` for the database and the registry,
`requireCmsUser`, `audit`, `parseOr422`, `rateLimit`, `clientIp`, `sendCmsMail`); what
you import from `tinyzoo` or `drizzle-orm` (`eq`, `sql`, `gte`) you import yourself.

```ts
// server/summary.get.ts
import { sql } from 'tinyzoo'

export default defineEventHandler(async (event) => {
  requireCmsUser(event)
  const { db, reg } = useCms()
  const t = reg.byName.get('events')!.table
  const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(t)
  return { total: row?.total ?? 0 }
})
```

### Admin pages and navigation

`adminPages: [{ path: '', file }, { path: 'orders/:id', file }]` serves
`/admin/p/<plugin>` and `/admin/p/<plugin>/orders/:id`. A page is a normal Vue page of
the admin: `definePageMeta({ layout: 'admin' })`, then the CMS's components
(`CmsPage`, `CmsEmptyState`, `CmsStatusBadge`, …), the admin's tokens and its
`useCmsI18n()`. Follow `docs/ui-foundation.md`, so a plugin looks like the rest of the
admin. Pages sit behind the admin's sign-in like every `/admin` page; the data they
show comes from the plugin's routes, which have their own `access`.

`navItems` put entries in the sidebar: `{ label, icon, page }` (a page of this plugin,
by its `path`) or `{ label, icon, to: '/admin/events' }`; `group: 'content'` (default)
or `'settings'`; `adminOnly: true` hides it from everyone else. A plugin's *collections*
already appear in the sidebar by themselves, as any collection does.

### Field editors

```ts
defineCmsPlugin({
  name: 'colors',
  version: '1.0.0',
  components: pluginFile(import.meta.url, './components'),
  fields: { color: { edit: 'ColorsPicker', cell: 'ColorsSwatch' } },
})
```

Every `.vue` file in `components` is registered globally under its file name; `fields`
maps a **field type** to the components that edit it in the form (`edit`) and show it
in lists (`cell`). It is the field registry of the README (`cms.fields`) fed by a
plugin: the site's own `app.config.ts` entry for a type still wins, then the plugin's,
then the built-in one. Two plugins cannot both register one type.

### Texts

```ts
i18n: {
  en: { title: 'Events overview', days: { one: '{count} day', other: '{count} days' } },
  cs: { title: 'Přehled akcí', days: { one: '{count} den', few: '{count} dny', other: '{count} dní' } },
}
```

In the admin, `t('plugins.events.title')` and `t('plugins.events.days', { count: 3 })`.
`en` is required (every other language falls back to it); a language may leave keys
out but cannot have a key English does not. Write natural text for each language the
admin offers (`cs`, `en`, `de`). A text that should be shown by the CMS itself (a note
under a list) is referred to by key: `plugins.<name>.<key>`.

### Retention

```ts
hooks: {
  retention: async ({ tx, reg, batch }) => {
    // delete what is past its time, using `tx` (the task's transaction and lock)
    return { drafts: 12 }   // what was deleted, for the audit entry — counts only
  },
}
```

The daily `cms:retention` task calls the hook of every plugin that has one, in its
transaction and under its advisory lock (one instance at a time), then writes one audit
entry with the counts (`meta.plugins.<name>`; never the data). The forms plugin deletes
submissions past their form's `retentionDays` this way.

### Notes in the admin's lists

`graph(entity)` is called for every entity when the registry is built, and may return
`{ create: false }` (no "New …" button: entries arrive some other way) and
`notices: [{ icon, key, params }]` (short lines under the list, from the plugin's
`i18n`). The forms plugin uses both for its forms: no "New" button, and "Messages are
deleted automatically after 180 days."

### Nitro plugins

`serverPlugins: [pluginFile(import.meta.url, './server/startup.ts')]`: files with
`export default defineNitroPlugin(…)`, started with the server, for whatever must run at
start (a queue, a webhook listener, a hook on `cms:change`). Nitro's own rules apply.

### Upgrade steps

A plugin's own data work, run with tinyzoo's, in the same transaction and lock as the
site's migrations (`tinyzoo up`, or the app's start with `NUXT_CMS_MIGRATIONS_ON_START`):

```ts
upgrades: [{
  id: 'backfill-place',                 // kebab-case; never changes once released
  description: 'Events saved without a place get "To be announced"',
  phase: 'after',                       // 'before' the site's pending migrations, or 'after' them
  run: async ({ run }) => { await run(`update "events" set "place" = 'To be announced' where "place" is null`) },
}]
```

It is the same step as in [`docs/upgrading.md`](upgrading.md#writing-one) (idempotent,
`phase`, `when`, `freshInstall`), with three differences:

- the id is recorded as **`<plugin>:<id>`** in `cms_upgrades`, so two plugins can both
  have a `backfill`;
- `since` is the **plugin's** version (it defaults to `version`);
- a step may touch the plugin's own tables. (tinyzoo's own steps only touch `cms_*`
  tables; a plugin's collections are tables of the *site's* database, and the plugin
  owns them.)

Schema changes of a plugin's collections need no step: they arrive as the site's next
`tinyzoo generate` migration, like any change. Say in the plugin's changelog what a
site must do after updating it.

## Names: how plugins stay out of each other's way

Everything a plugin adds lives under its own name:

| What | Where |
|---|---|
| Collections and tables | `<name>` or `<name>_…` |
| Server routes | `/api/cms/_p/<name>/…` |
| Public routes (optional) | `/api/content/_<segment>/…`, each address served by one plugin |
| Admin pages | `/admin/p/<name>/…` |
| Texts | `plugins.<name>.…` |
| Upgrade steps | `<name>:<id>` |

Mistakes stop the build, or the start, with a message that names the plugin:

| Mistake | Message (shortened) |
|---|---|
| a reserved or malformed name (`cms`, `admin`, `p`, `My Shop`) | `Plugin "cms": "cms" is reserved by tinyzoo.` |
| two plugins with one name | `Two plugins are named "events": register it once.` |
| an entity outside the plugin's names | `the entity "order" must be named "shop" or "shop_…"` |
| the site defines an entity the plugin brings | `The entity "events" of the plugin "events" is also defined by the site` |
| two plugins on one public route, or one field type | `GET /api/content/_form/:name is already served by the plugin "forms"` |
| a file that is not there | `server handler "/summary": handler "/…/summary.get.ts" does not exist` |
| an entity that needs a plugin that is not registered | `"contactForm" needs the "forms" plugin, which is not registered: add export const plugins = [formsPlugin()]` |

## Shipping a plugin as an npm package

A plugin is a function that returns `defineCmsPlugin(…)`; nothing about it is tied to
the site's folder. To publish one:

```jsonc
// package.json of the plugin
{
  "name": "tinyzoo-plugin-events",
  "exports": { ".": "./index.ts" },
  "files": ["index.ts", "server", "pages", "components"],
  "peerDependencies": { "tinyzoo": ">=0.2.0", "nuxt": "^4.4.0" }
}
```

```ts
// the site's cms.config.ts
import { eventsPlugin } from 'tinyzoo-plugin-events'
export const plugins = [eventsPlugin()]
```

Like tinyzoo itself, a plugin ships TypeScript and Vue source: the site's Nuxt build
compiles it. All paths in the definition come from `pluginFile(import.meta.url, …)`, so
they point into the installed package. A plugin's collections reach the site's schema
through `tinyzoo generate`, its tables are created by the site's own migration.

> **Not covered by tests yet:** a plugin installed from the registry into
> `node_modules`. The forms plugin is the case that is covered (it is shipped inside the
> `tinyzoo` tarball and built by `scripts/consumer-check.mjs`); a third-party package
> works the same way in principle, but nobody has published one yet. If Nitro leaves the
> package's `.ts` files external, add the package to `nitro: { externals: { inline: [...] } }`
> in the site's `nuxt.config.ts`.

## Forms

The first plugin, shipped inside tinyzoo as a subpath:

```ts
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'

export const plugins = [formsPlugin()]
export const ContactForm = defineForm('contactForm', { label: 'Contact form', fields: { … } })
export const FormSettings = defineFormSettings()
```

The forms and their settings stay **the site's own** entities (named by the site, with
the tables `defineForm` has always made); the plugin brings what is around them:

| Part | Where it is in the plugin API |
|---|---|
| `GET` / `POST /api/content/_form/:name` (validation, spam checks, rate limit, Turnstile, notification emails) | `serverHandlers` with `contentPath: '_form/:name'`, so the address is the one sites already use |
| `<CmsForm>` for the website's pages | `components` (a global component directory) |
| Deleting submissions after `retentionDays` | `hooks.retention` |
| No "New" button, and the retention note under a form's list | `graph` + `i18n` |

`defineForm` and `defineFormSettings` are still exported from `tinyzoo` (deprecated,
removed in 0.4): they register the forms plugin by themselves and say so once, so a site
that has not moved yet keeps working with the same tables, endpoints and component.
The move, for a site that already has forms:

```diff
-import { defineForm, defineFormSettings } from 'tinyzoo'
+import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
+
+export const plugins = [formsPlugin()]
```

No migration: the tables do not change.

The Privacy screen (find, export and erase what is stored about an email address) still
reads form submissions through the forms' entity tag; making that a hook of its own is
left for a later change.
