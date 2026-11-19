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
| `entities` | `unknown[]` | Collections made with `defineEntity` (any `Entity` fits). Each is named `<name>` or `<name>_…` |
| `singletons` | `unknown[]` | Globals made with `defineSingleton`, named the same way |
| `tables` | `PgTable[]` | Drizzle tables that are not entries, see [Tables](#tables) |
| `tablesSource` | `string` | The same tables as source, for the site's schema.ts, see [Tables](#tables) |
| `serverHandlers` | `CmsPluginHandler[]` | Server routes, see [Server routes](#server-routes) |
| `adminPages` | `CmsPluginAdminPage[]` | Pages in the admin, see [Admin pages](#admin-pages) |
| `navItems` | `CmsPluginNavItem[]` | Entries in the admin's sidebar, see [Sidebar entries](#sidebar-entries) |
| `dashboardWidgets` | `CmsDashboardWidget[]` | Cards on the admin's home page, see [Home widgets](#home-widgets) |
| `entityPanels` | `CmsEntityPanel[]` | Panels in the entry editor, see [Entry panels](#entry-panels) |
| `fields` | `Record<string, CmsFieldRenderer>` | Components for a field type, see [Field editors](#field-editors) |
| `components` | `string` | An absolute folder. Every `.vue` file in it becomes a global component, named after its file. `fields`, `dashboardWidgets` and `entityPanels` need it |
| `i18n` | `Record<string, Record<string, unknown>>` | The plugin's admin texts per language, see [Texts](#texts) |
| `hooks` | `CmsPluginHooks` | Code tinyzoo calls at set moments, see [Hooks](#hooks) |
| `graph` | `(entity: CmsEntity) => CmsGraphExtension \| void` | Changes to a collection's list in the admin, see [List notes](#list-notes) |
| `serverPlugins` | `string[]` | Absolute paths of Nitro plugin files (`export default defineNitroPlugin(…)`). They start with the server |
| `appPlugins` | `CmsPluginAppPlugin[]` | Nuxt app plugins for the website and the admin, see [App plugins](#app-plugins) |
| `upgrades` | `CmsPluginUpgradeStep[]` | Data work a migration cannot do, see [Upgrade steps](#upgrade-steps) |

Names a plugin cannot take: `cms`, `core`, `tinyzoo`, `admin`, `api`, `content`, `media`, `plugins`, `p`, `auth` and `system`.

In entity names, dashes become underscores. The plugin `my-shop` names its entities `my_shop` or `my_shop_…`.

## Tables

`tables` and `tablesSource` go together: give both or neither.

| Option | Type | What it is |
|---|---|---|
| `tables` | `PgTable[]` | Tables made with `pgTable` from `drizzle-orm/pg-core`. Each is named `<name>` or `<name>_…` (dashes as underscores), in the default schema |
| `tablesSource` | `string` | The same tables as source. Only `export const <name in camelCase> = pgTable('<name>', …)` statements, in plain JavaScript. `drizzle-orm/pg-core`'s builders and `sql` are imported for it |

`tinyzoo generate` pastes `tablesSource` into the site's `server/db/schema.ts`, so drizzle-kit makes the tables' migrations. Before that it runs the source and compares every table with the one in `tables`: columns, primary keys, foreign keys, unique constraints, indexes and checks. A difference stops it.

On the server the tables are in the registry: `useCms().reg.pluginTables` is a `Map` from the SQL name to the table. A table's name cannot be one an entity's table already has.

## Server routes

`CmsPluginHandler`, one item of `serverHandlers`. Give it a `route`, a `contentPath`, or both.

| Field | Type | Default | What it does |
|---|---|---|---|
| `handler` | `string` | required | The absolute path of a Nitro handler file (`export default defineEventHandler(…)`) |
| `method` | `CmsHttpMethod` | `'get'` | `'get'`, `'post'`, `'put'`, `'patch'` or `'delete'` |
| `route` | `string` | | The address under `/api/cms/_p/<name>`. It starts with `/` and does not end with one. `:param` matches one segment |
| `access` | `CmsRouteAccess` | `'user'` | Who may call `route`: `'user'` (anyone signed in), `'admin'` or `'public'`. Checked before the handler runs |
| `contentPath` | `string` | | Also serves the handler at `/api/content/<contentPath>`, open to anyone. The first segment is exactly `_<plugin name>`, dashes kept, as in `_events/next` or `_my-shop/feed`. The forms plugin's `_form` is the one exception. A plugin named `global`, `search`, `sitemap`, `tree` or `form` serves no content routes |

An address under `/api/cms/_p/<name>/` that no route declares gets the strictest `access` the plugin uses.

Handlers can use these server helpers without an import:

| Helper | Frozen | What it does |
|---|---|---|
| `useCms()` | yes | Returns at least `{ db, reg }`: the site's drizzle database and the `CmsRegistry` |
| `requireCmsUser(event)` | yes | Returns the signed-in person (`CmsUser`: `id`, `role`, `email?`, `name?`, `locale?`). Throws 401 when nobody is signed in, 403 `role-removed` when their role is gone from the config |
| `audit`, `parseOr422`, `rateLimit`, `clientIp`, `sendCmsMail` | no | The server's own. They can change in a minor release, so test a plugin that uses them with each new minor version of tinyzoo |

`db` and the columns of an entity's `table` are drizzle's. Their types follow `drizzle-orm` ([the public API](api-surface.md#query-helpers)). The driver under `db` is not promised: use drizzle's API, not `db.$client`.

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
| `label` | `LocalizedText` (`string \| Record<string, string>`) | required | The text, or one text per language (`{ en: 'Events', cs: 'Akce' }`) |
| `icon` | `string` | | An Iconify name, such as `i-lucide-calendar` |
| `page` | `string` | | One of the plugin's own `adminPages`, by its `path` |
| `to` | `string` | | Any address in the admin, starting with `/admin` |
| `group` | `'content' \| 'settings'` | `'content'` | Where in the sidebar the entry goes |
| `adminOnly` | `boolean` | `false` | Shows the entry to administrators only |

## Home widgets

`CmsDashboardWidget`, one item of `dashboardWidgets`.

| Field | Type | Default | What it does |
|---|---|---|---|
| `component` | `string` | required | A component of the plugin's `components` folder, by its file name (`StatsVisitors`) |
| `order` | `number` | `0` | Sorts the widgets of all plugins, smallest first. Equal orders keep the order the plugins are registered in |
| `adminOnly` | `boolean` | `false` | Shows the widget to administrators only |

Widgets sit in the home's main column, before "Recent". The component draws its own card and heading. When it renders nothing, the home leaves no gap. Two plugins cannot use one component name for a widget or a panel.

## Entry panels

`CmsEntityPanel`, one item of `entityPanels`.

| Field | Type | Default | What it does |
|---|---|---|---|
| `component` | `string` | required | A component of the plugin's `components` folder |
| `label` | `LocalizedText` | required | The heading above the panel |
| `entities` | `string[]` | every collection | The collections it is shown for. A name that is not a collection of the site stops the build |

The panel sits in the side column of the entry editor, under the details. Its component gets the props `entity` (`string`), `id` (`string`) and `locale` (`string | null`, the language being edited). It is outside the form, and it is not shown for an entry that has not been saved yet. A panel that renders nothing is left out, heading and all.

## App plugins

`CmsPluginAppPlugin`, one item of `appPlugins`.

| Field | Type | Default | What it does |
|---|---|---|---|
| `src` | `string` | required | The absolute path of a Nuxt plugin file (`export default defineNuxtPlugin(…)`) |
| `mode` | `'client' \| 'server' \| 'all'` | `'all'` | Where it runs: in the browser, while rendering, or both |

They are added after the site's and tinyzoo's own plugins. The website and the admin are one app, so they run on both.

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
| `tx` | `any` (a drizzle transaction) | The task's transaction. It holds the task's lock, so one instance runs at a time |
| `reg` | `CmsRegistry` | The site's entities: `entities`, `byName`, `locales`, `plugins`, `pluginOf` and `pluginTables` |
| `batch` | `number` | How many rows to delete in one statement |

## List notes

`graph(entity)` is called once for every entity of the site. It returns nothing, or a `CmsGraphExtension`:

| Field | Type | What it does |
|---|---|---|
| `create` | `boolean` | `false` hides the "New …" button of that collection |
| `notices` | `` { icon?: string; key: `plugins.${string}`; params?: Record<string, string \| number> }[] `` | Short lines under the collection's list. `key` is one of the plugin's texts, written in full: `plugins.<name>.<key>` |

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
