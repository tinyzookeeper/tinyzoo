/**
 * The plugin API: `defineCmsPlugin()` and what the rest of tinyzoo does with it.
 *
 * A plugin is a plain description of what it adds to a site: entities, admin pages,
 * server routes, field renderers, texts, upgrade steps and a few hooks. It is
 * registered in the site's `cms.config.ts`:
 *
 *   export const plugins = [formsPlugin(), eventsPlugin()]
 *
 * The parts split by when they are needed:
 *  - at **runtime** (entities, singletons, tables, hooks, upgrade steps, the admin graph)
 *    they flow through the registry (`buildRegistry`) like the site's own definitions;
 *  - at **build time** (admin pages, server routes, Nitro plugins, Nuxt app plugins,
 *    components, texts, field renderers, dashboard widgets, entry panels) the Nuxt module
 *    reads the same config and registers them (`planPlugins` computes what, `module.ts`
 *    does it);
 *  - at **`tinyzoo generate`** (tables) the CLI writes them into the site's schema.ts, so
 *    drizzle-kit makes their migrations with the site's own.
 *
 * Everything a plugin adds lives under its own name, so two plugins and the site never
 * collide: entities and tables are `<plugin>` or `<plugin>_<name>`, routes `/api/cms/_p/<plugin>/…`,
 * admin pages `/admin/p/<plugin>/…`, upgrade steps `<plugin>:<id>`, texts
 * `plugins.<plugin>.…`. Mistakes (a taken name, a missing file, a route on someone
 * else's address) stop the build or the start with a message that names the plugin.
 *
 * File paths in a definition (`handler`, `file`, `components`, `serverPlugins`, `appPlugins`) are
 * absolute: build them with `pluginFile(import.meta.url, './server/ping.ts')`, so a
 * plugin works from `node_modules` as it does from a folder of the site.
 */
import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import type { CmsEntity, CmsRegistry } from './entity'
import type { LocalizedText } from './i18n'
import type { UpgradeStep } from './upgrades'

// ── definition ──────────────────────────────────────────────────────────────────
export type CmsHttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

/**
 * Who may call a plugin route under `/api/cms/_p/<plugin>/…`:
 * `user` (default) a signed-in person with any role, `admin` an administrator,
 * `public` anyone (the handler then guards itself). Enforced before the handler runs.
 */
export type CmsRouteAccess = 'user' | 'admin' | 'public'

export interface CmsPluginHandler {
  method?: CmsHttpMethod
  /**
   * Address under the plugin's own namespace: `'/ping'` is served at
   * `/api/cms/_p/<plugin>/ping`. `:param` matches one segment.
   */
  route?: string
  /**
   * Also (or instead) served on the public content API at `/api/content/<contentPath>`,
   * for plugins that give a website something to call: `'_shop/feed'` for the plugin
   * `shop`. The first segment is `_<plugin name>` (the forms plugin's is `_form`), so the
   * route can collide neither with the content API's own nor with another plugin's. These
   * routes are open; the handler decides who may use them (a content token, a spam check…).
   */
  contentPath?: string
  /** Absolute path of the Nitro handler file (default export: `defineEventHandler(…)`). */
  handler: string
  /** Applies to `route` (default `user`). */
  access?: CmsRouteAccess
}

export interface CmsPluginAdminPage {
  /** Path under `/admin/p/<plugin>/`; `''` is the plugin's index page. `:id` matches one segment. */
  path: string
  /** Absolute path of the page's Vue file. Use `definePageMeta({ layout: 'admin' })` in it. */
  file: string
}

export interface CmsPluginNavItem {
  label: LocalizedText
  /** Iconify name, e.g. `i-lucide-calendar`. */
  icon?: string
  /** An admin page of this plugin, by its `path` (`''` for the index page). */
  page?: string
  /** Or any admin address (`/admin/events_ticket`). One of `page` and `to` is needed. */
  to?: string
  /** Where in the sidebar (default `content`). */
  group?: 'content' | 'settings'
  /** Shown to administrators only. */
  adminOnly?: boolean
}

export interface CmsFieldRenderer {
  /** Name of a global component that edits a field of this type in the form. */
  edit?: string
  /** Name of a global component that shows the value in lists. */
  cell?: string
}

/**
 * A Nuxt app plugin (`defineNuxtPlugin`) the plugin adds to the site: a tracker on the
 * website, a directive, a provide. The website and the admin are one Nuxt app, so it runs
 * on both; a plugin meant for the website alone checks the route itself (`/admin` and below
 * is the admin).
 */
export interface CmsPluginAppPlugin {
  /** Absolute path of the file (`pluginFile(import.meta.url, './app/track.client.ts')`). */
  src: string
  /** Where it runs: `client` in the browser only, `server` while rendering only, `all` both (default, as in Nuxt). */
  mode?: 'client' | 'server' | 'all'
}

/**
 * A card on the admin's home page, between what is waiting for people and what they edited
 * last. The component draws the whole card, heading included (`<section>` with an
 * `h2.cms-label` and a `.cms-card`, like the home's own), and fetches its own data. When it
 * has nothing to say it renders nothing (`v-if` on its root): the home then leaves no gap.
 */
export interface CmsDashboardWidget {
  /** Name of a component in the plugin's `components` directory (its file name: `AnalyticsWidget`). */
  component: string
  /** Where among the widgets of all plugins, smallest first (default 0; equal ones keep the order plugins are registered in). */
  order?: number
  /** Shown to administrators only. */
  adminOnly?: boolean
}

/**
 * A panel in the side column of the entry editor, under the entry's own details: something
 * about the entry that is not one of its fields (how often it was read, where it is shared).
 * The editor gives it a heading (`label`); the component gets the props `entity` (its name),
 * `id` and `locale` (the language being edited, `null` for a collection that is not translated) and fetches
 * what it shows itself. It is not part of the form, so it stays usable for people who may
 * only read the entry, and it is not shown while a new entry has not been saved yet.
 */
export interface CmsEntityPanel {
  /** Name of a component in the plugin's `components` directory. */
  component: string
  /** The heading above the panel. */
  label: LocalizedText
  /** The collections it is shown for, by name (default: every collection). Singletons have no entry editor. */
  entities?: string[]
}

/** What a plugin adds to an entity's entry in the admin graph (see `graph`). */
export interface CmsGraphExtension {
  /** `false`: the admin offers no "New …" button for this collection (entries arrive some other way). */
  create?: boolean
  /** Short lines under the collection's list: an icon and an admin text from `i18n`. */
  notices?: { icon?: string; key: `plugins.${string}`; params?: Record<string, string | number> }[]
}

export interface CmsRetentionContext {
  /** The retention task's transaction (it holds the task's advisory lock). */
  tx: any
  reg: CmsRegistry
  /** Rows to delete per statement. */
  batch: number
}

export interface CmsPluginHooks {
  /**
   * The daily retention task (`cms:retention`) calls this inside its transaction, for
   * data the plugin keeps that must not be kept forever. Return what was deleted, as
   * `{ what: count }`; the counts go into the audit entry (never the data).
   */
  retention?: (ctx: CmsRetentionContext) => Promise<Record<string, number> | void> | Record<string, number> | void
}

/** An upgrade step as a plugin writes it: `id` is namespaced by the plugin, `since` defaults to the plugin's version. */
export type CmsPluginUpgradeStep = Omit<UpgradeStep, 'since'> & { since?: string }

export interface CmsPluginDef {
  /** Lowercase letters, digits and dashes (`events`, `my-shop`). Namespaces everything the plugin adds. */
  name: string
  /** The plugin's own version (recorded with its upgrade steps). */
  version: string
  /** Collections (`defineEntity`). Each name is the plugin's name or starts with `<name>_` (dashes as underscores). */
  entities?: unknown[]
  /** Single-row globals (`defineSingleton`), named like `entities`. */
  singletons?: unknown[]
  /** Renderers for field types, by type (`{ color: { edit: 'EventsColorField' } }`); the site's own `app.config` still wins. */
  fields?: Record<string, CmsFieldRenderer>
  /**
   * Tables the plugin keeps that are not entries, so the admin has no list or editor for
   * them: a log of raw events, daily totals. Plain Drizzle tables (`pgTable` from
   * `drizzle-orm/pg-core`), each named `<prefix>` or `<prefix>_…` (the plugin's name, dashes as
   * underscores) like entities, in the database's default schema. `tinyzoo generate` writes
   * them into the site's schema.ts from `tablesSource`, so drizzle-kit makes their migrations
   * along with the site's own and a deploy creates them like any other table. On the server
   * they are in the registry (`useCms().reg.pluginTables`, by their SQL name), or the plugin's
   * code imports them from its own module: the same objects.
   */
  tables?: PgTable[]
  /**
   * `tables` once more, as source: what `tinyzoo generate` pastes into schema.ts, the way
   * tinyzoo's own tables get there (drizzle-kit reads a source file, not objects, and the
   * plugin's module may not be loadable from where schema.ts is). One
   * `export const <name in camelCase> = pgTable('<name>', …)` per table and nothing else, in
   * plain JavaScript (no type annotations); `drizzle-orm/pg-core`'s builders and `sql` are
   * imported for it. `tinyzoo generate` runs it and refuses a table that differs from the one
   * in `tables`, so the two cannot drift apart unnoticed.
   */
  tablesSource?: string
  /**
   * Directory of Vue components, registered globally under their file names: field renderers
   * (`fields`), dashboard widgets, entry panels, and components for the website's pages (the
   * forms plugin's `<CmsForm>`).
   */
  components?: string
  /**
   * Directory of composables, auto-imported in the website and the admin like the site's own
   * `composables/` (every export of every file in it): the consent plugin's `useConsent()`.
   * Name them so they cannot meet the site's own (`useEvents…` for the plugin `events`).
   */
  composables?: string
  adminPages?: CmsPluginAdminPage[]
  navItems?: CmsPluginNavItem[]
  /** Cards on the admin's home page (components from `components`). */
  dashboardWidgets?: CmsDashboardWidget[]
  /** Panels in the side column of the entry editor (components from `components`). */
  entityPanels?: CmsEntityPanel[]
  serverHandlers?: CmsPluginHandler[]
  /** Absolute paths of Nitro plugin files (`defineNitroPlugin`). */
  serverPlugins?: string[]
  /** Nuxt app plugins for the website and the admin (`defineNuxtPlugin`), e.g. a tracker in the browser. */
  appPlugins?: CmsPluginAppPlugin[]
  hooks?: CmsPluginHooks
  /**
   * Admin texts by language: `{ en: { retention: '…' }, cs: { … } }`, nested objects of strings.
   * `en` is required; another language may leave keys out (English is used then).
   * Read them in the admin as `t('plugins.<name>.<key>')`.
   */
  i18n?: Record<string, Record<string, unknown>>
  /** Upgrade steps, run with tinyzoo's own by the start-up migration, `tinyzoo up` and `tinyzoo status`. */
  upgrades?: CmsPluginUpgradeStep[]
  /** Adds to an entity's entry in the admin graph (called for every entity). */
  graph?: (entity: CmsEntity) => CmsGraphExtension | void
}

export interface CmsPlugin extends Readonly<Omit<CmsPluginDef, 'entities' | 'singletons' | 'tables'>> {
  readonly __cms: 'plugin'
  readonly entities: readonly CmsEntity[]
  readonly singletons: readonly CmsEntity[]
  readonly tables: readonly PgTable[]
}

// ── names ───────────────────────────────────────────────────────────────────────
const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/
const STEP_ID = /^[a-z0-9][a-z0-9-]*$/
/** A Postgres table name tinyzoo writes without quoting trouble (63 bytes is Postgres' limit). */
const TABLE_NAME = /^[a-z][a-z0-9_]{0,62}$/
/** A global component's name as Nuxt registers it from a file name. */
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/
const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]+)?$/
const RESERVED_PLUGIN_NAMES = new Set(['cms', 'core', 'tinyzoo', 'admin', 'api', 'content', 'media', 'plugins', 'p', 'auth', 'system', 'types'])
/** Content API addresses tinyzoo uses itself (`server/api/content/_*`), and the forms plugin's. */
const RESERVED_CONTENT_SEGMENTS = new Set(['_global', '_search', '_sitemap', '_tree', '_form', '_types'])
/** First-party plugins whose content routes kept the address they had before plugins existed. */
const LEGACY_CONTENT_SEGMENTS: Record<string, string> = { forms: '_form' }
/** The first segment of a plugin's `contentPath`: `_<plugin name>` (dashes kept). */
const contentSegmentOf = (plugin: string) => LEGACY_CONTENT_SEGMENTS[plugin] ?? `_${plugin}`

/**
 * Where plugin routes and pages live.
 *
 * @internal
 */
export const pluginApiBase = (plugin: string) => `/api/cms/_p/${plugin}`
/** @internal */
export const pluginAdminBase = (plugin: string) => `/admin/p/${plugin}`

/**
 * Entity names of a plugin are `<name>` or `<name>_<rest>`, dashes written as underscores.
 *
 * @internal
 */
export const pluginEntityPrefix = (plugin: string) => plugin.replace(/-/g, '_')

const fail = (name: string | undefined, message: string): never => {
  throw new Error(`Plugin "${name ?? '?'}": ${message}`)
}

/** Absolute path of a file next to the plugin's source: `pluginFile(import.meta.url, './server/ping.ts')`. */
export function pluginFile(base: string | URL, relative: string): string {
  try {
    const url = new URL(relative, base)
    // A file: URL as a path (no node:url here: this module is part of the framework-free core).
    return decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:)/, '$1')
  }
  catch {
    return relative
  }
}

const isAbsolute = (p: string) => p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p)

/** `analytics_events` → `analyticsEvents`: a plugin table's name in schema.ts, as entities are named there. */
const camelName = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

/**
 * The tables a plugin's `tablesSource` exports, by export name → SQL name, checked to be only
 * `export const x = pgTable('x_…', …)` statements (it is pasted into schema.ts as it is, next to
 * every other table, so a helper of its own could collide with one there).
 *
 * @internal
 */
export function sourceTables(plugin: string, source: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of source.split('\n')) {
    if (!/^(export|import|const|let|var|function|class|type|interface|enum|declare)\b/.test(line)) continue
    const m = /^export const ([A-Za-z_$][\w$]*)\s*=\s*pgTable\(\s*(['"])([^'"]+)\2/.exec(line)
    if (!m) fail(plugin, `tablesSource may hold only \`export const <name> = pgTable('<name>', …)\` statements (it is pasted into schema.ts as it is), got: ${line.trim()}`)
    if (out.has(m![1]!)) fail(plugin, `tablesSource exports "${m![1]}" twice.`)
    out.set(m![1]!, m![3]!)
  }
  return out
}

function checkRoute(name: string, what: string, route: string) {
  if (!route.startsWith('/')) fail(name, `${what} "${route}" must start with "/".`)
  if (route.length > 1 && route.endsWith('/')) fail(name, `${what} "${route}" must not end with "/".`)
  if (!/^[A-Za-z0-9_\-/:.]+$/.test(route) || route.includes('//') || route.split('/').some((s) => s === '..' || s === '.')) {
    fail(name, `${what} "${route}" may only hold letters, digits, "-", "_", "." and ":param" segments.`)
  }
}

const PLURAL_CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])
const isPlural = (o: unknown): boolean => !!o && typeof o === 'object' && typeof (o as any).other === 'string'
  && Object.entries(o as object).every(([k, v]) => PLURAL_CATEGORIES.has(k) && typeof v === 'string')

function checkMessages(name: string, i18n: Record<string, Record<string, unknown>>) {
  const keysOf = (o: unknown, prefix = ''): string[] => {
    if (typeof o === 'string') return [prefix]
    // A plural message ({ one, few, other }) is one text, not a branch.
    if (isPlural(o)) return [prefix]
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      return Object.entries(o).flatMap(([k, v]) => {
        if (!/^[A-Za-z0-9_-]+$/.test(k)) fail(name, `i18n key "${prefix ? `${prefix}.` : ''}${k}" may only hold letters, digits, "-" and "_".`)
        return keysOf(v, prefix ? `${prefix}.${k}` : k)
      })
    }
    return fail(name, `i18n value at "${prefix}" must be a string or an object of strings.`)
  }
  if (!i18n.en) fail(name, 'i18n needs an "en" catalogue (English is what every other language falls back to).')
  const en = new Set(keysOf(i18n.en))
  for (const [locale, catalogue] of Object.entries(i18n)) {
    if (!LOCALE.test(locale)) fail(name, `i18n language "${locale}" is not a language code.`)
    for (const key of keysOf(catalogue)) {
      if (!en.has(key)) fail(name, `i18n "${locale}" has the key "${key}", which "en" does not.`)
    }
  }
}

/** Validate and normalise a plugin. Throws a message that names the plugin. */
export function defineCmsPlugin(def: CmsPluginDef): CmsPlugin {
  const name = def?.name
  if (typeof name !== 'string' || !NAME.test(name)) {
    return fail(name, `the name must be lowercase letters, digits and dashes (e.g. "events", "my-shop"), got ${JSON.stringify(name)}.`)
  }
  if (RESERVED_PLUGIN_NAMES.has(name)) fail(name, `"${name}" is reserved by tinyzoo.`)
  if (typeof def.version !== 'string' || !VERSION.test(def.version)) fail(name, `version must look like 1.2.3, got ${JSON.stringify(def.version)}.`)

  const prefix = pluginEntityPrefix(name)
  const asEntities = (list: unknown[] | undefined, what: 'entities' | 'singletons'): CmsEntity[] => {
    const out: CmsEntity[] = []
    for (const e of list ?? []) {
      const entity = e as CmsEntity
      if (!entity || (entity as any).__cms !== 'entity') fail(name, `${what} takes entities made with ${what === 'entities' ? 'defineEntity' : 'defineSingleton'}().`)
      if (entity.name !== prefix && !entity.name.startsWith(`${prefix}_`)) {
        fail(name, `the ${what === 'entities' ? 'entity' : 'singleton'} "${entity.name}" must be named "${prefix}" or "${prefix}_…", so it cannot collide with the site or another plugin.`)
      }
      if (what === 'singletons' && !entity.singleton) fail(name, `"${entity.name}" is in singletons but is not a singleton (use defineSingleton).`)
      if (what === 'entities' && entity.singleton) fail(name, `"${entity.name}" is a singleton: list it under singletons.`)
      out.push(entity)
    }
    return out
  }
  const entities = asEntities(def.entities, 'entities')
  const singletons = asEntities(def.singletons, 'singletons')
  const seenEntities = new Set<string>()
  for (const e of [...entities, ...singletons]) {
    if (seenEntities.has(e.name)) fail(name, `the entity "${e.name}" is listed twice.`)
    seenEntities.add(e.name)
  }

  for (const [type, r] of Object.entries(def.fields ?? {})) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(type)) fail(name, `fields: "${type}" is not a field type name.`)
    if (!r || (typeof r.edit !== 'string' && typeof r.cell !== 'string')) fail(name, `fields.${type} needs an "edit" and/or a "cell" component name.`)
    if (r.edit !== undefined && !r.edit || r.cell !== undefined && !r.cell) fail(name, `fields.${type} has an empty component name.`)
  }
  if (def.components !== undefined && !isAbsolute(def.components)) fail(name, 'components must be an absolute directory (use pluginFile(import.meta.url, "./components")).')
  if (def.composables !== undefined && !isAbsolute(def.composables)) fail(name, 'composables must be an absolute directory (use pluginFile(import.meta.url, "./composables")).')
  if (Object.keys(def.fields ?? {}).length && !def.components) fail(name, 'fields name components, so the plugin needs `components` (the directory they are in).')

  const checkComponent = (what: string, component: unknown) => {
    if (typeof component !== 'string' || !COMPONENT_NAME.test(component)) fail(name, `${what}: "${component}" is not a component name (its file name in \`components\`, e.g. "ShopWidget").`)
    if (!def.components) fail(name, `${what} names a component, so the plugin needs \`components\` (the directory it is in).`)
  }
  const widgets = new Set<string>()
  for (const w of def.dashboardWidgets ?? []) {
    checkComponent('dashboardWidgets', w?.component)
    if (widgets.has(w.component)) fail(name, `dashboardWidgets: "${w.component}" is listed twice.`)
    widgets.add(w.component)
    if (w.order !== undefined && !Number.isFinite(w.order)) fail(name, `dashboardWidgets "${w.component}": order must be a number.`)
  }
  const panels = new Set<string>()
  for (const panel of def.entityPanels ?? []) {
    checkComponent('entityPanels', panel?.component)
    if (panels.has(panel.component)) fail(name, `entityPanels: "${panel.component}" is listed twice.`)
    panels.add(panel.component)
    if (!panel.label) fail(name, `entityPanels "${panel.component}": a panel needs a label (its heading in the editor).`)
    if (panel.entities !== undefined && (!Array.isArray(panel.entities) || !panel.entities.length || panel.entities.some((e) => typeof e !== 'string' || !e))) {
      fail(name, `entityPanels "${panel.component}": entities is a list of collection names (leave it out for every collection).`)
    }
  }

  const tables: PgTable[] = []
  const tableNames = new Set<string>()
  for (const t of def.tables ?? []) {
    if (!is(t, PgTable)) fail(name, 'tables takes Drizzle tables made with pgTable() from drizzle-orm/pg-core.')
    const config = getTableConfig(t)
    if (config.schema) fail(name, `the table "${config.name}" is in the Postgres schema "${config.schema}"; plugin tables live in the default schema, with the site's.`)
    if (!TABLE_NAME.test(config.name)) fail(name, `the table "${config.name}" needs a name of lowercase letters, digits and "_" (at most 63).`)
    if (config.name !== prefix && !config.name.startsWith(`${prefix}_`)) {
      fail(name, `the table "${config.name}" must be named "${prefix}" or "${prefix}_…", so it cannot collide with the site or another plugin.`)
    }
    if (tableNames.has(config.name)) fail(name, `the table "${config.name}" is listed twice.`)
    tableNames.add(config.name)
    tables.push(t)
  }
  if (tables.length && (typeof def.tablesSource !== 'string' || !def.tablesSource.trim())) {
    fail(name, 'tables need `tablesSource`: the same tables as source, which `tinyzoo generate` writes into schema.ts so drizzle-kit makes their migrations.')
  }
  if (def.tablesSource !== undefined) {
    if (!tables.length) fail(name, 'tablesSource is given but tables is empty: list the Drizzle tables in `tables` as well (the server uses those).')
    const exported = sourceTables(name, String(def.tablesSource))
    for (const sqlName of tableNames) {
      if (exported.get(camelName(sqlName)) !== sqlName) fail(name, `tablesSource has no \`export const ${camelName(sqlName)} = pgTable('${sqlName}', …)\` (each table is exported under its name in camelCase).`)
    }
    for (const [exportName, sqlName] of exported) {
      if (!tableNames.has(sqlName) || exportName !== camelName(sqlName)) fail(name, `tablesSource exports "${exportName}" (${sqlName}), which is not one of \`tables\`.`)
    }
  }

  const pages = new Set<string>()
  for (const page of def.adminPages ?? []) {
    if (typeof page.path !== 'string' || (page.path !== '' && !/^[A-Za-z0-9_\-:]+(\/[A-Za-z0-9_\-:]+)*$/.test(page.path))) {
      fail(name, `adminPages: "${page.path}" is not a path (letters, digits, "-", "_", ":param", joined by "/"; "" for the index page).`)
    }
    if (!isAbsolute(String(page.file ?? ''))) fail(name, `adminPages "${page.path}": file must be an absolute path.`)
    const key = normalizeParams(page.path)
    if (pages.has(key)) fail(name, `adminPages: "${page.path}" is declared twice.`)
    pages.add(key)
  }
  for (const item of def.navItems ?? []) {
    if (!item.label) fail(name, 'navItems: every item needs a label.')
    if (item.page === undefined && !item.to) fail(name, `navItems "${typeof item.label === 'string' ? item.label : JSON.stringify(item.label)}": give a "page" of this plugin or a "to" address.`)
    if (item.page !== undefined && !pages.has(normalizeParams(item.page))) fail(name, `navItems: "${item.page}" is not one of the plugin's adminPages.`)
    if (item.to !== undefined && !/^\/admin(\/|$)/.test(item.to)) fail(name, `navItems: "to" must be an address in the admin ("/admin/…"), got "${item.to}".`)
  }

  const routes = new Set<string>()
  const contentRoutes = new Set<string>()
  for (const h of def.serverHandlers ?? []) {
    if (!h.route && !h.contentPath) fail(name, 'serverHandlers: every handler needs a "route" or a "contentPath".')
    if (!isAbsolute(String(h.handler ?? ''))) fail(name, `serverHandlers "${h.route ?? h.contentPath}": handler must be an absolute path.`)
    const method = h.method ?? 'get'
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) fail(name, `serverHandlers: unknown method "${method}".`)
    if (h.access !== undefined && !['user', 'admin', 'public'].includes(h.access)) fail(name, `serverHandlers: unknown access "${h.access}".`)
    if (h.route !== undefined) {
      checkRoute(name, 'route', h.route)
      const key = `${method} ${normalizeParams(h.route)}`
      if (routes.has(key)) fail(name, `serverHandlers: ${method.toUpperCase()} ${h.route} is declared twice.`)
      routes.add(key)
    }
    if (h.contentPath !== undefined) {
      checkRoute(name, 'contentPath', `/${h.contentPath}`)
      const first = h.contentPath.split('/')[0]!
      const own = contentSegmentOf(name)
      if (!LEGACY_CONTENT_SEGMENTS[name] && RESERVED_CONTENT_SEGMENTS.has(own)) {
        fail(name, `contentPath "${h.contentPath}": a plugin's content routes live under /api/content/_<plugin name>/, and "${own}" is an address tinyzoo uses itself (${[...RESERVED_CONTENT_SEGMENTS].join(', ')}). Rename the plugin to serve content routes.`)
      }
      if (first !== own) {
        fail(name, `contentPath "${h.contentPath}": the first segment must be "${own}" (a plugin's content routes live under /api/content/_<plugin name>/, so they cannot collide with tinyzoo's or another plugin's).`)
      }
      const key = `${method} ${normalizeParams(h.contentPath)}`
      if (contentRoutes.has(key)) fail(name, `serverHandlers: ${method.toUpperCase()} /api/content/${h.contentPath} is declared twice.`)
      contentRoutes.add(key)
    }
  }
  for (const p of def.serverPlugins ?? []) if (!isAbsolute(p)) fail(name, `serverPlugins: "${p}" must be an absolute path.`)
  for (const p of def.appPlugins ?? []) {
    if (!p || !isAbsolute(String(p.src ?? ''))) fail(name, `appPlugins: "${p?.src}" must be an absolute path (use pluginFile(import.meta.url, "./app/….ts")).`)
    if (p.mode !== undefined && !['client', 'server', 'all'].includes(p.mode)) fail(name, `appPlugins "${p.src}": mode is 'client', 'server' or 'all', got "${p.mode}".`)
  }

  for (const key of Object.keys(def.hooks ?? {})) {
    if (key !== 'retention') fail(name, `hooks: "${key}" is not a hook (available: retention).`)
  }
  if (def.i18n) checkMessages(name, def.i18n)

  const steps = new Set<string>()
  for (const s of def.upgrades ?? []) {
    if (!STEP_ID.test(s.id)) fail(name, `upgrade step id "${s.id}" must be kebab-case (letters, digits, dashes); the plugin's name is added in front.`)
    if (steps.has(s.id)) fail(name, `two upgrade steps share the id "${s.id}".`)
    steps.add(s.id)
    if (s.phase !== 'before' && s.phase !== 'after') fail(name, `upgrade step "${s.id}" needs phase 'before' or 'after'.`)
    if (s.since !== undefined && !VERSION.test(s.since)) fail(name, `upgrade step "${s.id}": since must look like 1.2.3.`)
  }

  return Object.freeze({ ...def, __cms: 'plugin' as const, entities, singletons, tables }) as CmsPlugin
}

/** `:id` and `:slug` are the same address: compare routes without the parameter names. */
function normalizeParams(path: string): string {
  return path.split('/').map((s) => (s.startsWith(':') ? ':' : s)).join('/')
}

/** @internal */
export const isCmsPlugin = (v: unknown): v is CmsPlugin => !!v && typeof v === 'object' && (v as any).__cms === 'plugin'

// ── collecting plugins from a host config ───────────────────────────────────────
/**
 * Marks an entity that needs a plugin: `defineForm` needs `forms`. A plugin that is not
 * registered is an error, unless the entity says how to make it (`create`): the
 * deprecated way of using forms, which registers the plugin by itself.
 *
 * @internal
 */
export interface CmsPluginRequirement {
  plugin: string
  /** How to register it, for the error message. */
  hint: string
  /** Makes the plugin when the site did not register it (deprecated paths only). */
  create?: () => CmsPlugin
}

/**
 * What a plugin needs of another plugin, for a mode or an option of its own: the analytics
 * plugin's `mode: 'consent'` needs the consent plugin. A plugin carries these as `needs` on the
 * object it returns (not an option of `defineCmsPlugin`); `collectPlugins` checks them, so the
 * build, the start and the CLI all stop with the message.
 *
 * @internal
 */
export interface CmsPluginNeed {
  plugin: string
  /** Said when the other plugin is not registered. */
  message: string
  /** What else must be true of the other plugin: a message when it is not. */
  check?: (other: CmsPlugin) => string | null | undefined
}

/**
 * The plugins of a host config: the arrays exported as `plugins` and any plugin
 * exported by itself, plus those an entity of the config asks for by itself. Throws on
 * two plugins with one name, or an entity whose plugin is missing.
 *
 * @internal
 */
export function collectPlugins(config: Record<string, any>): CmsPlugin[] {
  const found: CmsPlugin[] = []
  const add = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(add)
    else if (isCmsPlugin(v) && !found.includes(v)) found.push(v)
    else if (v !== undefined && v !== null && !isCmsPlugin(v)) throw new Error(`\`plugins\` in cms.config.ts takes plugins (defineCmsPlugin()), got ${typeof v}.`)
  }
  for (const [key, v] of Object.entries(config)) {
    if (key === 'plugins') add(v)
    else if (isCmsPlugin(v)) add(v)
  }
  const byName = new Map<string, CmsPlugin>()
  for (const p of found) {
    if (byName.has(p.name)) throw new Error(`Two plugins are named "${p.name}": register it once.`)
    byName.set(p.name, p)
  }
  for (const v of Object.values(config)) {
    const need = (v as any)?.requiresPlugin as CmsPluginRequirement | undefined
    if (!need || byName.has(need.plugin)) continue
    if (!need.create) {
      throw new Error(`"${(v as any).name}" needs the "${need.plugin}" plugin, which is not registered: ${need.hint}`)
    }
    const made = need.create()
    byName.set(made.name, made)
    found.push(made)
  }
  for (const p of found) {
    for (const need of ((p as any).needs ?? []) as CmsPluginNeed[]) {
      const other = byName.get(need.plugin)
      if (!other) throw new Error(`Plugin "${p.name}": ${need.message}`)
      const problem = need.check?.(other)
      if (problem) throw new Error(`Plugin "${p.name}": ${problem}`)
    }
  }
  return found
}

/**
 * tinyzoo's own steps are not namespaced; a plugin's are `<plugin>:<id>`.
 *
 * @internal
 */
export const pluginStepId = (plugin: string, id: string) => `${plugin}:${id}`

/**
 * The upgrade steps of the plugins, namespaced, ready for the runner.
 *
 * @internal
 */
export function pluginUpgradeSteps(plugins: readonly CmsPlugin[]): UpgradeStep[] {
  return plugins.flatMap((p) => (p.upgrades ?? []).map((s) => ({ ...s, id: pluginStepId(p.name, s.id), since: s.since ?? p.version })))
}

/**
 * Every entity the plugins add (collections and singletons).
 *
 * @internal
 */
export const pluginEntities = (plugins: readonly CmsPlugin[]): CmsEntity[] => plugins.flatMap((p) => [...p.entities, ...p.singletons])

// ── routes ──────────────────────────────────────────────────────────────────────
/**
 * Does `path` (no query) match a route with `:param` segments?
 *
 * @internal
 */
export function matchRoute(pattern: string, path: string): boolean {
  const a = pattern.split('/')
  const b = routePath(path).split('/')
  const rest = a.indexOf('**')
  if (rest !== -1) return b.length >= rest && a.slice(0, rest).every((s, i) => (s.startsWith(':') ? b[i]! !== '' : s === b[i]))
  return a.length === b.length && a.every((s, i) => (s.startsWith(':') ? b[i]! !== '' : s === b[i]))
}

/**
 * A request path the way the router sees it: no query, no trailing slashes (`/x/` and
 * `/x` reach the same handler, so they must get the same access rule).
 */
export const routePath = (path: string): string => path.split('?')[0]!.replace(/\/+$/, '') || '/'

/**
 * The access rule for a request to `/api/cms/_p/…`: `null` when the path is not under
 * a plugin namespace at all, otherwise the declared access of the matching route, or
 * `user` for an address no route declares (never open by accident).
 *
 * @internal
 */
export function pluginRouteAccess(plugins: readonly CmsPlugin[], method: string, path: string): CmsRouteAccess | null {
  if (!path.split('?')[0]!.startsWith('/api/cms/_p/')) return null
  const clean = routePath(path)
  const m = method.toLowerCase()
  for (const p of plugins) {
    const base = pluginApiBase(p.name)
    if (clean !== base && !clean.startsWith(`${base}/`)) continue
    const handlers = (p.serverHandlers ?? []).filter((h) => h.route !== undefined)
    for (const h of handlers) {
      if ((h.method ?? 'get') !== m) continue
      if (matchRoute(base + h.route, clean)) return h.access ?? 'user'
    }
    // An address in this plugin's namespace that no route declares (the router may still
    // reach a handler by a spelling this matcher doesn't know): the strictest rule the
    // plugin uses anywhere, never less than a signed-in person.
    return handlers.some((h) => h.access === 'admin') ? 'admin' : 'user'
  }
  return 'user'
}

// ── what the Nuxt module registers ──────────────────────────────────────────────
/** @internal */
export interface PluginPlan {
  pages: { name: string; path: string; file: string; plugin: string }[]
  handlers: { method: CmsHttpMethod; route: string; handler: string; plugin: string }[]
  serverPlugins: string[]
  componentDirs: string[]
  composableDirs: string[]
  navItems: { plugin: string; label: LocalizedText; icon?: string; to: string; group: 'content' | 'settings'; adminOnly: boolean }[]
  appPlugins: { src: string; mode: 'client' | 'server' | 'all'; plugin: string }[]
  /** Sorted by `order`, then the order the plugins are registered in. */
  dashboardWidgets: { plugin: string; component: string; order: number; adminOnly: boolean }[]
  /** `entities: null`: every collection. */
  entityPanels: { plugin: string; component: string; label: LocalizedText; entities: string[] | null }[]
  fields: Record<string, { edit?: string; cell?: string; plugin: string }>
  messages: Record<string, Record<string, Record<string, unknown>>>
  plugins: { name: string; version: string }[]
}

/**
 * What the build must register for these plugins, or an error that names the plugin:
 * duplicate names, two plugins on one route, page or field type, files that do not
 * exist (`exists`: the module passes `existsSync`).
 *
 * @internal
 */
export function planPlugins(plugins: readonly CmsPlugin[], opts: { exists?: (file: string) => boolean } = {}): PluginPlan {
  const exists = opts.exists ?? (() => true)
  const plan: PluginPlan = { pages: [], handlers: [], serverPlugins: [], componentDirs: [], composableDirs: [], navItems: [], appPlugins: [], dashboardWidgets: [], entityPanels: [], fields: {}, messages: {}, plugins: [] }
  const names = new Set<string>()
  const taken = new Map<string, string>() // "get /api/cms/_p/x/y" → plugin
  const need = (plugin: string, what: string, file: string) => {
    if (!exists(file)) fail(plugin, `${what} "${file}" does not exist.`)
  }
  const claim = (plugin: string, key: string, shown: string) => {
    const other = taken.get(key)
    if (other) fail(plugin, `${shown} is already served by the plugin "${other}".`)
    taken.set(key, plugin)
  }
  const components = new Map<string, string>() // widget or panel component → plugin
  const ownComponent = (plugin: string, component: string) => {
    const other = components.get(component)
    if (other && other !== plugin) fail(plugin, `the component "${component}" is also a widget or panel of the plugin "${other}" (components are global: give each plugin's its own name).`)
    components.set(component, plugin)
  }
  for (const p of plugins) {
    if (names.has(p.name)) throw new Error(`Two plugins are named "${p.name}": register it once.`)
    names.add(p.name)
    plan.plugins.push({ name: p.name, version: p.version })

    for (const page of p.adminPages ?? []) {
      need(p.name, `admin page "${page.path}": file`, page.file)
      const path = page.path ? `${pluginAdminBase(p.name)}/${page.path}` : pluginAdminBase(p.name)
      plan.pages.push({ name: `cms-plugin-${p.name}-${page.path.replace(/[^A-Za-z0-9]+/g, '-') || 'index'}`, path, file: page.file, plugin: p.name })
    }
    for (const h of p.serverHandlers ?? []) {
      need(p.name, `server handler "${h.route ?? h.contentPath}": handler`, h.handler)
      const method = h.method ?? 'get'
      if (h.route !== undefined) {
        const route = pluginApiBase(p.name) + h.route
        claim(p.name, `${method} ${normalizeParams(route)}`, `${method.toUpperCase()} ${route}`)
        plan.handlers.push({ method, route, handler: h.handler, plugin: p.name })
      }
      if (h.contentPath !== undefined) {
        const route = `/api/content/${h.contentPath}`
        claim(p.name, `${method} ${normalizeParams(route)}`, `${method.toUpperCase()} ${route}`)
        plan.handlers.push({ method, route, handler: h.handler, plugin: p.name })
      }
    }
    for (const file of p.serverPlugins ?? []) {
      need(p.name, 'server plugin', file)
      plan.serverPlugins.push(file)
    }
    for (const app of p.appPlugins ?? []) {
      need(p.name, 'app plugin', app.src)
      plan.appPlugins.push({ src: app.src, mode: app.mode ?? 'all', plugin: p.name })
    }
    if (p.components) {
      need(p.name, 'components directory', p.components)
      plan.componentDirs.push(p.components)
    }
    if (p.composables) {
      need(p.name, 'composables directory', p.composables)
      plan.composableDirs.push(p.composables)
    }
    for (const [type, r] of Object.entries(p.fields ?? {})) {
      const other = plan.fields[type]
      if (other) fail(p.name, `the field type "${type}" already has renderers from the plugin "${other.plugin}".`)
      plan.fields[type] = { ...r, plugin: p.name }
    }
    for (const item of p.navItems ?? []) {
      const to = item.page !== undefined ? (item.page ? `${pluginAdminBase(p.name)}/${item.page}` : pluginAdminBase(p.name)) : item.to!
      plan.navItems.push({ plugin: p.name, label: item.label, icon: item.icon, to, group: item.group ?? 'content', adminOnly: !!item.adminOnly })
    }
    // Components are global, so a widget or panel of one plugin could be drawn by another's
    // component of the same name: refuse that here rather than show the wrong card.
    for (const w of p.dashboardWidgets ?? []) {
      ownComponent(p.name, w.component)
      plan.dashboardWidgets.push({ plugin: p.name, component: w.component, order: w.order ?? 0, adminOnly: !!w.adminOnly })
    }
    for (const panel of p.entityPanels ?? []) {
      ownComponent(p.name, panel.component)
      plan.entityPanels.push({ plugin: p.name, component: panel.component, label: panel.label, entities: panel.entities ? [...panel.entities] : null })
    }
    if (p.i18n) plan.messages[p.name] = p.i18n as Record<string, Record<string, unknown>>
  }
  // A stable sort: equal orders keep the plugins' order.
  plan.dashboardWidgets.sort((a, b) => a.order - b.order)
  return plan
}
