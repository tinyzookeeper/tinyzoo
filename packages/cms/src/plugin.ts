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
 *  - at **runtime** (entities, singletons, hooks, upgrade steps, the admin graph) they flow
 *    through the registry (`buildRegistry`) like the site's own definitions;
 *  - at **build time** (admin pages, server routes, Nitro plugins, components, texts,
 *    field renderers) the Nuxt module reads the same config and registers them
 *    (`planPlugins` computes what, `module.ts` does it).
 *
 * Everything a plugin adds lives under its own name, so two plugins and the site never
 * collide: entities are `<plugin>` or `<plugin>_<name>`, routes `/api/cms/_p/<plugin>/…`,
 * admin pages `/admin/p/<plugin>/…`, upgrade steps `<plugin>:<id>`, texts
 * `plugins.<plugin>.…`. Mistakes (a taken name, a missing file, a route on someone
 * else's address) stop the build or the start with a message that names the plugin.
 *
 * File paths in a definition (`handler`, `file`, `components`, `serverPlugins`) are
 * absolute: build them with `pluginFile(import.meta.url, './server/ping.ts')`, so a
 * plugin works from `node_modules` as it does from a folder of the site.
 */
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
   * for plugins that give a website something to call: `'_form/:name'`. The first
   * segment starts with `_` and is not one of the content API's own. These routes are
   * open; the handler decides who may use them (a content token, a spam check…).
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
  /** Directory of Vue components, registered globally under their file names. Needed for `fields` and nothing else. */
  components?: string
  adminPages?: CmsPluginAdminPage[]
  navItems?: CmsPluginNavItem[]
  serverHandlers?: CmsPluginHandler[]
  /** Absolute paths of Nitro plugin files (`defineNitroPlugin`). */
  serverPlugins?: string[]
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

export interface CmsPlugin extends Readonly<Omit<CmsPluginDef, 'entities' | 'singletons'>> {
  readonly __cms: 'plugin'
  readonly entities: readonly CmsEntity[]
  readonly singletons: readonly CmsEntity[]
}

// ── names ───────────────────────────────────────────────────────────────────────
const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/
const STEP_ID = /^[a-z0-9][a-z0-9-]*$/
const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]+)?$/
const RESERVED_PLUGIN_NAMES = new Set(['cms', 'core', 'tinyzoo', 'admin', 'api', 'content', 'media', 'plugins', 'p', 'auth', 'system'])
/** Content API addresses tinyzoo uses itself. */
const RESERVED_CONTENT_SEGMENTS = new Set(['_global', '_search', '_sitemap'])

/** Where plugin routes and pages live. */
export const pluginApiBase = (plugin: string) => `/api/cms/_p/${plugin}`
export const pluginAdminBase = (plugin: string) => `/admin/p/${plugin}`

/** Entity names of a plugin are `<name>` or `<name>_<rest>`, dashes written as underscores. */
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
  if (Object.keys(def.fields ?? {}).length && !def.components) fail(name, 'fields name components, so the plugin needs `components` (the directory they are in).')

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
      if (!first.startsWith('_') || RESERVED_CONTENT_SEGMENTS.has(first)) {
        fail(name, `contentPath "${h.contentPath}": the first segment must start with "_" and not be one of ${[...RESERVED_CONTENT_SEGMENTS].join(', ')}.`)
      }
      const key = `${method} ${normalizeParams(h.contentPath)}`
      if (contentRoutes.has(key)) fail(name, `serverHandlers: ${method.toUpperCase()} /api/content/${h.contentPath} is declared twice.`)
      contentRoutes.add(key)
    }
  }
  for (const p of def.serverPlugins ?? []) if (!isAbsolute(p)) fail(name, `serverPlugins: "${p}" must be an absolute path.`)

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

  return Object.freeze({ ...def, __cms: 'plugin' as const, entities, singletons }) as CmsPlugin
}

/** `:id` and `:slug` are the same address: compare routes without the parameter names. */
function normalizeParams(path: string): string {
  return path.split('/').map((s) => (s.startsWith(':') ? ':' : s)).join('/')
}

export const isCmsPlugin = (v: unknown): v is CmsPlugin => !!v && typeof v === 'object' && (v as any).__cms === 'plugin'

// ── collecting plugins from a host config ───────────────────────────────────────
/**
 * Marks an entity that needs a plugin: `defineForm` needs `forms`. A plugin that is not
 * registered is an error, unless the entity says how to make it (`create`): the
 * deprecated way of using forms, which registers the plugin by itself.
 */
export interface CmsPluginRequirement {
  plugin: string
  /** How to register it, for the error message. */
  hint: string
  /** Makes the plugin when the site did not register it (deprecated paths only). */
  create?: () => CmsPlugin
}

/**
 * The plugins of a host config: the arrays exported as `plugins` and any plugin
 * exported by itself, plus those an entity of the config asks for by itself. Throws on
 * two plugins with one name, or an entity whose plugin is missing.
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
  return found
}

/** tinyzoo's own steps are not namespaced; a plugin's are `<plugin>:<id>`. */
export const pluginStepId = (plugin: string, id: string) => `${plugin}:${id}`

/** The upgrade steps of the plugins, namespaced, ready for the runner. */
export function pluginUpgradeSteps(plugins: readonly CmsPlugin[]): UpgradeStep[] {
  return plugins.flatMap((p) => (p.upgrades ?? []).map((s) => ({ ...s, id: pluginStepId(p.name, s.id), since: s.since ?? p.version })))
}

/** Every entity the plugins add (collections and singletons). */
export const pluginEntities = (plugins: readonly CmsPlugin[]): CmsEntity[] => plugins.flatMap((p) => [...p.entities, ...p.singletons])

// ── routes ──────────────────────────────────────────────────────────────────────
/** Does `path` (no query) match a route with `:param` segments? */
export function matchRoute(pattern: string, path: string): boolean {
  const a = pattern.split('/')
  const b = path.split('?')[0]!.split('/')
  return a.length === b.length && a.every((s, i) => (s.startsWith(':') ? b[i]! !== '' : s === b[i]))
}

/**
 * The access rule for a request to `/api/cms/_p/…`: `null` when the path is not under
 * a plugin namespace at all, otherwise the declared access of the matching route, or
 * `user` for an address no route declares (never open by accident).
 */
export function pluginRouteAccess(plugins: readonly CmsPlugin[], method: string, path: string): CmsRouteAccess | null {
  const clean = path.split('?')[0]!
  if (!clean.startsWith('/api/cms/_p/')) return null
  const m = method.toLowerCase()
  for (const p of plugins) {
    const base = pluginApiBase(p.name)
    if (clean !== base && !clean.startsWith(`${base}/`)) continue
    for (const h of p.serverHandlers ?? []) {
      if (h.route === undefined || (h.method ?? 'get') !== m) continue
      if (matchRoute(base + h.route, clean)) return h.access ?? 'user'
    }
  }
  return 'user'
}

// ── what the Nuxt module registers ──────────────────────────────────────────────
export interface PluginPlan {
  pages: { name: string; path: string; file: string; plugin: string }[]
  handlers: { method: CmsHttpMethod; route: string; handler: string; plugin: string }[]
  serverPlugins: string[]
  componentDirs: string[]
  navItems: { plugin: string; label: LocalizedText; icon?: string; to: string; group: 'content' | 'settings'; adminOnly: boolean }[]
  fields: Record<string, { edit?: string; cell?: string; plugin: string }>
  messages: Record<string, Record<string, Record<string, unknown>>>
  plugins: { name: string; version: string }[]
}

/**
 * What the build must register for these plugins, or an error that names the plugin:
 * duplicate names, two plugins on one route, page or field type, files that do not
 * exist (`exists`: the module passes `existsSync`).
 */
export function planPlugins(plugins: readonly CmsPlugin[], opts: { exists?: (file: string) => boolean } = {}): PluginPlan {
  const exists = opts.exists ?? (() => true)
  const plan: PluginPlan = { pages: [], handlers: [], serverPlugins: [], componentDirs: [], navItems: [], fields: {}, messages: {}, plugins: [] }
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
    if (p.components) {
      need(p.name, 'components directory', p.components)
      plan.componentDirs.push(p.components)
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
    if (p.i18n) plan.messages[p.name] = p.i18n as Record<string, Record<string, unknown>>
  }
  return plan
}
