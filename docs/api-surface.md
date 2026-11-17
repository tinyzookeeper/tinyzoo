# The public API

What tinyzoo promises not to break. From **1.0** everything on this page follows
[semantic versioning](https://semver.org): a breaking change waits for 2.0, and anything removed was
deprecated for at least one minor release first (how: [CONTRIBUTING.md](../CONTRIBUTING.md#deprecations)).
Until 1.0, a change to it is a minor release with an `### Upgrade` section in its changeset.

What is **not** on this page is internal and can change in any minor release, always with a changeset:
the other `Cms*` components, the server's own utilities, the admin's API (`/api/cms/**`), every export
tagged `@internal`, and the database tables (tinyzoo migrates them, with upgrade steps:
[upgrading.md](upgrading.md)). The names stay as they are: `cms.config.ts`, `NUXT_CMS_*`, `cms_*`,
`Cms*` and the `cms` key of `nuxt.config`.

| Frozen surface | Where |
|---|---|
| [The config API](#the-config-api-tinyzoo): `defineEntity`, `f.*`, blocks, presets, seeds, plugins | `tinyzoo`, [`tinyzoo/forms`](#forms-tinyzooforms) |
| [The Nuxt layer and its options](#the-nuxt-layer-and-the-cms-options) and [environment variables](#environment-variables) | `tinyzoo/layer`, `tinyzoo/module`, `nuxt.config`, `NUXT_CMS_*` |
| [The content API](#the-content-api-http) (HTTP) and [the client](#the-client-tinyzooclient) | `/api/content/*`, `@tinyzoo/client` |
| [The webhook](#the-webhook) and [the Nitro hooks](#the-nitro-hooks) | `cms:*` |
| [The CLI](#the-cli) | `tinyzoo <command>` |
| [The admin's extension points](#the-admins-extension-points) | `cms.fields` in `app.config.ts` |

## How it is guarded

Every surface above is written down as a golden file in `test/contracts/`; a test fails with the
lines that differ when the code no longer produces it, and `pnpm contracts:update` accepts the change.
The reviewer reads that diff, and the changeset says whether it **breaks sites**
([CONTRIBUTING.md](../CONTRIBUTING.md#contracts)).

| Golden file | What it holds |
|---|---|
| `api-tinyzoo.txt`, `api-tinyzoo-forms.txt`, `api-tinyzoo-module.txt`, `api-client.txt` | the exported declarations of each entry point (what is `@internal` is listed by name only) |
| `module-options.json` | the options of the `cms` key with their defaults, and the environment variables that follow |
| `nitro-hooks.d.ts` | the Nitro hooks with their argument types |
| `cli-usage.txt` | the commands and flags of `tinyzoo` |
| `webhook.json` | the headers and body of a publish webhook |
| `content-routes.txt` | the routes of the content API |
| `layer-config.json` | what `extends: ['tinyzoo/layer']` sets up |
| `openapi.playground.json`, `client-types.playground.ts` | the content API of the playground |
| `surface.client-types.ts`, `surface.openapi.json`, `surface.admin-graph.json` | the content API, client types and admin graph of `test/contracts/surface/cms.config.ts`, a config that uses every field and option |

`test/unit/surface-types.spec.ts` asserts the inferred `Row`, `Insert` and `Update` types and the client's
types of that same config, so a type regression fails `pnpm typecheck`. `test/unit/api-surface.spec.ts`
also checks that this page names every public export, command, flag, route, hook and variable.

---

## The config API: `tinyzoo`

Imported in `cms.config.ts` and in code that uses the config's types. Anything exported from `tinyzoo`
that is not named here is tagged `@internal` in its source (the server, the admin and the CLI share it
through the same entry point).

### Definitions

| Export | What it is |
|---|---|
| `defineEntity(name, def)` | a collection: fields, admin, access, content API, publishing. Returns an `Entity` whose fields are typed end to end |
| `defineSingleton(name, def)` | a global with one record (site settings, a home page) |
| `defineBlock(def)` | one type of block for `f.blocks()`: label, fields, `version` and `upgrade` |
| `defineLocales(def)` | the content languages: default, list, labels, address prefix |
| `definePages(opts)` | the ready-made pages collection (blocks, SEO, preview, optionally a tree) |
| `defineNavigation(opts)` | site menus as one global (`/api/content/_global/navigation`) |
| `defineRedirects(opts)` | the redirects collection |
| `seo(opts)` | `metaTitle`, `metaDescription` and `ogImage` fields to spread into an entity |
| `linkBlock()` | the block of one menu link (`defineNavigation` uses it) |
| `defineSeed(run)` | the site's demo content, for `tinyzoo seed` ([seeding](guide/seeding.md)) |
| `defineCmsPlugin(def)` | a plugin: collections, admin pages, server routes, hooks, upgrade steps ([plugins](plugins.md)) |
| `pluginFile(base, relative)` | the absolute path of a file next to a plugin's module, for its `serverHandlers` and `adminPages` |

A config exports its entities, globals, `locales`, the pages, navigation and redirects presets, and
`plugins`; the module finds them by what they are.

### Fields: `f`

`f` is the closed catalogue of field types. Each factory returns a `FieldDescriptor`; Row, Insert and Update
types are inferred from them.

| Factory | Options | Row type |
|---|---|---|
| `f.text(o)` | `required`, `format: 'email' \| 'url' \| 'path' \| 'link'`, `multiline`, `max` | `string` |
| `f.slug(o)` | `from` (the field it follows), `unique` | `string` |
| `f.number(o)` | `int` (default true; `false` is a decimal), `min`, `max` | `number` |
| `f.boolean(o)` | `default`, `mustBeTrue`, `needsPrevious` | `boolean` |
| `f.datetime(o)` | `default: 'now'`, `allDay` | `Date` (a `Date` or an ISO string on insert) |
| `f.select(o)` | `options` (a tuple), `default`, `labels`, `icons` | the union of the options |
| `f.richtext()` | | `RichTextDoc` |
| `f.blocks(blocks)` | an object of `defineBlock()`s | `BlocksValue` (typed, discriminated by `type`) |
| `f.list(o)` | `fields`, `max`, `itemLabel`, `itemType`, `version`, `upgrade` | `CmsListValue` (items with a stable `id`) |
| `f.group(o)` | `fields` | an object of the group's fields |
| `f.media(o)` | `accept` | `<key>Id: string` (a picture from the media library) |
| `f.file(o)` | `accept` (default `application/pdf`) | `<key>Id: string` |
| `f.gallery(o)` | `accept`, `max` | `CmsGalleryValue` |
| `f.color(o)` | `required` | `string` (`#rrggbb`) |
| `f.relation(o)` | `to` (a function returning the entity), `kind: 'many-to-one' \| 'one-to-many' \| 'many-to-many'`, `required`, `onDelete`, `inverseOf`, `through` | `<key>Id: string` for many-to-one; none for the other two |

Methods of every `FieldDescriptor`, each returning a descriptor of the same kind (except where the type changes):

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

Properties a plugin or admin code may read: `type`, `isRequired`, `isUnique`, `isOptional`, `isLocalized`,
`default`, `ui`, `meta`, `relation`, `blocks`, `fields`. The column description (`spec`, `dbDefault`) and
`zod()` are internal.

### What an entity takes

`defineEntity(name, def)` with `def` an `EntityDef`:

| Option | What it does |
|---|---|
| `label`, `labelSingular`, `description`, `icon` | how the admin names it |
| `titleField` | the field that names an entry |
| `fields` | the `f.*` fields |
| `singleton`, `live` | one record only; every write is live at once (redirects) |
| `admin.list` | `columns`, `searchable`, `orderField` (arranged by dragging), `layout` (`CmsListLayout`) |
| `admin.editor` | `'write' \| 'form' \| 'preview'` (`CmsEditorLayout`) |
| `admin.preview`, `admin.tabs`, `admin.sections` | the preview address of a global, form tabs, form sections (`CmsFormSection`) |
| `access` | row-level rules per `read`, `create`, `update`, `delete`: a function of `{ user, table }` returning a drizzle condition |
| `content` | the public content API (`ContentConfig`): `public`, `published`, `slug`, `path`, `populate`, `hidden`, `search` |
| `publish` | the workflow (`PublishConfig`): `field`, `publishedValue`, `draftValue`, `dateField`, `schedule`, `preview` |
| `tree` | entries under each other: `parent`, `order`, `maxDepth` (`TreeConfig`) |

`definePages`, `defineNavigation` and `defineRedirects` take `name`, `label`, `localized` and the like as
listed in their declarations (`api-tinyzoo.txt`). A field of a public collection should not be named
`page`, `limit`, `sort`, `dir` or `q`: they are parameters of the list (a deprecation warning says so;
from 1.0 it is an error).

### Query helpers

`alias`, `and`, `asc`, `desc`, `eq`, `gt`, `gte`, `ilike`, `inArray`, `isNotNull`, `isNull`, `lt`, `lte`,
`ne`, `not`, `notInArray`, `or` and `sql` are drizzle's own, re-exported for access rules and plugin
routes. Their types belong to `drizzle-orm`.

### Types

| Group | Exports |
|---|---|
| Data shapes | `Row`, `Insert`, `Update` (of an entity), `Entity`, `EntityDef`, `ContentConfig`, `PublishConfig`, `TreeConfig`, `CmsEditorLayout`, `CmsListLayout`, `CmsFormSection` |
| Fields | `FieldDescriptor`, `AnyFieldDescriptor`, `FieldKind`, `FieldUi`, `Nullable`, `Defaulted`, `OnDelete`, `RelationKind`, `RelationSpec` |
| Values | `RichTextDoc`, `CmsBlock`, `BlockDef`, `BlockValue`, `BlocksValue`, `GroupValue`, `CmsListValue`, `CmsGalleryValue` |
| Languages and text | `LocalesDef`, `LocalizedText`, `PathTemplate` |
| Users | `CmsRole` (`'admin' \| 'editor' \| 'author'`) |
| Seeds | `SeedDefinition`, `SeedContext`, `SeedEntry`, `SeedInsert`, `SeedWriteOptions`, `SeedGlobalOptions`, `SeedUploadOptions`, `SeedLink`, `SeedLinkOptions`, `SeedRich`, `SeedRichNode` |
| Plugins | `CmsPlugin`, `CmsPluginDef`, `CmsPluginHandler`, `CmsPluginAdminPage`, `CmsPluginNavItem`, `CmsPluginHooks`, `CmsPluginUpgradeStep`, `CmsFieldRenderer`, `CmsGraphExtension`, `CmsRetentionContext`, `CmsHttpMethod`, `CmsRouteAccess`, `CmsEntity`, `CmsRegistry`, `UpgradeStep`, `UpgradeContext`, `SqlRunner`, `StepOutcome` |
| Hooks and webhooks | `CmsChange`, `CmsChangeType`, `CmsSitemapEntry`, `CmsErrorReport`, `CmsWebhookPayload`, `CMS_WEBHOOK_HEADERS` |
| Admin extension points | `CmsAdminField`, `CmsFieldEditProps`, `CmsFieldCellProps` |

`CmsEntity` and `CmsRegistry` are what a plugin's hooks receive: the erased entity (its name, fields,
`table`, `content`, `publish`…) and the registry (`entities`, `byName`, `locales`, `plugins`, `pluginOf`);
the tables and generated pieces on them are internal. `FormOptions` is exported from `tinyzoo` for now,
deprecated: import it from `tinyzoo/forms`.

---

## Forms: `tinyzoo/forms`

The forms plugin ([plugins](plugins.md#forms)).

| Export | What it is |
|---|---|
| `formsPlugin()` | the plugin to register: `export const plugins = [formsPlugin()]` |
| `defineForm(name, opts)` | a website form and its messages as a collection (`FormOptions`) |
| `defineFormSettings(opts)` | the global that holds the recipients of the notifications |
| `FormOptions` | the options of `defineForm`: `label`, `fields`, `submitLabel`, `successMessage`, `notify`, `retentionDays`, `access` |

It also brings `<CmsForm name="…" />` (props `name`, `locale`; event `sent`) and `GET` / `POST /api/content/_form/:name`.

## The Nuxt layer and the `cms` options

| Entry | What it is |
|---|---|
| `tinyzoo/layer` | the Nuxt layer: `extends: ['tinyzoo/layer']` brings `/admin`, the `Cms*` components (registered globally), the server and its module |
| `tinyzoo/module` | the module (build-time wiring), registered by the layer; its options are the `cms` key of `nuxt.config` (`CmsModuleOptions`) |

`layer-config.json` lists what the layer sets (the admin's stylesheet, WebSocket support, the 14-day session
`runtimeConfig.session.maxAge`, the admin's fonts).

### `cms` in `nuxt.config.ts`

Every option reaches the runtime config as `cms.<option>`, and **every runtime value can be set from the
environment** without a rebuild: `cms.storage.s3.bucket` is `NUXT_CMS_STORAGE_S3_BUCKET`. The defaults are in
`module-options.json`.

| Option | Env | What it is |
|---|---|---|
| `config` | | path of the config, relative to the site (`cms.config.ts`; build time) |
| `databaseUrl` | `NUXT_CMS_DATABASE_URL` | deprecated: set `DATABASE_URL` or `NUXT_CMS_DATABASE_URL` in the environment instead |
| `migrations.dir`, `migrations.onStart` | `NUXT_CMS_MIGRATIONS_ON_START` | the migrations bundled into the build; apply them when the server starts |
| `publicUrl` | `NUXT_CMS_PUBLIC_URL` | the public address of the site (links in emails, the sitemap) |
| `auth.mode`, `auth.trustedProxies`, `auth.ipHeader` | `NUXT_CMS_AUTH_MODE`, `NUXT_CMS_AUTH_TRUSTED_PROXIES`, `NUXT_CMS_AUTH_IP_HEADER` | `builtin` or `external` sign-in; proxies in front of the app; the client-IP header |
| | `NUXT_CMS_AUTH_SETUP_TOKEN` | the code first-run setup asks for (an environment variable only) |
| `mail.transport`, `mail.from`, `mail.smtp.*`, `mail.file.dir` | `NUXT_CMS_MAIL_TRANSPORT`, `NUXT_CMS_MAIL_FROM`, `NUXT_CMS_MAIL_SMTP_HOST`, `NUXT_CMS_MAIL_SMTP_PORT`, `NUXT_CMS_MAIL_SMTP_SECURE`, `NUXT_CMS_MAIL_SMTP_USER`, `NUXT_CMS_MAIL_SMTP_PASS`, `NUXT_CMS_MAIL_FILE_DIR` | `log`, `file` or `smtp` |
| `storage.driver`, `storage.local.dir`, `storage.local.publicBase` | `NUXT_CMS_STORAGE_DRIVER`, `NUXT_CMS_STORAGE_LOCAL_DIR`, `NUXT_CMS_STORAGE_LOCAL_PUBLIC_BASE` | `local`, `s3` or `r2`; the local upload folder |
| `storage.s3.endpoint`, `.region`, `.bucket`, `.accessKeyId`, `.secretAccessKey`, `.publicBaseUrl`, `.delivery` | `NUXT_CMS_STORAGE_S3_ENDPOINT`, `NUXT_CMS_STORAGE_S3_REGION`, `NUXT_CMS_STORAGE_S3_BUCKET`, `NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID`, `NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY`, `NUXT_CMS_STORAGE_S3_PUBLIC_BASE_URL`, `NUXT_CMS_STORAGE_S3_DELIVERY` | the S3-compatible store; `delivery` is `public`, `proxy` or `redirect` |
| `storage.maxSizeMb`, `storage.maxBytesPerUser`, `storage.uploadRatePerMin` | `NUXT_CMS_STORAGE_MAX_SIZE_MB`, `NUXT_CMS_STORAGE_MAX_BYTES_PER_USER`, `NUXT_CMS_STORAGE_UPLOAD_RATE_PER_MIN` | upload limits |
| `redis.url`, `redis.prefix` | `NUXT_CMS_REDIS_URL`, `NUXT_CMS_REDIS_PREFIX` | state shared by several instances (`REDIS_URL` too) |
| `scheduler.cron` | `CMS_SCHEDULER_CRON` (build time) | how often scheduled entries are checked |
| `retention.auditDays` | `NUXT_CMS_RETENTION_AUDIT_DAYS` | how long audit entries are kept |
| `revisions.keep` | `NUXT_CMS_REVISIONS_KEEP` | versions kept per entry and language (0 = off) |
| `webhooks.urls`, `webhooks.secret` | `NUXT_CMS_WEBHOOKS_URLS`, `NUXT_CMS_WEBHOOKS_SECRET` | [the webhook](#the-webhook) |
| `sitemap.paths` | `NUXT_CMS_SITEMAP_PATHS` | addresses that are not entries but belong in `/sitemap.xml` |
| `forms.notifyTo`, `forms.turnstileSecret`, `forms.turnstileSiteKey` | `NUXT_CMS_FORMS_NOTIFY_TO`, `NUXT_CMS_FORMS_TURNSTILE_SECRET`, `NUXT_PUBLIC_CMS_TURNSTILE_SITE_KEY` | the forms plugin's recipients and Turnstile |
| `demo.email`, `demo.password` | `NUXT_PUBLIC_CMS_DEMO_EMAIL`, `NUXT_PUBLIC_CMS_DEMO_PASSWORD` | a public demo admin |
| `content.token`, `content.cacheControl`, `content.publicUrl`, `content.docs` | `NUXT_CMS_CONTENT_TOKEN`, `NUXT_CMS_CONTENT_CACHE_CONTROL`, `NUXT_CMS_CONTENT_PUBLIC_URL`, `NUXT_CMS_CONTENT_DOCS` | the content API: a token, the cache header, the OpenAPI server address, the interactive reference |

## Environment variables

The `NUXT_CMS_*` and `NUXT_PUBLIC_CMS_*` variables above, and:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | the Postgres connection (`NUXT_CMS_DATABASE_URL` wins). The server does not start without one |
| `NUXT_APP_SECRET` | Nuxt's app secret, at least 32 characters: the sign-in cookie is sealed with a key derived from it. The server does not start without it. `NUXT_SESSION_PASSWORD` is **not read** (removed in 0.6): when only it is set, the message says to rename it |
| `REDIS_URL` | Redis, when `NUXT_CMS_REDIS_URL` is not set |
| `NUXT_SITE_URL`, `NUXT_SITE_INDEXABLE` | Nuxt SEO's site configuration (the sitemap's address; keeping a copy out of search engines) |
| `NUXT_SESSION_MAX_AGE` | the admin session's lifetime in seconds (default 14 days) |
| `CMS_SCHEDULER_CRON`, `CMS_RETENTION_CRON` | build-time cron expressions of the scheduled tasks |
| `TINYZOO_DEPRECATIONS` | `1` prints deprecation warnings under `NODE_ENV=test`, `0` silences them |
| `TINYZOO_PG_DUMP`, `TINYZOO_PG_RESTORE`, `TINYZOO_PSQL` | the `pg_dump`, `pg_restore` and `psql` that `tinyzoo backup` and `restore` run |
| `SEED_URL`, `SEED_EMAIL`, `SEED_PASSWORD`, `SEED_NAME`, `SEED_SETUP_CODE` | the defaults of `tinyzoo seed`'s flags |

Not part of the surface: the test-only `CMS_TEST_*` variables and `CMS_ALLOW_REQUEST_ORIGIN`.

---

## The content API (HTTP)

Public, read-only, and the only HTTP API a site's frontend is promised ([guide](guide/content-api.md);
its OpenAPI document is `/api/openapi.json`). The routes are in `content-routes.txt`:

| Route | What it returns |
|---|---|
| `GET /api/content/:entity` | the published items of a collection: `{ items, total, page, limit }`. Query: `page`, `limit` (at most 100), `sort`, `dir` (`asc` \| `desc`), `q` (title search), `locale`, `<field>=` (exact), `<dateField>.from=` and `.to=` |
| `GET /api/content/:entity/:slug` | one published item by slug (or id): `{ item }`; `404` for a draft. In a page tree the address, from the top down |
| `GET /api/content/_tree/:entity` | a page tree's published pages, nested, for navigation: `{ items }` |
| `GET /api/content/_global/:name` | a global: `{ item }` (`null` before its first save) |
| `GET /api/content/_search` | the website search: `?q=`, `?locale=`, `?limit=` (1 to 50), `?entity=a,b` |
| `GET /api/content/_sitemap` | the site's public addresses as `{ entries }` (`CmsSitemapEntry`) |
| `GET`, `POST /api/content/_form/:name` | a website form's definition and its submission (`tinyzoo/forms`) |
| `GET /api/openapi.json` | the OpenAPI 3.1 document of all of the above |
| `GET /api/openapi` | the interactive reference (off in production unless `cms.content.docs`) |
| `GET /api/content-types.ts` | the generated client types (what `tinyzoo client` writes) |
| `GET /api/health/live`, `GET /api/health/ready` | liveness and readiness (`{ ok }`, `503` when not) |

Requests carry the token (`x-api-key` or `Authorization: Bearer`) when `cms.content.token` is set. The shape
of each item follows from the config: `surface.openapi.json` and `surface.client-types.ts` show it for a
config that uses every field. Names of the form `/api/content/_x` belong to tinyzoo, which is why an
entity name cannot start with `_`.

## The client: `@tinyzoo/client`

A dependency-free, strictly typed client; the schema types come from the generated bindings (`tinyzoo client`).

| Export | What it is |
|---|---|
| `createCmsClient(options)` | the client: `cms.<collection>.list()`, `.get()`, `.tree()`, `cms.global()`, `cms.search()`, `cms.openapi()`, `cms.collection(name)` |
| `CmsError` | thrown for any non-2xx answer: `status`, `statusText`, `url`, `body` |
| `cmsMenuTree(links)` | nests a menu's links (`sub` goes under the link above) |
| `ClientOptions` | `baseUrl`, `token`, `headers`, `fetch` |
| `CmsClient`, `Collection`, `CollectionSpec`, `AnyContentSchema` | the client's type and what the generated schema must satisfy |
| `ListParams`, `ListResponse`, `GetOptions`, `TreeOptions`, `CmsTreeNode` | parameters and answers of list, get and tree |
| `SearchParams`, `SearchItem`, `SearchResponse` | the website search |
| `CmsMenuLink`, `CmsMenuItem` | a menu link and a top-level link with its dropdown |

The generated `cms-content.ts` exports `createClient(options)` (a `createCmsClient` of the site's own schema),
the item and filter types of every collection and global, `ContentSchema` and `GlobalSchema`.

## The webhook

Every change visible on the website is `POST`ed as JSON to `cms.webhooks.urls`, signed with
`cms.webhooks.secret` (nothing is sent unsigned in production). The body is `CmsWebhookPayload`: a
`CmsChange` without `by`, plus `delivery`.

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

Headers (`CMS_WEBHOOK_HEADERS`): `x-cms-event` (the change type), `x-cms-delivery` (the delivery id again) and
`x-cms-signature` (`t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`). Up to three attempts (after 1 s
and 5 s); a `4xx` other than `408` and `429` is final. Details: [deploying](deploying.md#publish-webhooks).

## The Nitro hooks

Subscribe in a server plugin: `nitro.hooks.hook('cms:change', (change) => …)`. Their types are in
`nitro-hooks.d.ts`.

| Hook | Argument | When |
|---|---|---|
| `cms:change` | `CmsChange` | a content change was saved, on the instance that saved it |
| `cms:sitemap` | `CmsSitemapEntry[]` | the sitemap is being built: push the addresses that are not entries (at most once a minute) |
| `cms:error` | `CmsErrorReport` | a server error (a 5xx request, a failed task, a webhook that gave up), after the response |

## The CLI

`tinyzoo <command>`, run from the root of the website. `tinyzoo help` prints the list below; the golden file
is `cli-usage.txt`.

| Command | Flags |
|---|---|
| `tinyzoo init <dir>` | |
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

Exit codes: `0` success; `1` a failure, or (for `status`) something pending; `2` (for `status`) the database
could not be read.

## The admin's extension points

A site changes how a field type looks in the admin without touching the package: it registers the
name of a global Vue component for a field **type** in `app.config.ts`, and ships the component
([guide](guide/admin.md#extensibility--the-field--view-registry)).

```ts
export default defineAppConfig({
  cms: { fields: { select: { edit: 'MySegmentedSelect' }, color: { edit: 'ColorPicker', cell: 'ColorSwatch' } } },
})
```

| Point | What is promised |
|---|---|
| `cms.fields[type].edit`, `.cell` | the registry: a field type (`text`, `slug`, `number`, `boolean`, `datetime`, `select`, `richtext`, `blocks`, `group`, `media`, `gallery`, `relation`) to a component name. A plugin's `fields` (`CmsFieldRenderer`) feed it; the site's own entry wins. Components are resolved by name at run time, so they must be global (`components/global/`) |
| `CmsField`, `CmsCell` | the two dispatchers that resolve it: host entry, then a plugin's, then the field's own `ui` hint, then `CmsFieldText` / `CmsCellText` |
| The default components | `CmsFieldText`, `CmsFieldSlug`, `CmsFieldNumber`, `CmsFieldBoolean`, `CmsFieldDate`, `CmsFieldSelect`, `CmsFieldRichText`, `CmsFieldBlocks`, `CmsFieldGroup`, `CmsFieldMedia`, `CmsFieldGallery`, `CmsFieldColor`, `CmsFieldRelationOne`, `CmsFieldRelationMany`, and `CmsCellText`, `CmsCellCode`, `CmsCellNumber`, `CmsCellBoolean`, `CmsCellDate`, `CmsCellBadge`, `CmsCellExcerpt`, `CmsCellBlocks`, `CmsCellGroup`, `CmsCellThumb`, `CmsCellGallery`, `CmsCellColor`, `CmsCellRelation`: these names are what `field.ui` carries (`surface.admin-graph.json`) and can be used as renderers by name |
| Props of an editor | `CmsFieldEditProps`: `field` (a `CmsAdminField`), `entity`, `id`, and `v-model` |
| Props of a cell | `CmsFieldCellProps`: `field`, `row`, `entity` |
| `cms.admin` | the admin's `name`, `siteUrl`, `accent`, `locales`, `defaultLocale` and `timeZone` |

The rest of the admin (the other `Cms*` components, the pages, `/api/cms/**`) is internal.

## Used by every site, not on this list

The frontend kit ([guide](guide/content-api.md#the-frontend-kit)) is documented, but is not (yet) part of
the freeze: `<CmsBlocks>`, `<CmsImage>`, `<CmsContent>`, `<CmsNav>`, `<CmsHighlight>`, `<CmsForm>`,
`useCmsSeo()` and `useCmsSearch()`.

## Deprecated

Still working, removed in the release named, and a deprecation warning at start or build says so
(`cmsDeprecated`, [CONTRIBUTING.md](../CONTRIBUTING.md#deprecations)).

| What | Use instead | Removed in |
|---|---|---|
| `cms.databaseUrl` | `DATABASE_URL` or `NUXT_CMS_DATABASE_URL` in the environment | 1.0 |
| `FormOptions` imported from `tinyzoo` | `import type { FormOptions } from 'tinyzoo/forms'` | 1.0 |
| a field named `page`, `limit`, `sort`, `dir` or `q` in a public collection | another name | 1.0 (an error) |

Removed in 0.6: `NUXT_SESSION_PASSWORD` as a stand-in for `NUXT_APP_SECRET`
([upgrading](upgrading.md#from-05-to-06)).
