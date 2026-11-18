# The plugin API reference

Every option of `defineCmsPlugin` and every hook, with its type. Look things up here.

[Plugins](plugins.md) is the guide: how to write a plugin, with examples.

All types on this page are exported from `tinyzoo`. They are part of [the public API](api-surface.md#covered), so they follow semver.

## Functions

| Export | Type | What it does |
|---|---|---|
| `defineCmsPlugin(def)` | `(def: CmsPluginDef) => CmsPlugin` | Checks a plugin and returns it. A mistake throws a message that starts with `Plugin "<name>":` |
| `pluginFile(base, relative)` | `(base: string \| URL, relative: string) => string` | The absolute path of a file next to the plugin's module. Pass `import.meta.url` as `base` |

A site registers plugins in `cms.config.ts` with `export const plugins = [eventsPlugin()]`. A plugin exported on its own is found too. The list is read when the site is built.

## Options

`CmsPluginDef`, the object `defineCmsPlugin` takes. Only `name` and `version` are required.

| Option | Type | What it does |
|---|---|---|
| `name` | `string` | Lowercase letters, digits and dashes (`events`, `my-shop`). Everything the plugin adds lives under this name |
| `version` | `string` | The plugin's own version, as `1.2.3`. Its upgrade steps are recorded with it |
| `entities` | `Entity[]` | Collections made with `defineEntity`. Each is named `<name>` or `<name>_…` |
| `singletons` | `Entity[]` | Globals made with `defineSingleton`, named the same way |
| `serverHandlers` | `CmsPluginHandler[]` | Server routes, see [Server routes](#server-routes) |
| `adminPages` | `CmsPluginAdminPage[]` | Pages in the admin, see [Admin pages](#admin-pages) |
| `navItems` | `CmsPluginNavItem[]` | Entries in the admin's sidebar, see [Sidebar entries](#sidebar-entries) |
| `fields` | `Record<string, CmsFieldRenderer>` | Components for a field type, see [Field editors](#field-editors) |
| `components` | `string` | An absolute folder. Every `.vue` file in it becomes a global component, named after its file. `fields` needs it |
| `i18n` | `Record<string, Record<string, unknown>>` | The plugin's admin texts per language, see [Texts](#texts) |
| `hooks` | `CmsPluginHooks` | Code tinyzoo calls at set moments, see [Hooks](#hooks) |
| `graph` | `(entity: CmsEntity) => CmsGraphExtension \| void` | Changes to a collection's list in the admin, see [List notes](#list-notes) |
| `serverPlugins` | `string[]` | Absolute paths of Nitro plugin files (`export default defineNitroPlugin(…)`). They start with the server |
| `upgrades` | `CmsPluginUpgradeStep[]` | Data work a migration cannot do, see [Upgrade steps](#upgrade-steps) |

Names a plugin cannot take: `cms`, `core`, `tinyzoo`, `admin`, `api`, `content`, `media`, `plugins`, `p`, `auth` and `system`.

In entity names, dashes become underscores. The plugin `my-shop` names its entities `my_shop` or `my_shop_…`.

## Server routes

`CmsPluginHandler`, one item of `serverHandlers`. Give it a `route`, a `contentPath`, or both.

| Field | Type | Default | What it does |
|---|---|---|---|
| `handler` | `string` | required | The absolute path of a Nitro handler file (`export default defineEventHandler(…)`) |
| `method` | `CmsHttpMethod` | `'get'` | `'get'`, `'post'`, `'put'`, `'patch'` or `'delete'` |
| `route` | `string` | | The address under `/api/cms/_p/<name>`. It starts with `/` and does not end with one. `:param` matches one segment |
| `access` | `CmsRouteAccess` | `'user'` | Who may call `route`: `'user'` (anyone signed in), `'admin'` or `'public'`. Checked before the handler runs |
| `contentPath` | `string` | | Also serves the handler at `/api/content/<contentPath>`, open to anyone. The first segment starts with `_` and is not `_global`, `_search` or `_sitemap` |

An address under `/api/cms/_p/<name>/` that no route declares gets the strictest `access` the plugin uses.

Handlers can use `useCms()`, `requireCmsUser`, `audit`, `parseOr422`, `rateLimit`, `clientIp` and `sendCmsMail` without an import. These helpers are the server's own. They are not part of the public API, so test a plugin that uses them with each new minor version of tinyzoo.

## Admin pages

`CmsPluginAdminPage`, one item of `adminPages`.

| Field | Type | What it does |
|---|---|---|
| `path` | `string` | The address under `/admin/p/<name>/`. `''` is the plugin's first page. `:id` matches one segment |
| `file` | `string` | The absolute path of the page's Vue file. Start it with `definePageMeta({ layout: 'admin' })` |

## Sidebar entries

`CmsPluginNavItem`, one item of `navItems`. Give it a `page` or a `to`.

| Field | Type | Default | What it does |
|---|---|---|---|
| `label` | `string \| Record<string, string>` | required | The text, or one text per language (`{ en: 'Events', cs: 'Akce' }`) |
| `icon` | `string` | | An Iconify name, such as `i-lucide-calendar` |
| `page` | `string` | | One of the plugin's own `adminPages`, by its `path` |
| `to` | `string` | | Any address in the admin, starting with `/admin` |
| `group` | `'content' \| 'settings'` | `'content'` | Where in the sidebar the entry goes |
| `adminOnly` | `boolean` | `false` | Shows the entry to administrators only |

## Field editors

`CmsFieldRenderer`, the value for one field type in `fields`. Give it at least one of the two.

| Field | Type | What it does |
|---|---|---|
| `edit` | `string` | The name of a global component that edits the field in the form |
| `cell` | `string` | The name of a global component that shows the value in lists |

The site's own `cms.fields` in `app.config.ts` wins over a plugin. Two plugins cannot both register one field type.

## Texts

`i18n` holds the plugin's admin texts, one object per language: `{ en: { title: 'Events' }, cs: { title: 'Akce' } }`.

- `en` is required. Every other language falls back to it.
- Another language may leave keys out. It cannot have a key that `en` does not have.
- A value is a string, an object of strings, or a plural (`{ one, few, other }`).
- The admin reads them as `t('plugins.<name>.<key>')`.

## Hooks

`CmsPluginHooks`, the object in `hooks`. There is one hook.

| Hook | Type | When it runs |
|---|---|---|
| `retention` | `(ctx: CmsRetentionContext) => Record<string, number> \| void` (or a promise of it) | Once a day, in the `cms:retention` task. Delete what the plugin must not keep, and return the counts (`{ drafts: 12 }`). The counts go into the audit log, never the data |

`CmsRetentionContext`, what the hook receives:

| Field | Type | What it is |
|---|---|---|
| `tx` | the database transaction | The task's transaction. It holds the task's lock, so one instance runs at a time |
| `reg` | `CmsRegistry` | The site's entities: `entities`, `byName`, `locales`, `plugins` and `pluginOf` |
| `batch` | `number` | How many rows to delete in one statement |

## List notes

`graph(entity)` is called once for every entity of the site. It returns nothing, or a `CmsGraphExtension`:

| Field | Type | What it does |
|---|---|---|
| `create` | `boolean` | `false` hides the "New …" button of that collection |
| `notices` | `{ icon?: string; key: string; params?: Record<string, string \| number> }[]` | Short lines under the collection's list. `key` is one of the plugin's texts, `plugins.<name>.<key>` |

`entity` is a `CmsEntity`: the entity with its field types erased. It has its `name`, `fields`, `content`, `publish` and so on.

## Upgrade steps

`CmsPluginUpgradeStep`, one item of `upgrades`. It is the same as one of tinyzoo's own steps ([upgrading](upgrading.md#writing-one)), with `since` optional.

| Field | Type | Default | What it does |
|---|---|---|---|
| `id` | `string` | required | Kebab-case. Stored as `<name>:<id>` in `cms_upgrades`. Never change it once released |
| `description` | `string` | required | One plain line: what the step does and why |
| `phase` | `'before' \| 'after'` | required | Runs before or after the site's pending migrations |
| `run` | `(ctx: UpgradeContext) => void \| Promise<void>` | required | The work. It must be idempotent: running it twice gives the same result as once |
| `when` | `(ctx: UpgradeContext) => boolean \| Promise<boolean>` | | Whether the step matters in this run. A step with `when` runs every time it is true |
| `freshInstall` | `'skip' \| 'run'` | `'skip'` | On an empty database a step is recorded without running, unless this is `'run'` |
| `since` | `string` | the plugin's `version` | The version that brought the step |

`UpgradeContext`, what `run` and `when` receive:

| Field | Type | What it is |
|---|---|---|
| `run` | `SqlRunner` | Runs SQL in the migration's transaction, under its lock |
| `pendingStatements` | `string[]` | Every statement of the site's migrations this run applies |
| `freshInstall` | `boolean` | `true` when no migration had been applied before: an empty database |

## Where things live

| What | Where |
|---|---|
| Collections and tables | `<name>` or `<name>_…` |
| Server routes | `/api/cms/_p/<name>/…` |
| Public routes | `/api/content/_<segment>/…` |
| Admin pages | `/admin/p/<name>/…` |
| Texts | `plugins.<name>.…` |
| Upgrade steps | `<name>:<id>` |
