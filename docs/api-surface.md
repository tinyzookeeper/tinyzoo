# The public API

This page lists what tinyzoo promises not to break. Check it before you depend on something, or before you upgrade.

- Since **1.0**, everything on this page follows [semantic versioning](https://semver.org). A breaking change waits for 2.0.
- Anything removed was deprecated for at least one minor release first ([how](../CONTRIBUTING.md#deprecations)).

## Covered

| Frozen surface | Where |
|---|---|
| [The config API](#the-config-api-tinyzoo): `defineEntity`, `f.*`, blocks, presets, seeds, plugins | `tinyzoo`, [`tinyzoo/forms`](#forms-tinyzooforms), [`tinyzoo/analytics`](#analytics-tinyzooanalytics), [`tinyzoo/consent`](#cookie-consent-tinyzooconsent) |
| [The Nuxt layer and its options](#the-nuxt-layer-and-the-cms-options) and [environment variables](#environment-variables) | `tinyzoo/layer`, `tinyzoo/module`, `nuxt.config`, `NUXT_CMS_*` |
| [The content API](#the-content-api-http) (HTTP) and [the client](#the-client-tinyzooclient) | `/api/content/*`, `@tinyzoo/client` |
| [The media and logo addresses](#media-and-logo-addresses) stored in content and emails | `/api/cms/_media/raw/<key>`, `/api/cms/_media/img/<id>/<width>.webp`, `/api/cms/_brand/<file>` |
| [The frontend kit](#the-frontend-kit): `<CmsBlocks>`, `<CmsImage>`, `<CmsContent>`, `<CmsNav>`, `<CmsHighlight>`, `<CmsForm>`, `<CmsConsent>`, `useCmsSeo()`, `useCmsSearch()`, `useCmsUiLocale()`, `useConsent()` | `Cms*` components and composables of the layer and its plugins |
| [The webhook](#the-webhook) and [the Nitro hooks](#the-nitro-hooks) | `cms:*` |
| [The server helpers for plugins](#server-helpers-for-plugins): `useCms()` and `requireCmsUser(event)` | a plugin's server routes |
| [External sign-in](#external-sign-in): what the host sets with `auth.mode: 'external'` | `event.context.cmsUser` |
| [The CLI](#the-cli) | `tinyzoo <command>` |
| [The admin's extension points](#the-admins-extension-points) | `cms.fields` in `app.config.ts` |

## Not covered

Anything that is not on this page is internal. For example:

- The admin's own components (the other `Cms*` components). [The frontend kit](#the-frontend-kit) lists the ones a website uses.
- The server's other utilities (`audit`, `parseOr422`, `rateLimit`, `clientIp`, `sendCmsMail` and the rest). Only [the two helpers for plugins](#server-helpers-for-plugins) are covered.
- The admin's API (`/api/cms/**`), apart from the three [media and logo addresses](#media-and-logo-addresses).
- Anything marked `@internal`.
- The SQL tables and their column names. tinyzoo migrates them for you, and [upgrading.md](upgrading.md) lists the steps. An entity's `table` object is frozen for reading (see [Types](#types)). tinyzoo's own `cms_*` tables only gain things within 1.x, so a site can skip minor releases ([upgrading](upgrading.md#skipping-minor-versions)).
- The driver under `useCms().db` (today node-postgres, `db.$client`). See [server helpers](#server-helpers-for-plugins).
- The text the CLI prints. Its commands, flags and exit codes are covered.
- How the admin looks.
- Performance, and the numbers listed as [tuning](#numbers-promised-and-numbers-tuned).

These can change in any minor release, and the changeset always says so.

The names themselves will not change: `cms.config.ts`, `NUXT_CMS_*`, `cms_*`, `Cms*` and the `cms` key of `nuxt.config`.

## How it is guarded

Every surface above is written down as a golden file in `test/contracts/`.

- A test fails, with the lines that differ, when the code no longer produces the file.
- `pnpm contracts:update` accepts the change.
- The reviewer reads that diff, and the changeset says whether it breaks sites ([CONTRIBUTING.md](../CONTRIBUTING.md#contracts)).

| Golden file | What it holds |
|---|---|
| `api-tinyzoo.txt`, `api-tinyzoo-forms.txt`, `api-tinyzoo-analytics.txt`, `api-tinyzoo-consent.txt`, `api-tinyzoo-module.txt`, `api-client.txt` | the exported declarations of each entry point (what is `@internal` is listed by name only) |
| `module-options.json` | the options of the `cms` key with their defaults, and the environment variables that follow |
| `nitro-hooks.d.ts` | the Nitro hooks with their argument types, and what tinyzoo adds to nuxt-auth-utils' `User` and `UserSession` |
| `server-helpers.d.ts` | `useCms()` and `requireCmsUser(event)` with their types |
| `cli-usage.txt` | the commands and flags of `tinyzoo` |
| `webhook.json` | the headers and body of a publish webhook |
| `content-routes.txt` | the routes of the content API |
| `layer-config.json` | what `extends: ['tinyzoo/layer']` sets up |
| `openapi.playground.json`, `client-types.playground.ts` | the content API of the playground |
| `frontend-kit.txt` | the props, emits, slots and signatures of the frontend kit |
| `surface.client-types.ts`, `surface.openapi.json`, `surface.admin-graph.json` | the content API, client types and admin graph of `test/contracts/surface/cms.config.ts`, a config that uses every field and option (a role of the site's own, a field with `.access()`, per-language publishing among them) |

`test/unit/surface-types.spec.ts` asserts the inferred `Row`, `Insert` and `Update` types, the role references and the client's types of that same config. A type regression fails `pnpm typecheck`.

`test/unit/api-surface.spec.ts` also checks that this page names every public export, command, flag, route, hook and variable.

## What a minor release may add

A minor release adds things. Code that reads what tinyzoo sends must expect them.

**New keys.** In the content API's answers, the site status (`CmsStatus`), the webhook's body, the hooks' arguments (`CmsChange`, `CmsSitemapEntry`, `CmsErrorReport`), the forms' answers and what `useCms()` returns. Ignore keys you do not know.

**New members of the unions you receive.** For example:

- the change types (`CmsChangeType`, the webhook's `type` and `x-cms-event`);
- a form's `status` (today `new`, `read`, `done`);
- `CmsErrorReport.source` (today `request`, `task`, `webhook`);
- the built-in roles (`CmsRole`, `CmsRoleBase`);
- the field kinds (`FieldKind`);
- the accents (`CmsAccentPreset`);
- rich text's node and mark types ([rich text](#rich-text)).

Handle a value you do not know. A `switch` over one needs a `default`. An exhaustive check (`const unreachable: never = value`) fails to compile on the next minor.

**New routes and parameters that start with `_`.** For example `/api/content/_x` or `?_x=`. That is why such names are tinyzoo's ([names tinyzoo keeps](#names-tinyzoo-keeps)).

**New hooks, CLI commands and flags, `cms` options and variables.**

**New picture widths** for [`/api/cms/_media/img/<id>/<width>.webp`](#media-and-logo-addresses). The list only grows.

**New parts in the webhook's signature header** ([the webhook](#the-webhook)).

## Numbers promised and numbers tuned

Some numbers in these pages are part of the contract. Others are tuning: a minor release may change them, and its changelog says so.

| Promised | Value |
|---|---|
| a list's page size | default 20, at most 100 (`limit`) |
| the website search's `limit` | default 10, 1 to 50 |
| header names | `x-cms-event`, `x-cms-delivery`, `x-cms-signature` (`CMS_WEBHOOK_HEADERS`); `x-api-key` and `Authorization: Bearer` for the content token |
| the webhook's signature scheme | HMAC-SHA256 of `<t>.<raw body>`, hex, in a `v1=` part ([the webhook](#the-webhook)) |
| picture widths | 320, 640, 960, 1280 and 1920 are always there; more may be added |

| Tuning | Today |
|---|---|
| the website search's rate limit | 120 searches a minute per visitor |
| a form's rate limits | 30 attempts and 8 accepted messages per visitor and form, in 10 minutes |
| webhook delivery | up to 3 attempts, after 1 s and 5 s; 5 s to answer |
| the content API's `Cache-Control` | `s-maxage=300` (set your own with `cms.content.cacheControl`) |
| how deep a list pages | the offset stops at 10,000 items |
| the `cms:sitemap` hook | runs at most once a minute |
| the website search's query | the first 100 characters are read |

---

## The config API: `tinyzoo`

Import these in `cms.config.ts` and in code that uses the config's types. Anything exported from `tinyzoo` that is not named here is tagged `@internal` in its source. The server, the admin and the CLI share it through the same entry point.

### Definitions

| Export | What it is |
|---|---|
| `defineEntity(name, def)` | a collection: fields, admin, access, content API, publishing. Returns an `Entity` whose fields are typed end to end |
| `defineSingleton(name, def)` | a global with one record (site settings, a home page) |
| `defineBlock(def)` | one type of block for `f.blocks()`: label, fields, `version` and `upgrade` |
| `defineLocales(def)` | the content languages: default, list, labels, address prefix |
| `defineAdminMenu(menu)` | the admin's menu: the rows beside Home, the groups and their order, what sits behind "Settings", the order of the forms ([the menu](guide/admin.md#the-menu)) |
| `defineRoles(roles)` | the site's own roles, each extending `editor` or `author`: per-collection operations, `publish`, `media` ([roles](guide/roles.md)) |
| `definePages(opts)` | the ready-made pages collection (blocks, SEO, preview, optionally a tree) |
| `defineNavigation(opts)` | site menus as one global (`/api/content/_global/navigation`) |
| `defineRedirects(opts)` | the redirects collection |
| `seo(opts)` | `metaTitle`, `metaDescription` and `ogImage` fields to spread into an entity |
| `linkBlock()` | the block of one menu link (`defineNavigation` uses it) |
| `defineSeed(run)` | the site's demo content, for `tinyzoo seed` ([seeding](guide/seeding.md)) |
| `defineCmsPlugin(def)` | a plugin: collections, tables, admin pages, server routes, app plugins, home widgets, editor panels, hooks, upgrade steps ([plugins](plugins.md)) |
| `pluginFile(base, relative)` | the absolute path of a file next to a plugin's module, for its `serverHandlers` and `adminPages` |

A config exports its entities, globals, `locales`, `roles`, the pages, navigation and redirects presets, and `plugins`. The module finds them by what they are.

### Fields: `f`

`f` is the closed catalogue of field types. Each factory returns a `FieldDescriptor`. Row, Insert and Update types are inferred from them.

| Factory | Options | Row type |
|---|---|---|
| `f.text(o)` | `required`, `format: 'email' \| 'url' \| 'path' \| 'link'`, `multiline`, `max` | `string` |
| `f.slug(o)` | `from` (the field it follows), `unique` | `string` |
| `f.number(o)` | `int` (default true; `false` is a decimal), `min`, `max` | `number`, or `string` for a decimal (see below) |
| `f.boolean(o)` | `default`, `mustBeTrue`, `needsPrevious`, `confirmOff` | `boolean` |
| `f.datetime(o)` | `default: 'now'`, `allDay` | `Date` (a `Date` or an ISO string on insert) |
| `f.select(o)` | `options` (a tuple), `default`, `labels`, `icons`, `optionsBy` (`{ field, options }`: what the admin offers by another choice of the form), `swatches` (hex colours per option) | the union of the options |
| `f.richtext()` | | `RichTextDoc` |
| `f.blocks(blocks)` | an object of `defineBlock()`s | `BlocksValue` (typed, discriminated by `type`) |
| `f.list(o)` | `fields`, `max`, `itemLabel`, `itemType`, `version`, `upgrade` | `CmsListValue` (items with a stable `id`) |
| `f.group(o)` | `fields` | an object of the group's fields |
| `f.media(o)` | `accept` | `<key>Id: string` (a picture from the media library) |
| `f.file(o)` | `accept` (default `application/pdf`) | `<key>Id: string` |
| `f.gallery(o)` | `accept`, `max` | `CmsGalleryValue` |
| `f.color(o)` | `required` | `string` (`#rrggbb`) |
| `f.relation(o)` | `to` (a function returning the entity), `kind: 'many-to-one' \| 'one-to-many' \| 'many-to-many'`, `required`, `onDelete`, `inverseOf`, `through` | `<key>Id: string` for many-to-one; none for the other two |

**Decimals.** With `int: false` the column is `numeric`, so a select and the content API give a string such as `"19.99"`. An `Insert` or `Update` takes `number \| string`. Read the value with `Number(row.price)`.

Every `FieldDescriptor` has these methods. Each returns a descriptor of the same kind, except where the type changes:

| Method | Effect |
|---|---|
| `.optional()` | nullable in the database and the API, omittable on insert |
| `.unique()` | a unique index |
| `.localized()` | one value per content language (text, slug, rich text, blocks, group; needs `defineLocales`) |
| `.withDefault(value)` | a default, omittable on insert |
| `.label(text)`, `.help(text)` | the admin's label and help, a string or one per admin language (`LocalizedText`) |
| `.position('main' \| 'sidebar')` | where the writing editor puts it |
| `.icon(name)` | the icon of the control (any Iconify name) |
| `.group(label)` | a named, collapsible group in the editor |
| `.access({ read, edit })` | which roles read and which edit the field in the admin (`CmsFieldAccess`; role references from `defineRoles` or built-in names) |

A plugin or admin code may read these properties: `type`, `isRequired`, `isUnique`, `isOptional`, `isLocalized`, `default`, `ui`, `meta`, `relation`, `blocks`, `fields`.

The column description (`spec`, `dbDefault`) and `zod()` are internal.

### What an entity takes

`defineEntity(name, def)` with `def` an `EntityDef`:

| Option | What it does |
|---|---|
| `label`, `labelSingular`, `description`, `icon` | how the admin names it |
| `titleField` | the field that names an entry |
| `fields` | the `f.*` fields |
| `live` | every write is live at once (redirects) |
| `admin.list` | `columns`, `searchable`, `orderField` (arranged by dragging), `layout` (`CmsListLayout`) |
| `admin.editor` | `'write' \| 'form' \| 'preview'` (`CmsEditorLayout`) |
| `admin.preview`, `admin.tabs`, `admin.sections` | the preview address of a global, form tabs, form sections (`CmsFormSection`) |
| `access` | row-level rules per `read`, `create`, `update`, `delete`: a function of `{ user, table }` returning a drizzle condition; `user` is a `CmsAccessUser` |
| `content` | the public content API (`ContentConfig`): `public`, `published`, `slug`, `path`, `populate`, `hidden`, `search` |
| `publish` | the workflow (`PublishConfig`): `field`, `publishedValue`, `draftValue`, `dateField`, `schedule`, `preview`, `perLocale` (each language published on its own) |
| `tree` | entries under each other: `parent`, `order`, `maxDepth` (`TreeConfig`) |

`definePages`, `defineNavigation` and `defineRedirects` take `name`, `label`, `localized` and the like, as listed in their declarations (`api-tinyzoo.txt`).

### Names tinyzoo keeps

`defineEntity`, `defineSingleton` and `defineCmsPlugin` stop with an error on each of these.

**Field names** start with a letter, then letters, digits and `_`. Names that start with `_` are tinyzoo's: for future query parameters, keys on items and columns.

- Every entity: `id`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `parentId`, `locale`, `locales`, `path`, `paths`, `breadcrumbs` and `preview`.
- A public collection, also: `page`, `limit`, `sort`, `dir` and `q`. They are parameters of the list. A global has no list, so its fields may use these names.
- A translated field of an entity with `publish.perLocale`, also: `published`, `publishedAt` and `firstLiveAt`.

**Entity names** start with a letter, then letters, digits and `_`. These are taken: `media`, `graph`, `login`, `setup`, `forgot`, `reset`, `invite`, `team`, `account`, `p`, `email`, `privacy`, and any name that starts with `cms`, in any case (`cmsPage`, `CmsPage`).

**A plugin** names its entities like itself, or `<plugin>_…` ([plugins](plugins.md#entities)). A route it serves on the content API (`contentPath`) starts with `_<plugin>`. The forms plugin's `_form` is the one exception.

**The client.** The client's own methods never collide with a collection's name; see [the client](#the-client-tinyzooclient).

### Query helpers

`alias`, `and`, `asc`, `desc`, `eq`, `gt`, `gte`, `ilike`, `inArray`, `isNotNull`, `isNull`, `lt`, `lte`, `ne`, `not`, `notInArray`, `or` and `sql` are drizzle's own. They are re-exported for access rules and plugin routes.

**Drizzle's types follow drizzle-orm.** The names above and what they do are frozen. Their TypeScript types come from `drizzle-orm`, which is still 0.x. The same goes for the columns of an entity's [`table`](#types) and the `db` of [`useCms()`](#server-helpers-for-plugins). When tinyzoo moves to a new drizzle major (while drizzle is 0.x, a new minor), its changelog says so, with an **Upgrade** section for the code that has to change.

### Types

| Group | Exports |
|---|---|
| Data shapes | `Row`, `Insert`, `Update` (of an entity), `Entity`, `EntityDef`, `ContentConfig`, `PublishConfig`, `TreeConfig`, `CmsEditorLayout`, `CmsListLayout`, `CmsFormSection` |
| Fields | `FieldDescriptor`, `AnyFieldDescriptor`, `FieldKind`, `FieldUi`, `Nullable`, `Defaulted`, `OnDelete`, `RelationKind`, `RelationSpec` |
| Values | `RichTextDoc`, `CmsBlock`, `BlockDef`, `BlockValue`, `BlocksValue`, `GroupValue`, `CmsListValue`, `CmsGalleryValue` |
| Languages and text | `LocalesDef`, `LocalizedText`, `PathTemplate` |
| The admin's menu | `CmsAdminMenuInput` (what `defineAdminMenu` takes), `CmsAdminMenuDef` (what it returns), `CmsAdminMenuItem` (one row), `CmsAdminMenuBuiltin` (`'@forms'`, `'@media'`, `'@team'`, `'@privacy'`, `'@about'`) |
| Users and roles | `CmsAccessUser` (what an `access` rule is given: `id`, `email`, `name`, `role`, `base`, `locale`, and what an external sign-in adds as `unknown`), `CmsRole` (`'admin' \| 'editor' \| 'author'`), `CmsRoleBase`, `CmsRoleDef`, `CmsRoleRef`, `CmsRoleInput`, `CmsRoles`, `CmsEntityOp`, `CmsMediaAccess`, `CmsFieldAccess` |
| Seeds | `SeedDefinition`, `SeedContext`, `SeedEntry`, `SeedInsert`, `SeedWriteOptions`, `SeedGlobalOptions`, `SeedUploadOptions`, `SeedLink`, `SeedLinkOptions`, `SeedRich`, `SeedRichNode` |
| Plugins | `CmsPlugin`, `CmsPluginDef`, `CmsPluginHandler`, `CmsPluginAdminPage`, `CmsPluginNavItem`, `CmsPluginAppPlugin`, `CmsDashboardWidget`, `CmsEntityPanel`, `CmsPluginHooks`, `CmsPluginUpgradeStep`, `CmsFieldRenderer`, `CmsGraphExtension`, `CmsRetentionContext`, `CmsHttpMethod`, `CmsRouteAccess`, `CmsEntity`, `CmsRegistry`, `UpgradeStep`, `UpgradeContext`, `SqlRunner`, `StepOutcome` |
| Hooks and webhooks | `CmsChange`, `CmsChangeType`, `CmsSitemapEntry`, `CmsErrorReport`, `CmsWebhookPayload`, `CMS_WEBHOOK_HEADERS` |
| Site status | `CmsStatus`, `CmsStatusCollection`, `CmsStatusAnalytics`, `CmsStatusBrand`, `CmsStatusMemory` (the answer of `/api/health/status`) |
| Admin extension points | `CmsAdminField`, `CmsFieldEditProps`, `CmsFieldCellProps` |
| Admin branding (`cms.admin`) | `CmsAccent` (a built-in accent or a hex), `CmsAccentPreset` (`'mono' \| 'indigo' \| 'blue' \| 'violet' \| 'emerald'`), `CmsAdminLogo` (`full`, `mark`, `fullDark`, `markDark`) |
| Frontend kit | `CmsImageProps`, `CmsImageMedia`, `CmsBlocksProps`, `CmsBlockProps`, `CmsContentProps`, `CmsContentNode`, `CmsNavProps`, `CmsNavLink`, `CmsHighlightProps`, `CmsFormProps`, `CmsConsentProps`, `CmsConsentChoice`, `CmsConsentApi`, `CmsConsentTexts`, `CmsConsentCategory`, `CmsConsentService`, `CmsReadonlyRef`, `CmsSearchItem`, `CmsSearchResult` |

**`Entity` or `CmsEntity`?** They are two views of the same thing.

- `Entity<F>` is what `defineEntity`, `defineSingleton`, `defineForm` and the presets return, typed from its fields. Write this one in a site's code. The guides use it.
- `CmsEntity` is the same entity with its fields erased. It is what a plugin's hooks and routes receive, and what the registry lists. It appears only in the plugin documentation.

An `Entity` is assignable to a `CmsEntity`, not the other way round.

`CmsEntity` and `CmsRegistry` are what a plugin's hooks receive:

- the erased entity: its name, fields, `table`, `content`, `publish` and so on;
- the registry: `entities`, `byName`, `locales`, `plugins` and `pluginOf`.

**`table` is frozen for reading.** Access rules (`{ user, table }`), `content.published` and plugin queries use it. What is promised:

- one column per field, under the field's key in the config; a relation's column is `<field>Id`;
- tinyzoo's own columns `id`, `createdAt`, `updatedAt`, `createdBy` and `updatedBy`.

Use these with the [query helpers](#query-helpers) to read. What is not promised: the SQL names of the tables and columns, the translations' table, and writing to the table yourself. tinyzoo migrates those with an upgrade step.

The columns are drizzle's `PgColumn`s. Their names are frozen; their TypeScript types come from `drizzle-orm` and follow it ([query helpers](#query-helpers)).

`insertSchema` and `updateSchema` (zod) and the other generated pieces are internal. They follow zod's own versions.

---

## Forms: `tinyzoo/forms`

The forms plugin ([plugins](plugins.md#forms)).

| Export | What it is |
|---|---|
| `formsPlugin()` | the plugin to register: `export const plugins = [formsPlugin()]` |
| `defineForm(name, opts)` | a website form and its messages as a collection (`FormOptions`). It returns `Entity<F & { status: FormStatusField }>`, so `Row<typeof ContactForm>` has the form's typed fields and the state `status` (`'new' \| 'read' \| 'done'`) |
| `defineFormSettings(opts)` | the global that holds the recipients of the notifications |
| `FormOptions` | the options of `defineForm`: `label`, `fields`, `submitLabel`, `successMessage`, `notify`, `retentionDays`, `access` |
| `FormStatusField` | the type of the `status` field every form gets |

The plugin also brings:

- `<CmsForm name="…" />` ([the frontend kit](#the-frontend-kit)), with the props `name` and `locale`, the event `sent` and the slot `success`;
- `GET` / `POST /api/content/_form/:name`.

## Analytics: `tinyzoo/analytics`

The analytics plugin ([analytics](analytics.md)).

| Export | What it is |
|---|---|
| `analyticsPlugin(options)` | the plugin to register: `export const plugins = [analyticsPlugin()]` |
| `AnalyticsOptions` | its options: `mode`, `keepRawDays`, `access`, `respectDoNotTrack`, `excludePaths`, `countryHeaders`, `geoipFile`, `timeZone` |
| `AnalyticsMode` | `'cookieless'`, `'consent'` or `'strict'` ([cookie banner](analytics.md#cookie-banner)) |
| `dailyRollups(db, from, to, dimensions?)` | the daily totals of a range of days, as `DailyRollup` rows (`day`, `dimension`, `value`, `visitors`, `visits`, `pageviews`, `bounces`, `engagedMs`). Nothing in them identifies a visitor |
| `DailyRollup` | one of those rows |
| `AnalyticsRollups`, `AnalyticsRollupDay`, `AnalyticsRollupItem` | the answer of `GET /api/content/_analytics/rollups`, the daily totals for a fleet monitor: format `tinyzoo-analytics-rollups`, version 1, frozen like the status ([analytics](analytics.md#for-a-fleet-monitor)) |
| `AnalyticsLive`, `AnalyticsLiveTotals`, `AnalyticsLiveHour` | the answer of `GET /api/content/_analytics/live`, today's visits so far for a fleet monitor: format `tinyzoo-analytics-live`, version 1, frozen like the status ([analytics](analytics.md#today-so-far)) |

The plugin also brings `POST /api/content/_analytics/e`, where the website's pages send their visits, `GET /api/content/_analytics/rollups`, where a fleet monitor reads the daily totals with the status token, and `GET /api/content/_analytics/live`, where it reads today's visits so far with the same token. Its tables (`analytics_events`, `analytics_daily`) are exported for the server's own code, but their columns are not frozen: a minor release may change them, with a migration.

## Cookie consent: `tinyzoo/consent`

The consent plugin ([consent](consent.md)).

| Export | What it is |
|---|---|
| `consentPlugin(options)` | the plugin to register: `export const plugins = [consentPlugin()]` |
| `ConsentOptions` | its options: `categories`, `services`, `cookieDays`, `keepLogDays`, `localized`, `access` |
| `ConsentCategoryDef` | a category of the site's own: `key`, `label`, `description` |
| `ConsentServiceDef` | a service behind a category, in `services`: `name`, `provider`, `purpose`, `cookies`, `duration`, `privacyUrl` |

The plugin also brings:

- `<CmsConsent />` and `useConsent()` ([the frontend kit](#the-frontend-kit));
- `GET /api/content/_consent/config` and `POST /api/content/_consent/choice`;
- the cookie `tz_consent` ([consent](consent.md#the-cookie)). Read the choice with `useConsent()`: the cookie's value starts with a format number of its own, and a minor release may add a new format.

Its table `consent_log` is exported for the server's own code; its columns are not frozen.

## The Nuxt layer and the `cms` options

| Entry | What it is |
|---|---|
| `tinyzoo/layer` | the Nuxt layer: `extends: ['tinyzoo/layer']` brings `/admin`, the `Cms*` components (registered globally), the server and its module |
| `tinyzoo/module` | the module (build-time wiring), registered by the layer; its options are the `cms` key of `nuxt.config` (`CmsModuleOptions`) |

`layer-config.json` lists what the layer sets: the admin's stylesheet, WebSocket support, the 14-day session (`runtimeConfig.session.maxAge`) and the admin's fonts.

### `cms` in `nuxt.config.ts`

Every option reaches the runtime config as `cms.<option>`. Every runtime value can be set from the environment without a rebuild: `cms.storage.s3.bucket` is `NUXT_CMS_STORAGE_S3_BUCKET`. The defaults are in `module-options.json`.

| Option | Env | What it is |
|---|---|---|
| `config` | | path of the config, relative to the site (`cms.config.ts`; build time) |
| `migrations.dir`, `migrations.onStart` | `NUXT_CMS_MIGRATIONS_ON_START` | the migrations bundled into the build; apply them when the server starts |
| `redirectHosts` | `NUXT_CMS_REDIRECT_HOSTS` | host names the site used to be reached at: a page asked for on one of them is redirected (301) to `publicUrl`; the API still answers there |
| `publicUrl` | `NUXT_CMS_PUBLIC_URL` | the public address of the site (links and the logo in emails, the sitemap, and the OpenAPI server address unless `content.publicUrl` says otherwise) |
| `auth.mode`, `auth.trustedProxies`, `auth.ipHeader` | `NUXT_CMS_AUTH_MODE`, `NUXT_CMS_AUTH_TRUSTED_PROXIES`, `NUXT_CMS_AUTH_IP_HEADER` | `builtin` or `external` sign-in; proxies in front of the app; the client-IP header |
| | `NUXT_CMS_AUTH_SETUP_TOKEN` | the code first-run setup asks for. It is an environment variable only, on purpose: it is a secret, and an option would write it into the build and into `nuxt.config.ts`, which is committed |
| `auth.account.issuer`, `auth.account.clientId`, `auth.account.clientSecret` | `NUXT_CMS_AUTH_ACCOUNT_ISSUER`, `NUXT_CMS_AUTH_ACCOUNT_CLIENT_ID`, `NUXT_CMS_AUTH_ACCOUNT_CLIENT_SECRET` | experimental, may change in a minor: sign-in with the tinyzoo account next to the password ([guide](guide/admin.md#signing-in-with-the-tinyzoo-account-experimental)). The account service's address and the client id and secret it gave this site; on only when all three are set. Set the secret in the environment |
| `mail.transport`, `mail.from`, `mail.smtp.*`, `mail.file.dir` | `NUXT_CMS_MAIL_TRANSPORT`, `NUXT_CMS_MAIL_FROM`, `NUXT_CMS_MAIL_SMTP_HOST`, `NUXT_CMS_MAIL_SMTP_PORT`, `NUXT_CMS_MAIL_SMTP_SECURE`, `NUXT_CMS_MAIL_SMTP_USER`, `NUXT_CMS_MAIL_SMTP_PASS`, `NUXT_CMS_MAIL_FILE_DIR` | `log`, `file` or `smtp` |
| `storage.driver`, `storage.local.dir`, `storage.local.publicBase` | `NUXT_CMS_STORAGE_DRIVER`, `NUXT_CMS_STORAGE_LOCAL_DIR`, `NUXT_CMS_STORAGE_LOCAL_PUBLIC_BASE` | `local`, `s3` or `r2`; the local upload folder |
| `storage.s3.endpoint`, `.region`, `.bucket`, `.accessKeyId`, `.secretAccessKey`, `.publicBaseUrl`, `.delivery`, `.prefix` | `NUXT_CMS_STORAGE_S3_ENDPOINT`, `NUXT_CMS_STORAGE_S3_REGION`, `NUXT_CMS_STORAGE_S3_BUCKET`, `NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID`, `NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY`, `NUXT_CMS_STORAGE_S3_PUBLIC_BASE_URL`, `NUXT_CMS_STORAGE_S3_DELIVERY`, `NUXT_CMS_STORAGE_S3_PREFIX` | the S3-compatible store; `delivery` is `public`, `proxy` or `redirect`; `prefix` is the site's own place in a shared bucket (objects are `<prefix>/<key>`; the keys in the database do not change) |
| `storage.maxSizeMb`, `storage.maxBytes`, `storage.maxBytesPerUser`, `storage.uploadRatePerMin` | `NUXT_CMS_STORAGE_MAX_SIZE_MB`, `NUXT_CMS_STORAGE_MAX_BYTES`, `NUXT_CMS_STORAGE_MAX_BYTES_PER_USER`, `NUXT_CMS_STORAGE_UPLOAD_RATE_PER_MIN` | upload limits: the largest file, how much the whole site may store (0 = no limit; sizes of the media files, not their smaller copies), a quota per person, uploads per minute |
| `redis.url`, `redis.prefix` | `NUXT_CMS_REDIS_URL`, `NUXT_CMS_REDIS_PREFIX` | state shared by several instances (`REDIS_URL` too) |
| `scheduler.cron` | | how often scheduled entries are checked, as a cron expression. Build time (see below) |
| `retention.cron` | | when the daily retention task runs, as a cron expression (default `17 3 * * *`). Build time (see below) |
| `retention.auditDays` | `NUXT_CMS_RETENTION_AUDIT_DAYS` | how long audit entries are kept |
| `revisions.keep` | `NUXT_CMS_REVISIONS_KEEP` | versions kept per entry and language (0 = off) |
| `webhooks.urls`, `webhooks.secret` | `NUXT_CMS_WEBHOOKS_URLS`, `NUXT_CMS_WEBHOOKS_SECRET` | [the webhook](#the-webhook) |
| `sitemap.paths` | `NUXT_CMS_SITEMAP_PATHS` | addresses that are not entries but belong in `/sitemap.xml` |
| `forms.notifyTo`, `forms.turnstileSecret`, `forms.turnstileSiteKey` | `NUXT_CMS_FORMS_NOTIFY_TO`, `NUXT_CMS_FORMS_TURNSTILE_SECRET`, `NUXT_PUBLIC_CMS_TURNSTILE_SITE_KEY` | the forms plugin's recipients and Turnstile. `notifyTo` is an address or a list, and the variable is one comma-separated string |
| `demo.email`, `demo.password` | `NUXT_PUBLIC_CMS_DEMO_EMAIL`, `NUXT_PUBLIC_CMS_DEMO_PASSWORD` | a public demo admin |
| `status.token` | `NUXT_CMS_STATUS_TOKEN` | turns on `/api/health/status` and is the token it asks for |
| `mcp.enabled` (or `mcp: false`) | `NUXT_CMS_MCP_ENABLED` | the MCP server at `/api/mcp` and the access tokens (on by default) |
| `images.static` | | copies of the pictures in `public/` made at build, and tinyzoo's provider as `@nuxt/image`'s default (on by default; [Pictures in public/](guide/media.md#pictures-in-public-for-nuxtimage)). Build time |
| `content.token`, `content.cacheControl`, `content.publicUrl`, `content.docs` | `NUXT_CMS_CONTENT_TOKEN`, `NUXT_CMS_CONTENT_CACHE_CONTROL`, `NUXT_CMS_CONTENT_PUBLIC_URL`, `NUXT_CMS_CONTENT_DOCS` | the content API: a token, the cache header, the OpenAPI server address (`publicUrl` when empty), the interactive reference |

**Build-time options.** `scheduler.cron`, `retention.cron` and `images.static` are written into the build. They have no `NUXT_CMS_*` variable, and a change needs a rebuild.

## Environment variables

The `NUXT_CMS_*` and `NUXT_PUBLIC_CMS_*` variables above, and:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | the Postgres connection (`NUXT_CMS_DATABASE_URL` wins). The server does not start without one |
| `NUXT_APP_SECRET` | Nuxt's app secret, at least 32 characters. The sign-in cookie is sealed with a key derived from it (see below) |
| `REDIS_URL` | Redis, when `NUXT_CMS_REDIS_URL` is not set |
| `NUXT_SITE_URL`, `NUXT_SITE_INDEXABLE` | Nuxt SEO's site configuration (the sitemap's address; keeping a copy out of search engines) |
| `NUXT_SESSION_MAX_AGE` | the admin session's lifetime in seconds (default 14 days) |
| `CMS_ALLOW_REQUEST_ORIGIN` | `1` lets the admin write links in emails (invites, password resets) from the address of the request. It applies when `cms.publicUrl` is not set, in production too (see below) |
| `TINYZOO_DEPRECATIONS` | `1` prints deprecation warnings under `NODE_ENV=test`, `0` silences them |
| `TINYZOO_PG_DUMP`, `TINYZOO_PG_RESTORE`, `TINYZOO_PSQL` | the `pg_dump`, `pg_restore` and `psql` that `tinyzoo backup` and `restore` run |
| `SEED_URL`, `SEED_EMAIL`, `SEED_PASSWORD`, `SEED_NAME`, `SEED_SETUP_CODE` | the defaults of `tinyzoo seed`'s flags |

Not part of the surface: the test-only `CMS_TEST_*` variables.

### Details

**`NUXT_APP_SECRET`**

- The server does not start without it, nor with the example value of the starter's `.env.example`.
- `NUXT_SESSION_PASSWORD` is not read (removed in 0.6). When only it is set, the message says to rename it.

**`CMS_ALLOW_REQUEST_ORIGIN`**

- Keep it out of any site that has a public address. The request's `Host` is chosen by whoever makes it, so a forged one would put an attacker's domain in a reset link.
- It is read when the link is written, not at build time.
- It stays an environment variable under this name, on purpose. It is an escape hatch for a deploy without a public address, such as an internal tool behind a trusted proxy. It is not a setting, so it is not a `cms` option and not a `NUXT_CMS_*` variable, which would suggest a normal choice.

---

## The content API (HTTP)

The content API is public and read-only. It is the only HTTP API a site's frontend is promised ([guide](guide/content-api.md)). Its OpenAPI document is `/api/openapi.json`, and the routes are in `content-routes.txt`.

| Route | What it returns |
|---|---|
| `GET /api/content/:entity` | the published items of a collection: `{ items, total, page, limit }`. Query: `page`, `limit` (at most 100), `sort`, `dir` (`asc` \| `desc`), `q` (title search), `locale`, `<field>=` (exact), `<dateField>.from=` and `.to=` |
| `GET /api/content/:entity/:slug` | one published item by slug (or id): `{ item }`; `404` for a draft. In a page tree the address, from the top down |
| `GET /api/content/_tree/:entity` | a page tree's published pages, nested, for navigation: `{ items }` |
| `GET /api/content/_global/:name` | a global: `{ item }` (`null` before its first save) |
| `GET /api/content/_search` | the website search: `?q=`, `?locale=`, `?limit=` (1 to 50), `?entity=a,b` |
| `GET /api/content/_sitemap` | the site's public addresses as `{ entries }` (`CmsSitemapEntry`) |
| `GET`, `POST /api/content/_form/:name` | a website form's definition and its submission (`tinyzoo/forms`) |
| `POST /api/content/_analytics/e` | a page view, or the time one was looked at, from the website's pages (`tinyzoo/analytics`). Always `202` with no body |
| `GET /api/content/_analytics/rollups` | the daily totals of `?from=` to `?to=` (at most 400 days) for a tool that watches many sites (`AnalyticsRollups`, `tinyzoo/analytics`). Guarded like `/api/health/status`: `404` until `cms.status.token` is set, then that token. See [analytics](analytics.md#for-a-fleet-monitor) |
| `GET /api/content/_analytics/live` | today's visits so far for the same tool: who is on the site now (the last five minutes), today's totals, hours and top lists, and yesterday up to the same time (`AnalyticsLive`, `tinyzoo/analytics`). Guarded like the rollups. See [analytics](analytics.md#today-so-far) |
| `GET /api/content/_consent/config` | the cookie banner's texts and categories (each with its services and cookies) in a language (`?locale=`), the version of the texts and `cookieDays` (`tinyzoo/consent`) |
| `POST /api/content/_consent/choice` | a visitor's choice (`{ id?, choice, version }`): logged, and the cookie `tz_consent` set. `{ id, action, version, cookie }` (`tinyzoo/consent`) |
| `GET /api/openapi.json` | the OpenAPI 3.1 document of all of the above |
| `GET /api/openapi` | the interactive reference (off in production unless `cms.content.docs`) |
| `GET /api/content-types.ts` | the generated client types (what `tinyzoo client` writes) |
| `GET /api/health/live`, `GET /api/health/ready` | liveness and readiness (`{ ok }`, `503` when not) |
| `GET /api/health/status` | a summary of the site for a tool that watches many sites (`CmsStatus`). `404` until `cms.status.token` is set; then it asks for that token (`x-api-key` or `Authorization: Bearer`). See [deploying](deploying.md#site-status) |
| `GET /api/health/sites` | **experimental**, multi-tenant mode only: every site of the process as the process sees it, for whoever runs the service. `404` unless `NUXT_CMS_TENANCY_OPERATOR_TOKEN` is set; then it asks for that token (`Authorization: Bearer`). Not part of what 1.0 freezes: it may change with the mode |
| `POST /api/mcp` | the MCP server: tools that read and edit the content, for a person's access token (`Authorization: Bearer tzp_…`, made by hand or by signing in). Built-in sign-in only; `404` with `cms.mcp: false`. Tools and their names are kept within 1.x; a minor may add tools and keys. See [the MCP server](guide/mcp.md) |
| `GET /.well-known/oauth-protected-resource`, `GET /.well-known/oauth-authorization-server` (each also with `/api/mcp` after it) | the MCP server's OAuth discovery documents (RFC 9728, RFC 8414) |
| `POST /api/mcp/oauth/register`, `GET /api/mcp/oauth/authorize`, `POST /api/mcp/oauth/token`, `POST /api/mcp/oauth/revoke` | signing in to the MCP server: registration (RFC 7591), the authorization code flow with PKCE (S256), refresh, revocation (RFC 7009). See [signing in](guide/mcp.md#signing-in-oauth) |

When `cms.content.token` is set, requests carry the token as `x-api-key` or `Authorization: Bearer`.

The shape of each item follows from the config. `surface.openapi.json` and `surface.client-types.ts` show it for a config that uses every field.

Names of the form `/api/content/_x` belong to tinyzoo, which is why an entity name cannot start with `_` ([names tinyzoo keeps](#names-tinyzoo-keeps)).

### Errors

What is promised of an error: its **status code** and its **`message`**, a short text that says what went wrong.

- Decide on the status. Show or log the `message`.
- A form's `422` also has `data`: a list with one entry per refused field. Each entry has at least a `path`, which starts with the field's key, and a `message` in the visitor's language.
- The rest of the body (`statusMessage`, `error`, `url`, `stack` and the like) is the framework's, Nitro's. It may change with it.

### Media and logo addresses

These three live under `/api/cms`, but their addresses are stored in content or sent in emails. So they are frozen, like the content API:

| Route | What it serves |
|---|---|
| `GET /api/cms/_media/raw/<key>` | an uploaded file. A file's `url` in the content API and a picture in rich text point here (unless the bucket is public) |
| `GET /api/cms/_media/img/<id>/<width>.webp` | a smaller copy of a picture. `<width>` is 320, 480, 640, 750, 828, 960, 1080, 1280, 1440, 1920 or 2560; the list only grows |
| `GET /api/cms/_brand/<file>` | the logo's PNG versions (`full-email.png`, `mark-32.png`, `mark-180.png`, `mark-192.png`, `mark-512.png`) and `admin.webmanifest`. Emails already sent point here. The list only grows |

Everything else under `/api/cms/**` is internal.

### Rich text

A rich-text field comes as the editor's JSON: a ProseMirror document, `{ type: 'doc', content: [...] }`.

The node and mark names it uses today are frozen, with the attributes in brackets:

- nodes: `doc`, `paragraph`, `text`, `heading` (`level`), `bulletList`, `orderedList` (`start`), `listItem`, `blockquote`, `codeBlock` (`language`), `horizontalRule`, `hardBreak`, `image` (`src`, `alt`, `title`, `width`, `height`, `mediaId`);
- marks: `bold`, `italic`, `underline`, `strike`, `code`, `link` (`href`, `target`, `rel`, `class`, `title`).

A minor release may add a node or mark type. A renderer of your own must cope: draw an unknown node's children (or its text), or skip it; draw an unknown mark's text without it. `<CmsContent>` does that already.

A node or mark is renamed only in a major release.

### All-day dates

An all-day `f.datetime({ allDay: true })` is stored as midnight in `cms.admin.timeZone`. That is `Europe/Prague` unless the site sets another zone.

- The content API sends it as an ISO date-time in UTC: midnight in Prague is `2026-07-14T22:00:00.000Z` in summer.
- A frontend in another zone must format it in the admin's zone, or it shows the day before. For example `toLocaleDateString('cs', { timeZone: 'Europe/Prague' })`.
- The default zone stays `Europe/Prague` for all of 1.x.

## The client: `@tinyzoo/client`

A dependency-free, strictly typed client. The schema types come from the generated bindings (`tinyzoo client`).

| Export | What it is |
|---|---|
| `createCmsClient<Schema, Globals>(options)` | the untyped runtime: a client with no knowledge of a site, typed only as far as the schema it is given. It offers `cms.<collection>.list()`, `.get()`, `.tree()`, `cms.global()`, `cms.search()`, `cms.openapi()` and `cms.collection(name)` |
| `CmsError` | thrown for any non-2xx answer: `status`, `statusText`, `url`, `body` |
| `cmsMenuTree(links)` | nests a menu's links (`sub` goes under the link above) |
| `ClientOptions` | `baseUrl`, `token`, `headers`, `fetch` |
| `CmsClient`, `Collection`, `CollectionSpec`, `AnyContentSchema` | the client's type and what the generated schema must satisfy |
| `ListParams`, `ListResponse`, `GetOptions`, `TreeOptions`, `CmsTreeNode` | parameters and answers of list, get and tree |
| `SearchParams`, `SearchItem`, `SearchResponse` | the website search |
| `CmsMenuLink`, `CmsMenuItem` | a menu link and a top-level link with its dropdown |

The generated `cms-content.ts` exports `createClient(options)`, the item and filter types of every collection and
global, `ContentSchema` and `GlobalSchema`.

**`createClient` and `createCmsClient` are not two names for one thing.**

- `createClient` is generated for your site and typed: every collection, field, sort key and filter of the config. It is what a site calls. It is `createCmsClient<ContentSchema, GlobalSchema>` and nothing else.
- `createCmsClient` is the untyped runtime the package exports. Use it for tooling with no generated file, or for wrapping.

Neither has an alias: the package keeps its `Cms` prefix, and the generated file is the site's own. Both are frozen under their names ([the guide](guide/content-api.md#typed-clients--openapi)).

The types of the client keep the names they have (`CmsClient`, `CmsError` next to `ClientOptions`, `ListParams`, `Collection` and so on). There are no aliases, and what the generated file imports does not change.

**The client's own methods never collide with a collection's name.** The client's members are `collection`, `global`, `openapi` and `search`. Any member added after 1.0 starts with `$` (as in `cms.$health()`), which no collection name can. A collection named like one of the four is reached with `cms.collection('search')`.

## The webhook

Every change visible on the website is `POST`ed as JSON to `cms.webhooks.urls`. It is signed with `cms.webhooks.secret`, and nothing is sent unsigned in production.

The body is `CmsWebhookPayload`: a `CmsChange` without `by`, plus `delivery`.

| Body key | |
|---|---|
| `delivery` | unique per change and the same on every retry: deduplicate on it |
| `type` | `entry.created`, `entry.updated`, `entry.deleted`, `entry.published`, `entry.unpublished`, `translation.updated`, `translation.deleted`, `global.updated` |
| `entity`, `id`, `locale` | what changed; `locale` is the language of a translation change, otherwise `null` |
| `public` | whether the change can be seen on the website |
| `paths` | the website addresses to purge, old and new |
| `globals` | public globals that read differently now (left out when none) |
| `moved` | addresses that changed with a write (a page tree), `[{ id, locale, from, to }]` (left out when none) |
| `version`, `at` | the entry's `updatedAt` after the change (`null` when deleted); when |

Headers (`CMS_WEBHOOK_HEADERS`):

- `x-cms-event`: the change type.
- `x-cms-delivery`: the delivery id again.
- `x-cms-signature`: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`.

The signature header is a list of `key=value` parts, split by commas. A minor release may send more than one `v1=`, or parts of a new kind. A receiver accepts the request when any `v1=` matches, and ignores parts it does not know ([the example](deploying.md#verifying-in-a-nuxt-site)).

Delivery makes up to three attempts, after 1 s and 5 s. A `4xx` other than `408` and `429` is final. The timing is [tuning](#numbers-promised-and-numbers-tuned). Details: [deploying](deploying.md#publish-webhooks).

## The Nitro hooks

Subscribe in a server plugin with `nitro.hooks.hook('cms:change', (change) => …)`. The types are in `nitro-hooks.d.ts`.

| Hook | Argument | When |
|---|---|---|
| `cms:change` | `CmsChange` | a content change was saved, on the instance that saved it |
| `cms:sitemap` | `CmsSitemapEntry[]` | the sitemap is being built: push the addresses that are not entries (at most once a minute, a [tuned](#numbers-promised-and-numbers-tuned) number) |
| `cms:error` | `CmsErrorReport` | a server error (a 5xx request, a failed task, a webhook that gave up), after the response |

## Server helpers for plugins

A plugin's server route (`serverHandlers`, [plugins](plugins.md#writing-a-handler)) can call these two without an import. `server-helpers.d.ts` holds their types.

| Helper | What is promised |
|---|---|
| `useCms()` | returns at least `{ db, reg }`. `db` is the site's drizzle database for Postgres, with the entities' tables in its schema. `reg` is the `CmsRegistry`: `entities`, `byName`, `locales`, `plugins` and `pluginOf`. More keys may be added in a minor release |
| `requireCmsUser(event)` | returns the signed-in person: `{ id, role, email?, name?, locale? }` (`CmsUser`). Throws 401 when nobody is signed in, and 403 (`data.code: 'role-removed'`) when the person's role is no longer in the config |

`db`'s whole API is drizzle's own, and its type comes from `drizzle-orm` and follows it ([query helpers](#query-helpers)). The driver under it is not promised. Today it is node-postgres, and `db.$client` is its `Pool`. Use drizzle's API, not `$client` ([platform and dependencies](stability.md#platform-and-dependencies)).

Every other helper of the server (`audit`, `parseOr422`, `rateLimit`, `clientIp`, `sendCmsMail` and the rest) is internal: a plugin can use it, but it can change in a minor release.

## External sign-in

With `cms.auth.mode: 'external'` (`NUXT_CMS_AUTH_MODE=external`), your app signs people in, not tinyzoo. What your app has to set is frozen.

- Set `event.context.cmsUser` on each request of a signed-in person, before tinyzoo's handlers run: in a server middleware. It matters for `/api/**` and `/admin`. Without it, the request is signed out.
- Its shape is `CmsUser`, the same that `requireCmsUser(event)` returns:

| Key | Type | What it is |
|---|---|---|
| `id` | `string`, required | who it is. Stored as `createdBy` and `updatedBy` when it is a UUID; another id leaves them empty |
| `role` | `string`, required | a built-in role or one from `defineRoles` ([external sign-in and roles](guide/roles.md#external-sign-in)) |
| `email` | `string`, optional | an `access` rule gets `''` when it is missing |
| `name` | `string`, optional | an `access` rule gets `''` when it is missing |
| `locale` | `string \| null`, optional | an `access` rule gets `null` when it is missing |

Anything else you put on it reaches an `access` rule's `user` as `unknown` (`CmsAccessUser`).

Shared editing needs the built-in sign-in, and is off with an external one.

### nuxt-auth-utils' `User` type

tinyzoo's module adds to nuxt-auth-utils' types (`declare module '#auth-utils'`, in `nitro-hooks.d.ts`):

- `User` gets `id`, `email`, `name`, `role` and `locale`. The built-in sign-in writes these five.
- `UserSession` gets a `cms` key, which is tinyzoo's own bookkeeping.

These are covered only as far as tinyzoo's own fields go. The five `User` fields keep their names and types in 1.x. `UserSession.cms` is internal: do not read or write it.

A site's own nuxt-auth-utils fields (a member's plan, an OAuth id) are its own. Declare them in your own `declare module '#auth-utils'`, next to tinyzoo's five, and do not give those five another type.

## The CLI

Run `tinyzoo <command>` from the root of the website. `tinyzoo help` prints the list below, and the golden file is `cli-usage.txt`.

| Command | Flags |
|---|---|
| `tinyzoo init <dir>` | `--languages <a,b>`, `--presets <a,b\|none>`, `--demo`, `--no-demo`, `--package-manager <pm>` |
| `tinyzoo generate` | `--allow-drop`, `--allow-risky` |
| `tinyzoo up` | |
| `tinyzoo status` | |
| `tinyzoo upgrade` | `--allow-drop`, `--allow-risky` |
| `tinyzoo client [out]` | `--stdout` |
| `tinyzoo openapi [out]` | `--stdout` |
| `tinyzoo content:migrate` | `--dry-run`, `--batch <n>` |
| `tinyzoo links:convert` | `--dry-run`, `--batch <n>` |
| `tinyzoo export <file.tar.gz>` | `--only a,b`, `--no-media`, `--with-revisions`, `--with-submissions`, `--force` |
| `tinyzoo import <file.tar.gz>` | `--replace`, `--merge`, `--allow-mismatch`, `--dry-run`, `--yes`, `--no-search-index` |
| `tinyzoo backup [file]` | |
| `tinyzoo restore <file>` | `--yes`, `--force` |
| `tinyzoo seed [file]` | `--url <url>`, `--email <email>`, `--name <name>`, `--setup-code <code>`, `--wait <sec>`, `--dry-run`, `--reset`, `--yes`, `--verbose` |

Exit codes:

- `0`: success.
- `1`: a failure, or, for `status`, something pending.
- `2`: for `status`, the database could not be read.

What the CLI prints is not covered: its wording can change in any release. A script reads the exit code.

## The admin's extension points

You can change how a field type looks in the admin without touching the package. Register the name of a global Vue component for a field type in `app.config.ts`, and ship the component ([guide](guide/admin.md#extensibility--the-field--view-registry)).

```ts
export default defineAppConfig({
  cms: { fields: { select: { edit: 'MySegmentedSelect' }, color: { edit: 'ColorPicker', cell: 'ColorSwatch' } } },
})
```

| Point | What is promised |
|---|---|
| `cms.fields[type].edit`, `.cell` | the registry: a field type (`text`, `slug`, `number`, `boolean`, `datetime`, `select`, `richtext`, `blocks`, `group`, `media`, `gallery`, `relation`) to a component name. A plugin's `fields` (`CmsFieldRenderer`) feed it, and the site's own entry wins. Components are resolved by name at run time, so they must be global (`components/global/`) |
| `CmsField`, `CmsCell` | the two dispatchers that resolve it: host entry, then a plugin's, then the field's own `ui` hint, then `CmsFieldText` / `CmsCellText` |
| The default components | `CmsFieldText`, `CmsFieldSlug`, `CmsFieldNumber`, `CmsFieldBoolean`, `CmsFieldDate`, `CmsFieldSelect`, `CmsFieldRichText`, `CmsFieldBlocks`, `CmsFieldGroup`, `CmsFieldMedia`, `CmsFieldGallery`, `CmsFieldColor`, `CmsFieldRelationOne`, `CmsFieldRelationMany`, and `CmsCellText`, `CmsCellCode`, `CmsCellNumber`, `CmsCellBoolean`, `CmsCellDate`, `CmsCellBadge`, `CmsCellExcerpt`, `CmsCellBlocks`, `CmsCellGroup`, `CmsCellThumb`, `CmsCellGallery`, `CmsCellColor`, `CmsCellRelation`. These names are what `field.ui` carries (`surface.admin-graph.json`), and you can use them as renderers by name |
| Props of an editor | `CmsFieldEditProps`: `field` (a `CmsAdminField`), `entity`, `id`, `readOnly` and `v-model`. Every renderer the registry resolves gets `readOnly`, built-in ones too. It means the person may see the value but not change it: their role may only read the field (`field.readOnly`), or the whole entry is read-only for them |
| Props of a cell | `CmsFieldCellProps`: `field`, `row`, `entity` |
| `cms.admin` | the admin's `name`, `siteUrl`, `accent` (`CmsAccent`: a built-in accent, `CmsAccentPreset`, or a hex), `logo` (`CmsAdminLogo`), `signature` (boolean, default `true`), `animals` (boolean, default `true`), `locales`, `defaultLocale` and `timeZone` ([the admin guide](guide/admin.md#what-you-can-brand)). The server resolves name, accent, logos, signature and animals into the theme the admin reads (`GET /api/cms/_theme`, internal) |

The rest of the admin (the other `Cms*` components, the pages, `/api/cms/**`) is internal.

## The frontend kit

These are the components and composables every website draws its content with ([guide](guide/content-api.md#the-frontend-kit)). They are frozen like the config API: a prop, a slot, an event or a returned key is added in a minor release, and removed or changed only in a major one.

Their props are the interfaces of `tinyzoo` named below. `frontend-kit.txt` holds each one's props, emits, slots and signature.

| Component | Props | Slots, events |
|---|---|---|
| `<CmsBlocks>` | `CmsBlocksProps`: `blocks` (a `f.blocks()` value, or `null`), `prefix` (default `'Block'`) | none. Draws each block with the site's global component named `<prefix><Type>` (`hero` → `<BlockHero>`), given `block` and `index` (`CmsBlockProps`); a block with no component is skipped |
| `<CmsImage>` | `CmsImageProps`: `media` (`CmsImageMedia`: `url`, `id`, `alt`, `width`, `height`, `mime`, `focal`; or `null`), `eager`, `sizes`, `alt` | none. Renders one `<img>` (nothing when there is no `media`) |
| `<CmsContent>` | `CmsContentProps`: `doc` (a rich-text value, or `null`) | none. Renders a `div.cms-content` with sanitised HTML |
| `<CmsNav>` | `CmsNavProps`: `links` (`CmsNavLink`: `id`, `label`, `url`, `newTab`, `sub`; or `null`) | none. Renders a `nav.cms-nav` with nested lists |
| `<CmsHighlight>` | `CmsHighlightProps`: `text`, `ranges` (`[start, end)` pairs, or `null`) | none. Renders a `span` with `<mark>` around each range |
| `<CmsForm>` (`tinyzoo/forms`) | `CmsFormProps`: `name`, `locale` | event `sent`; slot `success` (replaces the form after sending) |
| `<CmsConsent>` (`tinyzoo/consent`) | `CmsConsentProps`: `locale`, `unstyled` | slots `default`, `banner`, `actions`, `settings`, `category`, `settings-actions`, each given the whole `useConsent()` (`category` also `category`). The ready-made cookie banner and its settings dialog, built on `useConsent()`, themed with `--cms-consent-*` variables ([consent](consent.md#slots-of-cmsconsent)) |

| Composable | Takes | Returns |
|---|---|---|
| `useCmsSeo(item, options)` | an item or a getter of one, and `{ siteName, titleField, descriptionField, imageField, fallback, defaultLocale, path, ogLocales }` | `{ title, description, image, canonical }` (computed values); sets the page's head |
| `useCmsSearch(query, options)` | a query (ref or getter) and `{ locale, limit, entities }` | a promise of `{ items, total, searched, pending, error }`; `items` are `CmsSearchItem`s |
| `useCmsUiLocale()` | nothing | a computed locale for `<UApp :locale>`: Nuxt UI's words in the admin's language on `/admin` pages, `undefined` elsewhere |
| `useConsent()` (`tinyzoo/consent`) | nothing | `CmsConsentApi`: `{ choice, decided, ready, granted, onChange, bannerVisible, settingsOpen, open, close, texts, categories, draft, set, acceptAll, rejectAll, save, saving, error }` ([reference](consent.md#useconsent-reference)) |

Every other `Cms*` component and `useCms*` composable (`CmsPage`, `CmsField`, `CmsEmptyState`, `CmsStatusBadge`, `useCmsI18n` and so on) is the admin's own and internal. That includes the ones a plugin's admin page uses ([plugins](plugins.md#admin-pages-and-navigation)). They can change in any minor release.

## Deprecated

Nothing is deprecated right now. When something is, it is listed here with the release that removes it, and a warning at start or build says so (`cmsDeprecated`, [CONTRIBUTING.md](../CONTRIBUTING.md#deprecations)).

Removed from the public API in 1.0 ([upgrading](upgrading.md#from-07-to-10)):

| What | Use instead |
|---|---|
| `cms.databaseUrl` | `DATABASE_URL` or `NUXT_CMS_DATABASE_URL` in the environment |
| `FormOptions` imported from `tinyzoo` | `import type { FormOptions } from 'tinyzoo/forms'` |
| a field named `page`, `limit`, `sort`, `dir` or `q` in a public collection | another name (now an error) |
| `defineEntity(name, { singleton: true })` | `defineSingleton(name, { … })` |
| the variables `CMS_SCHEDULER_CRON` and `CMS_RETENTION_CRON` | the `cms.scheduler.cron` and `cms.retention.cron` options |
| the search helpers `searchTerms`, `matchEntry`, `highlightRanges`, `SEARCH_MAX_QUERY` and `SearchMatch` as public API | nothing: they are internal again since 1.0 (still exported from `tinyzoo`, but not covered). `useCmsSearch()` and `<CmsHighlight>` stay |

Removed in 0.6: `NUXT_SESSION_PASSWORD` as a stand-in for `NUXT_APP_SECRET`
([upgrading](upgrading.md#from-05-to-06)).
