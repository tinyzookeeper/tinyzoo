import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { bigserial, date, index, integer, pgSchema, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'
import {
  allUpgradeSteps, buildRegistry, CORE_UPGRADE_STEPS, cmsDeprecations, collectPlugins, defineCmsPlugin, defineEntity, defineSingleton, emitSchema, f,
  matchRoute, planPlugins, pluginFile, pluginRouteAccess, pluginUpgradeSteps, resetCmsDeprecations, type CmsPluginDef,
} from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { MigrationStatus } from 'tinyzoo'
import { siteUpgradeSteps } from '../../packages/cms/cli/db'
import { formatStatus } from '../../packages/cms/cli/status'
import { runUpgradeSteps, assertValidSteps } from '../../packages/cms/src/upgrades'
import { playgroundDir } from '../setup/database'
import { eventsPlugin } from '../../playground/cms-plugins/events'

// The plugin API: validation, collection from a config, the registry, what the build
// registers, route access, and upgrade steps.

const entity = (name: string, extra: Record<string, unknown> = {}) =>
  defineEntity(name, { label: name, titleField: 'title', fields: { title: f.text() }, ...extra } as any)

/** A valid plugin definition to bend in each test. */
const def = (over: Partial<CmsPluginDef> = {}): CmsPluginDef => ({ name: 'shop', version: '1.0.0', ...over })

const fieldsOf = { title: f.text() }

describe('defineCmsPlugin: names and versions', () => {
  it('accepts a plain plugin and freezes it', () => {
    const p = defineCmsPlugin(def())
    expect(p).toMatchObject({ __cms: 'plugin', name: 'shop', version: '1.0.0', entities: [], singletons: [] })
    expect(Object.isFrozen(p)).toBe(true)
  })

  it.each(['Shop', 'my_shop', '1shop', 'shop-', '', 'a b'])('rejects the name %j', (name) => {
    expect(() => defineCmsPlugin(def({ name }))).toThrow(/name must be lowercase/)
  })

  it.each(['cms', 'core', 'tinyzoo', 'admin', 'api', 'content', 'media', 'plugins', 'p'])('reserves the name %s', (name) => {
    expect(() => defineCmsPlugin(def({ name }))).toThrow(/reserved by tinyzoo/)
  })

  it('wants a semantic version', () => {
    expect(() => defineCmsPlugin(def({ version: '1.0' }))).toThrow(/version must look like 1.2.3/)
    expect(defineCmsPlugin(def({ version: '2.0.0-beta.1' })).version).toBe('2.0.0-beta.1')
  })

  it('names the plugin in every message', () => {
    expect(() => defineCmsPlugin(def({ name: 'my-shop', adminPages: [{ path: 'x', file: 'relative.vue' }] }))).toThrow(/^Plugin "my-shop": /)
  })
})

describe('defineCmsPlugin: entities are namespaced', () => {
  it('takes the plugin name or `<name>_…`, dashes written as underscores', () => {
    expect(defineCmsPlugin(def({ entities: [entity('shop'), entity('shop_order')] })).entities.map((e) => e.name)).toEqual(['shop', 'shop_order'])
    expect(defineCmsPlugin(def({ name: 'my-shop', entities: [entity('my_shop_order')] })).entities).toHaveLength(1)
  })

  it('refuses a name that could collide with the site or another plugin', () => {
    expect(() => defineCmsPlugin(def({ entities: [entity('order')] }))).toThrow(/must be named "shop" or "shop_…"/)
    expect(() => defineCmsPlugin(def({ entities: [entity('shopping')] }))).toThrow(/must be named "shop"/)
  })

  it('keeps entities and singletons apart', () => {
    const settings = defineSingleton('shop_settings', { label: 'Shop', titleField: 'title', fields: { title: f.text() } } as any)
    expect(defineCmsPlugin(def({ singletons: [settings] })).singletons).toHaveLength(1)
    expect(() => defineCmsPlugin(def({ entities: [settings] }))).toThrow(/is a singleton: list it under singletons/)
    expect(() => defineCmsPlugin(def({ singletons: [entity('shop_order')] }))).toThrow(/is not a singleton/)
    expect(() => defineCmsPlugin(def({ entities: [{ nope: 1 }] }))).toThrow(/takes entities made with defineEntity/)
  })

  it('refuses the same entity twice', () => {
    const e = entity('shop_order')
    expect(() => defineCmsPlugin(def({ entities: [e, e] }))).toThrow(/listed twice/)
  })
})

describe('defineCmsPlugin: routes, pages, files', () => {
  const file = '/plugin/handler.ts'

  it('accepts namespaced routes and content routes', () => {
    const p = defineCmsPlugin(def({ serverHandlers: [
      { route: '/ping', handler: file },
      { method: 'post', route: '/orders/:id/ship', access: 'admin', handler: file },
      { route: '/next', contentPath: '_shop/next', access: 'public', handler: file },
      { contentPath: '_shop/feed', handler: file },
    ] }))
    expect(p.serverHandlers).toHaveLength(4)
  })

  it('needs a route or a content path, and an absolute handler', () => {
    expect(() => defineCmsPlugin(def({ serverHandlers: [{ handler: file }] }))).toThrow(/needs a "route" or a "contentPath"/)
    expect(() => defineCmsPlugin(def({ serverHandlers: [{ route: '/x', handler: './rel.ts' }] }))).toThrow(/handler must be an absolute path/)
  })

  it.each(['ping', '/ping/', '/a//b', '/../x', '/a b'])('rejects the route %j', (route) => {
    expect(() => defineCmsPlugin(def({ serverHandlers: [{ route, handler: file }] }))).toThrow(/route "/)
  })

  it('keeps a plugin\'s content routes under /api/content/_<plugin name>/', () => {
    for (const contentPath of ['_global/x', '_search', '_sitemap/x', '_tree/pages', '_form/x', 'posts', 'shop/x', '_shopping/x', '_shop_x', '_other/x']) {
      expect(() => defineCmsPlugin(def({ serverHandlers: [{ contentPath, handler: file }] }))).toThrow(/the first segment must be "_shop"/)
    }
    // dashes stay in the plugin's segment
    expect(defineCmsPlugin(def({ name: 'my-shop', serverHandlers: [{ contentPath: '_my-shop/feed', handler: file }] })).serverHandlers).toHaveLength(1)
    expect(() => defineCmsPlugin(def({ name: 'my-shop', serverHandlers: [{ contentPath: '_my_shop/feed', handler: file }] }))).toThrow(/must be "_my-shop"/)
  })

  it.each(['global', 'search', 'sitemap', 'tree', 'form'])('refuses content routes to a plugin named %s (tinyzoo\'s own address)', (plugin) => {
    expect(() => defineCmsPlugin(def({ name: plugin, serverHandlers: [{ contentPath: `_${plugin}/x`, handler: file }] }))).toThrow(/is an address tinyzoo uses itself.*Rename the plugin/)
    // the plugin itself, and its own routes, are fine
    expect(defineCmsPlugin(def({ name: plugin, serverHandlers: [{ route: '/x', handler: file }] })).serverHandlers).toHaveLength(1)
  })

  it('keeps the forms plugin on _form, its address from before plugins existed', () => {
    expect(defineCmsPlugin(def({ name: 'forms', serverHandlers: [{ contentPath: '_form/:name', handler: file }] })).serverHandlers).toHaveLength(1)
    expect(() => defineCmsPlugin(def({ name: 'forms', serverHandlers: [{ contentPath: '_forms/:name', handler: file }] }))).toThrow(/must be "_form"/)
  })

  it('first-party plugins follow the rule', () => {
    expect(() => formsPlugin()).not.toThrow()
    expect(() => eventsPlugin()).not.toThrow()
  })

  it('refuses the same route twice, whatever the parameter is called', () => {
    expect(() => defineCmsPlugin(def({ serverHandlers: [{ route: '/a/:id', handler: file }, { route: '/a/:slug', handler: file }] }))).toThrow(/declared twice/)
    // another method is another route
    expect(defineCmsPlugin(def({ serverHandlers: [{ route: '/a', handler: file }, { method: 'post', route: '/a', handler: file }] })).serverHandlers).toHaveLength(2)
  })

  it('checks admin pages and the nav items that point at them', () => {
    expect(() => defineCmsPlugin(def({ adminPages: [{ path: '/x', file }] }))).toThrow(/is not a path/)
    expect(() => defineCmsPlugin(def({ adminPages: [{ path: 'x', file }, { path: 'x', file }] }))).toThrow(/declared twice/)
    expect(() => defineCmsPlugin(def({ navItems: [{ label: 'Orders', page: 'orders' }] }))).toThrow(/is not one of the plugin's adminPages/)
    expect(() => defineCmsPlugin(def({ navItems: [{ label: 'Orders' }] }))).toThrow(/give a "page" of this plugin or a "to" address/)
    expect(() => defineCmsPlugin(def({ navItems: [{ label: 'Orders', to: '/somewhere' }] }))).toThrow(/must be an address in the admin/)
    expect(defineCmsPlugin(def({ adminPages: [{ path: '', file }], navItems: [{ label: 'Shop', page: '' }, { label: 'Posts', to: '/admin/post' }] })).navItems).toHaveLength(2)
  })

  it('wants components for field renderers', () => {
    expect(() => defineCmsPlugin(def({ fields: { color: { edit: 'ShopColor' } } }))).toThrow(/needs `components`/)
    expect(() => defineCmsPlugin(def({ components: '/c', fields: { color: {} } }))).toThrow(/"edit" and\/or a "cell"/)
    expect(defineCmsPlugin(def({ components: '/c', fields: { color: { edit: 'ShopColor' } } })).fields).toEqual({ color: { edit: 'ShopColor' } })
  })

  it('only knows the hooks that exist', () => {
    expect(() => defineCmsPlugin(def({ hooks: { onSave: () => {} } as any }))).toThrow(/"onSave" is not a hook/)
    expect(defineCmsPlugin(def({ hooks: { retention: () => ({}) } })).hooks?.retention).toBeTypeOf('function')
  })

  it('makes absolute paths from import.meta.url', () => {
    expect(pluginFile('file:///site/plugins/shop/index.ts', './server/ping.ts')).toBe('/site/plugins/shop/server/ping.ts')
    expect(pluginFile('file:///my%20site/p/index.ts', './a.vue')).toBe('/my site/p/a.vue')
  })
})

describe('defineCmsPlugin: texts', () => {
  it('needs English, and no key English does not have', () => {
    expect(() => defineCmsPlugin(def({ i18n: { cs: { title: 'Obchod' } } }))).toThrow(/needs an "en" catalogue/)
    expect(() => defineCmsPlugin(def({ i18n: { en: { title: 'Shop' }, cs: { title: 'Obchod', extra: 'x' } } }))).toThrow(/"cs" has the key "extra", which "en" does not/)
    expect(() => defineCmsPlugin(def({ i18n: { en: { title: 5 as any } } }))).toThrow(/must be a string or an object of strings/)
  })

  it('lets another language leave keys out, and writes plurals per language', () => {
    const p = defineCmsPlugin(def({ i18n: {
      en: { title: 'Shop', days: { one: '{count} day', other: '{count} days' }, nested: { a: 'A' } },
      cs: { days: { one: '{count} den', few: '{count} dny', other: '{count} dní' } },
    } }))
    expect(Object.keys(p.i18n!)).toEqual(['en', 'cs'])
  })
})

describe('defineCmsPlugin: upgrade steps', () => {
  const step = { id: 'backfill', description: 'x', phase: 'after' as const, run: () => {} }

  it('namespaces the id by the plugin and takes its version for `since`', () => {
    const steps = pluginUpgradeSteps([defineCmsPlugin(def({ upgrades: [step, { ...step, id: 'index', since: '1.2.0' }] }))])
    expect(steps.map((s) => [s.id, s.since])).toEqual([['shop:backfill', '1.0.0'], ['shop:index', '1.2.0']])
    expect(() => assertValidSteps(steps)).not.toThrow()
  })

  it('keeps the same id of two plugins apart', () => {
    const steps = pluginUpgradeSteps([defineCmsPlugin(def({ upgrades: [step] })), defineCmsPlugin(def({ name: 'blog', upgrades: [step] }))])
    expect(steps.map((s) => s.id)).toEqual(['shop:backfill', 'blog:backfill'])
    expect(() => assertValidSteps(steps)).not.toThrow()
  })

  it('refuses a malformed or duplicated id, or a missing phase', () => {
    expect(() => defineCmsPlugin(def({ upgrades: [{ ...step, id: 'Back_fill' }] }))).toThrow(/must be kebab-case/)
    expect(() => defineCmsPlugin(def({ upgrades: [step, step] }))).toThrow(/share the id "backfill"/)
    expect(() => defineCmsPlugin(def({ upgrades: [{ ...step, phase: 'during' as any }] }))).toThrow(/needs phase/)
    expect(() => defineCmsPlugin(def({ upgrades: [{ ...step, since: 'x' }] }))).toThrow(/since must look like/)
  })

  it('lists tinyzoo\'s steps first, then the plugins\', in registration order', () => {
    const a = defineCmsPlugin(def({ upgrades: [step] }))
    const b = defineCmsPlugin(def({ name: 'blog', upgrades: [step] }))
    expect(allUpgradeSteps([a, b]).map((s) => s.id)).toEqual([...CORE_UPGRADE_STEPS.map((s) => s.id), 'shop:backfill', 'blog:backfill'])
    expect(allUpgradeSteps()).toEqual(CORE_UPGRADE_STEPS)
  })

  it('runs a plugin step once and records it under its namespaced id', async () => {
    const run = vi.fn(async () => {})
    const plugin = defineCmsPlugin(def({ upgrades: [{ ...step, run }] }))
    const sql: [string, unknown[]][] = []
    const ctx = { run: async (text: string, params: unknown[] = []) => { sql.push([text, params]); return [] }, pendingStatements: [], freshInstall: false }
    const done = new Set<string>()
    const steps = pluginUpgradeSteps([plugin])
    expect((await runUpgradeSteps('after', steps, ctx, done)).map((o) => [o.id, o.ran])).toEqual([['shop:backfill', true]])
    expect(sql[0]![1]).toEqual(['shop:backfill', '1.0.0'])
    expect(await runUpgradeSteps('after', steps, ctx, done)).toEqual([]) // recorded: not again
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('records a plugin step without running it on an empty database', async () => {
    const run = vi.fn(async () => {})
    const steps = pluginUpgradeSteps([defineCmsPlugin(def({ upgrades: [{ ...step, run }] }))])
    const ctx = { run: async () => [], pendingStatements: [], freshInstall: true }
    expect((await runUpgradeSteps('after', steps, ctx, new Set())).map((o) => o.ran)).toEqual([false])
    expect(run).not.toHaveBeenCalled()
  })
})

describe('collectPlugins', () => {
  it('reads the `plugins` array and plugins exported by themselves', () => {
    const a = defineCmsPlugin(def())
    const b = defineCmsPlugin(def({ name: 'blog' }))
    const c = defineCmsPlugin(def({ name: 'wiki' }))
    expect(collectPlugins({ plugins: [a, [b]], wiki: c, other: 5 }).map((p) => p.name)).toEqual(['shop', 'blog', 'wiki'])
    expect(collectPlugins({})).toEqual([])
  })

  it('is not fooled by one plugin listed twice, but refuses two with one name', () => {
    const a = defineCmsPlugin(def())
    expect(collectPlugins({ plugins: [a], again: a })).toHaveLength(1)
    expect(() => collectPlugins({ plugins: [a, defineCmsPlugin(def())] })).toThrow(/Two plugins are named "shop"/)
  })

  it('refuses something in `plugins` that is not a plugin', () => {
    expect(() => collectPlugins({ plugins: [{ name: 'x' }] })).toThrow(/takes plugins/)
  })

  it('tells a site that uses a form without the forms plugin how to fix it', () => {
    const Contact = defineForm('contactForm', { label: 'Contact', fields: { email: f.text({ required: true, format: 'email' }) } })
    expect(() => collectPlugins({ Contact })).toThrow(/"contactForm" needs the "forms" plugin, which is not registered: add `export const plugins = \[formsPlugin\(\)\]`/)
    expect(() => buildRegistry({ Contact })).toThrow(/needs the "forms" plugin/)
    expect(collectPlugins({ Contact, plugins: [formsPlugin()] }).map((p) => p.name)).toEqual(['forms'])
  })

  it('does not warn when forms are used through the plugin', () => {
    resetCmsDeprecations()
    defineForm('contactForm', { label: 'Contact', fields: { email: f.text({ required: true, format: 'email' }) } })
    defineFormSettings()
    expect(cmsDeprecations()).toEqual([])
  })
})

describe('buildRegistry with plugins', () => {
  const shop = defineCmsPlugin(def({ entities: [entity('shop_order')], singletons: [defineSingleton('shop_settings', { label: 'Shop', titleField: 'title', fields: { title: f.text() } } as any)] }))

  it('adds the plugin\'s entities like the site\'s own, remembers who owns them', () => {
    const Post = entity('post')
    const reg = buildRegistry({ Post, plugins: [shop] })
    expect(reg.entities.map((e) => e.name)).toEqual(['post', 'shop_order', 'shop_settings'])
    expect(reg.pluginOf.get('shop_order')).toBe('shop')
    expect(reg.pluginOf.has('post')).toBe(false)
    expect(Object.keys(reg.schema)).toEqual(expect.arrayContaining(['shop_order', 'shop_settings', 'post']))
    expect(reg.graph.find((g) => g.name === 'shop_order')!.plugin).toBe('shop')
    expect(reg.graph.find((g) => g.name === 'post')!.plugin).toBeNull()
  })

  it('refuses a site entity that takes a plugin entity\'s name, and two plugins that do', () => {
    expect(() => buildRegistry({ Mine: entity('shop_order'), plugins: [shop] })).toThrow(/"shop_order" of the plugin "shop" is also defined/)
    // (two plugins cannot own one name: the names are prefixed by each plugin's name)
    expect(() => defineCmsPlugin(def({ name: 'blog', entities: [entity('shop_order')] }))).toThrow(/must be named "blog"/)
  })

  it('lets a plugin add to the graph (a note, no "New" button)', () => {
    const noted = defineCmsPlugin(def({
      entities: [entity('shop_order')],
      graph: (e) => (e.name === 'shop_order' ? { create: false, notices: [{ key: 'plugins.shop.note' }] } : undefined),
    }))
    const reg = buildRegistry({ Post: entity('post'), plugins: [noted] })
    expect(reg.graph.find((g) => g.name === 'shop_order')).toMatchObject({ adminCreate: false, notices: [{ key: 'plugins.shop.note' }] })
    expect(reg.graph.find((g) => g.name === 'post')).toMatchObject({ adminCreate: true, notices: [] })
  })

  it('reserves `p` as an entity name (it is the admin path of plugin pages)', () => {
    expect(() => entity('p')).toThrow(/reserved/)
  })
})

describe('planPlugins: what the build registers', () => {
  const home = '/plugins/shop'
  const full = defineCmsPlugin(def({
    entities: [entity('shop_order')],
    components: `${home}/components`,
    fields: { color: { edit: 'ShopColor', cell: 'ShopColorCell' } },
    adminPages: [{ path: '', file: `${home}/pages/index.vue` }, { path: 'orders/:id', file: `${home}/pages/order.vue` }],
    navItems: [{ label: 'Shop', icon: 'i-lucide-store', page: '' }, { label: 'Settings', to: '/admin/shop_settings', group: 'settings', adminOnly: true }],
    serverHandlers: [
      { route: '/ping', handler: `${home}/ping.get.ts` },
      { method: 'post', route: '/orders/:id/ship', access: 'admin', handler: `${home}/ship.post.ts` },
      { route: '/next', contentPath: '_shop/next', access: 'public', handler: `${home}/next.get.ts` },
    ],
    serverPlugins: [`${home}/nitro.ts`],
    i18n: { en: { title: 'Shop' }, cs: { title: 'Obchod' } },
  }))

  it('puts pages, routes and nav items under the plugin\'s own names', () => {
    const plan = planPlugins([full])
    expect(plan.pages.map((p) => p.path)).toEqual(['/admin/p/shop', '/admin/p/shop/orders/:id'])
    expect(plan.pages.map((p) => p.name)).toEqual(['cms-plugin-shop-index', 'cms-plugin-shop-orders-id'])
    expect(plan.handlers.map((h) => `${h.method} ${h.route}`)).toEqual([
      'get /api/cms/_p/shop/ping',
      'post /api/cms/_p/shop/orders/:id/ship',
      'get /api/cms/_p/shop/next',
      'get /api/content/_shop/next',
    ])
    expect(plan.navItems.map((n) => [n.to, n.group, n.adminOnly])).toEqual([['/admin/p/shop', 'content', false], ['/admin/shop_settings', 'settings', true]])
    expect(plan.serverPlugins).toEqual([`${home}/nitro.ts`])
    expect(plan.componentDirs).toEqual([`${home}/components`])
    expect(plan.fields).toEqual({ color: { edit: 'ShopColor', cell: 'ShopColorCell', plugin: 'shop' } })
    expect(plan.messages.shop!.cs).toEqual({ title: 'Obchod' })
    expect(plan.plugins).toEqual([{ name: 'shop', version: '1.0.0' }])
  })

  it('says which file is missing, and whose it is', () => {
    expect(() => planPlugins([full], { exists: (file) => !file.endsWith('ship.post.ts') })).toThrow(/Plugin "shop": server handler "\/orders\/:id\/ship": handler "\/plugins\/shop\/ship.post.ts" does not exist/)
    expect(() => planPlugins([full], { exists: (file) => !file.endsWith('order.vue') })).toThrow(/admin page "orders\/:id": file/)
    expect(() => planPlugins([full], { exists: (file) => file !== `${home}/components` })).toThrow(/components directory/)
  })

  it('refuses two plugins on one content route, or one field type', () => {
    // defineCmsPlugin no longer lets another plugin declare `_shop/…`; registration still checks, for a hand-made object.
    const rival = { ...defineCmsPlugin(def({ name: 'rival', serverHandlers: [{ contentPath: '_rival/next', handler: '/r/next.ts' }] })), serverHandlers: [{ contentPath: '_shop/next', handler: '/r/next.ts' }] } as any
    expect(() => planPlugins([full, rival])).toThrow(/Plugin "rival": GET \/api\/content\/_shop\/next is already served by the plugin "shop"/)
    const fields = defineCmsPlugin(def({ name: 'rival', components: '/r', fields: { color: { edit: 'RivalColor' } } }))
    expect(() => planPlugins([full, fields])).toThrow(/the field type "color" already has renderers from the plugin "shop"/)
  })

  it('refuses a plugin registered twice', () => {
    expect(() => planPlugins([full, full])).toThrow(/Two plugins are named "shop"/)
  })

  it('has nothing to register for no plugins', () => {
    expect(planPlugins([])).toEqual({ pages: [], handlers: [], serverPlugins: [], componentDirs: [], navItems: [], appPlugins: [], dashboardWidgets: [], entityPanels: [], fields: {}, messages: {}, plugins: [] })
  })

  it('plans the forms plugin: its public endpoints keep their address', () => {
    const plan = planPlugins([formsPlugin()])
    expect(plan.handlers.map((h) => `${h.method} ${h.route}`)).toEqual(['get /api/content/_form/:name', 'post /api/content/_form/:name'])
    expect(plan.componentDirs).toHaveLength(1)
    expect(plan.componentDirs[0]).toMatch(/packages\/cms\/forms\/components$/)
    expect(plan.messages.forms!.cs).toHaveProperty('retention')
  })
})

// ── tables, app plugins, home widgets, editor panels ─────────────────────────────
const shopEvents = pgTable('shop_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  kind: text('kind').notNull(),
  at: timestamp('at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
}, (t) => [index('shop_events_at_idx').on(t.at)])
const shopDaily = pgTable('shop_daily', {
  day: date('day').notNull(),
  views: integer('views').notNull().default(0),
}, (t) => [primaryKey({ name: 'shop_daily_pk', columns: [t.day] })])
const TABLES_SOURCE = `export const shopEvents = pgTable('shop_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  kind: text('kind').notNull(),
  at: timestamp('at', { withTimezone: true, mode: 'date', precision: 3 }).notNull().defaultNow(),
}, (t) => [index('shop_events_at_idx').on(t.at)])

export const shopDaily = pgTable('shop_daily', {
  day: date('day').notNull(),
  views: integer('views').notNull().default(0),
}, (t) => [primaryKey({ name: 'shop_daily_pk', columns: [t.day] })])`
const withTables = (over: Partial<CmsPluginDef> = {}) => def({ tables: [shopEvents, shopDaily], tablesSource: TABLES_SOURCE, ...over })

describe('defineCmsPlugin: tables', () => {
  it('takes Drizzle tables named after the plugin, with their source', () => {
    expect(defineCmsPlugin(withTables()).tables).toEqual([shopEvents, shopDaily])
    expect(defineCmsPlugin(def()).tables).toEqual([])
  })

  it('refuses what is not a table, a name outside the namespace, another schema, a table twice', () => {
    expect(() => defineCmsPlugin(def({ tables: [{} as any], tablesSource: 'x' }))).toThrow(/tables takes Drizzle tables made with pgTable/)
    const visits = pgTable('visits', { id: text('id') })
    expect(() => defineCmsPlugin(def({ tables: [visits], tablesSource: 'x' }))).toThrow(/Plugin "shop": the table "visits" must be named "shop" or "shop_…"/)
    const elsewhere = pgSchema('stats').table('shop_x', { id: text('id') })
    expect(() => defineCmsPlugin(def({ tables: [elsewhere], tablesSource: 'x' }))).toThrow(/is in the Postgres schema "stats"/)
    expect(() => defineCmsPlugin(withTables({ tables: [shopEvents, shopEvents] }))).toThrow(/the table "shop_events" is listed twice/)
  })

  it('wants the source with the tables, and only the tables in it', () => {
    expect(() => defineCmsPlugin(def({ tables: [shopEvents] }))).toThrow(/tables need `tablesSource`/)
    expect(() => defineCmsPlugin(def({ tablesSource: TABLES_SOURCE }))).toThrow(/tablesSource is given but tables is empty/)
    expect(() => defineCmsPlugin(withTables({ tables: [shopEvents] }))).toThrow(/exports "shopDaily" \(shop_daily\), which is not one of `tables`/)
    expect(() => defineCmsPlugin(withTables({ tablesSource: TABLES_SOURCE.split('\n\n')[0] }))).toThrow(/has no `export const shopDaily = pgTable\('shop_daily', …\)`/)
    // pasted into schema.ts next to every other table: no helpers of its own, no imports
    expect(() => defineCmsPlugin(withTables({ tablesSource: `const ts = (n) => timestamp(n)\n${TABLES_SOURCE}` }))).toThrow(/may hold only `export const <name> = pgTable/)
    expect(() => defineCmsPlugin(withTables({ tablesSource: `import { sql } from 'drizzle-orm'\n${TABLES_SOURCE}` }))).toThrow(/may hold only/)
  })
})

describe('plugin tables: schema.ts and the registry', () => {
  const shop = defineCmsPlugin(withTables())

  it('writes the source into schema.ts, with the builders it uses imported', () => {
    const src = emitSchema({ Post: entity('post'), plugins: [shop] })
    expect(src).toContain(`// the plugin "shop"\n${TABLES_SOURCE}`)
    const imports = src.split('\n').find((l) => l.includes("from 'drizzle-orm/pg-core'"))!
    expect(imports).toMatch(/\bbigserial\b/)
    expect(imports).toMatch(/\bdate\b/)
    expect(src).not.toContain("from 'drizzle-orm'\n")
    // a site without plugin tables gets the schema.ts it always had
    expect(emitSchema({ Post: entity('post') })).not.toMatch(/bigserial|the plugin/)
  })

  it('imports `sql` when the source uses it, and not a method that shares a builder\'s name', () => {
    const t = pgTable('shop_x', { at: timestamp('at').default(sql`now()`), code: text('code').unique() })
    const p = defineCmsPlugin(def({ tables: [t], tablesSource: "export const shopX = pgTable('shop_x', { at: timestamp('at').default(sql`now()`), code: text('code').unique() })" }))
    const src = emitSchema({ plugins: [p] })
    expect(src).toContain("import { sql } from 'drizzle-orm'")
    expect(src.split('\n').find((l) => l.includes("from 'drizzle-orm/pg-core'"))).not.toMatch(/\bunique\b/)
  })

  it('refuses source that is not the same table as the one the server queries', () => {
    const drifted = defineCmsPlugin(withTables({ tablesSource: TABLES_SOURCE.replace("kind: text('kind').notNull(),", "kind: text('kind'),") }))
    expect(() => emitSchema({ plugins: [drifted] })).toThrow(/Plugin "shop": the table shop_events in tablesSource is not the one in tables \(columns; only in tables: kind text not null; only in tablesSource: kind text\)/)
    const noIndex = defineCmsPlugin(withTables({ tablesSource: TABLES_SOURCE.replace(", (t) => [index('shop_events_at_idx').on(t.at)])", ')') }))
    expect(() => emitSchema({ plugins: [noIndex] })).toThrow(/shop_events .*\(indexes; only in tables: shop_events_at_idx/)
  })

  it('refuses source that does not run (it is plain JavaScript)', () => {
    const typed = defineCmsPlugin(withTables({ tablesSource: TABLES_SOURCE.replace('(t) => [index', '(t: any) => [index') }))
    expect(() => emitSchema({ plugins: [typed] })).toThrow(/Plugin "shop": tablesSource does not run/)
  })

  it('puts the tables in the registry for the plugin\'s server code', () => {
    const reg = buildRegistry({ Post: entity('post'), plugins: [shop] })
    expect(reg.pluginTables.get('shop_events')).toBe(shopEvents)
    expect(reg.pluginTables.get('shop_daily')).toBe(shopDaily)
    expect(reg.schema.shopEvents).toBe(shopEvents)
    expect(buildRegistry({ Post: entity('post') }).pluginTables.size).toBe(0)
  })

  it('refuses a table whose name an entity\'s table already has', () => {
    expect(() => buildRegistry({ Events: entity('shopEvents'), plugins: [shop] })).toThrow(/same name.*the table of "shopEvents" and the table shop_events of the plugin "shop"/)
  })
})

describe('defineCmsPlugin: app plugins', () => {
  it('takes absolute files with where they run, and plans them (default: everywhere)', () => {
    const p = defineCmsPlugin(def({ appPlugins: [{ src: '/plugins/shop/track.ts', mode: 'client' }, { src: '/plugins/shop/provide.ts' }] }))
    expect(planPlugins([p]).appPlugins).toEqual([
      { src: '/plugins/shop/track.ts', mode: 'client', plugin: 'shop' },
      { src: '/plugins/shop/provide.ts', mode: 'all', plugin: 'shop' },
    ])
  })

  it('refuses a relative path, an unknown mode and a missing file', () => {
    expect(() => defineCmsPlugin(def({ appPlugins: [{ src: './track.ts' }] }))).toThrow(/Plugin "shop": appPlugins: ".\/track.ts" must be an absolute path/)
    expect(() => defineCmsPlugin(def({ appPlugins: [{ src: '/t.ts', mode: 'browser' as any }] }))).toThrow(/mode is 'client', 'server' or 'all'/)
    const p = defineCmsPlugin(def({ appPlugins: [{ src: '/plugins/shop/track.ts' }] }))
    expect(() => planPlugins([p], { exists: () => false })).toThrow(/Plugin "shop": app plugin "\/plugins\/shop\/track.ts" does not exist/)
  })
})

describe('defineCmsPlugin: home widgets and editor panels', () => {
  const components = '/plugins/shop/components'

  it('wants component names from the plugin\'s own components directory', () => {
    expect(() => defineCmsPlugin(def({ dashboardWidgets: [{ component: 'ShopWidget' }] }))).toThrow(/dashboardWidgets names a component, so the plugin needs `components`/)
    expect(() => defineCmsPlugin(def({ components, dashboardWidgets: [{ component: 'shop-widget' }] }))).toThrow(/dashboardWidgets: "shop-widget" is not a component name/)
    expect(() => defineCmsPlugin(def({ components, dashboardWidgets: [{ component: 'ShopWidget' }, { component: 'ShopWidget' }] }))).toThrow(/"ShopWidget" is listed twice/)
    expect(() => defineCmsPlugin(def({ components, dashboardWidgets: [{ component: 'ShopWidget', order: Number.NaN }] }))).toThrow(/order must be a number/)
    expect(() => defineCmsPlugin(def({ entityPanels: [{ component: 'ShopPanel', label: 'Sales' }] }))).toThrow(/entityPanels names a component, so the plugin needs `components`/)
    expect(() => defineCmsPlugin(def({ components, entityPanels: [{ component: 'ShopPanel', label: '' }] }))).toThrow(/a panel needs a label/)
    expect(() => defineCmsPlugin(def({ components, entityPanels: [{ component: 'ShopPanel', label: 'Sales', entities: [] }] }))).toThrow(/entities is a list of collection names/)
  })

  it('plans widgets in their order across plugins, and panels for every collection unless named', () => {
    const shop = defineCmsPlugin(def({
      components,
      dashboardWidgets: [{ component: 'ShopSales', order: 20 }, { component: 'ShopStock', adminOnly: true }],
      entityPanels: [{ component: 'ShopPanel', label: { en: 'Sales', cs: 'Prodeje' } }, { component: 'ShopOrderPanel', label: 'Orders', entities: ['post'] }],
    }))
    const stats = defineCmsPlugin(def({ name: 'stats', components: '/plugins/stats/components', dashboardWidgets: [{ component: 'StatsVisitors', order: 10 }] }))
    const plan = planPlugins([shop, stats])
    expect(plan.dashboardWidgets).toEqual([
      { plugin: 'shop', component: 'ShopStock', order: 0, adminOnly: true },
      { plugin: 'stats', component: 'StatsVisitors', order: 10, adminOnly: false },
      { plugin: 'shop', component: 'ShopSales', order: 20, adminOnly: false },
    ])
    expect(plan.entityPanels).toEqual([
      { plugin: 'shop', component: 'ShopPanel', label: { en: 'Sales', cs: 'Prodeje' }, entities: null },
      { plugin: 'shop', component: 'ShopOrderPanel', label: 'Orders', entities: ['post'] },
    ])
  })

  it('refuses two plugins drawing a card or panel with one component (components are global)', () => {
    const shop = defineCmsPlugin(def({ components, dashboardWidgets: [{ component: 'SalesCard' }] }))
    const rival = defineCmsPlugin(def({ name: 'rival', components: '/r', entityPanels: [{ component: 'SalesCard', label: 'Sales' }] }))
    expect(() => planPlugins([shop, rival])).toThrow(/Plugin "rival": the component "SalesCard" is also a widget or panel of the plugin "shop"/)
    // one plugin may use its component for both
    const both = defineCmsPlugin(def({ components, dashboardWidgets: [{ component: 'SalesCard' }], entityPanels: [{ component: 'SalesCard', label: 'Sales' }] }))
    expect(() => planPlugins([both])).not.toThrow()
  })

  it('refuses a panel for a collection the site does not have, or a singleton', () => {
    const panel = (entities: string[]) => defineCmsPlugin(def({ components, entityPanels: [{ component: 'ShopPanel', label: 'Sales', entities }] }))
    expect(() => buildRegistry({ Post: entity('post'), plugins: [panel(['post'])] })).not.toThrow()
    expect(() => buildRegistry({ Post: entity('post'), plugins: [panel(['article'])] })).toThrow(/Plugin "shop": entityPanels "ShopPanel" names the collection "article", which the site does not have/)
    const Settings = defineSingleton('settings', { label: 'Settings', titleField: 'title', fields: { title: f.text() } } as any)
    expect(() => buildRegistry({ Settings, plugins: [panel(['settings'])] })).toThrow(/names "settings", a singleton/)
  })
})

describe('plugin route access', () => {
  const plugin = defineCmsPlugin(def({ serverHandlers: [
    { route: '/ping', handler: '/h.ts' },
    { method: 'post', route: '/orders/:id/ship', access: 'admin', handler: '/h.ts' },
    { route: '/next', contentPath: '_shop/next', access: 'public', handler: '/h.ts' },
  ] }))

  it('matches :param segments, one segment each', () => {
    expect(matchRoute('/a/:id/b', '/a/42/b')).toBe(true)
    expect(matchRoute('/a/:id/b', '/a/42/b?x=1')).toBe(true)
    expect(matchRoute('/a/:id/b', '/a//b')).toBe(false)
    expect(matchRoute('/a/:id', '/a/1/2')).toBe(false)
    expect(matchRoute('/a', '/b')).toBe(false)
  })

  it('applies what each route declares, per method', () => {
    expect(pluginRouteAccess([plugin], 'GET', '/api/cms/_p/shop/ping')).toBe('user')
    expect(pluginRouteAccess([plugin], 'POST', '/api/cms/_p/shop/orders/7/ship')).toBe('admin')
    expect(pluginRouteAccess([plugin], 'GET', '/api/cms/_p/shop/next')).toBe('public')
  })

  it('is closed by default: an address no route declares gets the plugin\'s strictest rule', () => {
    // The shop plugin has an admin route, so anything else in its namespace is admin-only.
    expect(pluginRouteAccess([plugin], 'GET', '/api/cms/_p/shop/secret')).toBe('admin')
    expect(pluginRouteAccess([plugin], 'GET', '/api/cms/_p/shop/orders/7/ship')).toBe('admin') // wrong method
    const open = defineCmsPlugin(def({ name: 'open', serverHandlers: [{ route: '/ping', handler: '/h.ts' }] }))
    expect(pluginRouteAccess([open], 'GET', '/api/cms/_p/open/secret')).toBe('user')
    expect(pluginRouteAccess([plugin], 'GET', '/api/cms/_p/unknown/anything')).toBe('user')
    expect(pluginRouteAccess([], 'GET', '/api/cms/_p/shop/next')).toBe('user')
  })

  it('treats a trailing slash the way the router does (same handler, same rule)', () => {
    expect(pluginRouteAccess([plugin], 'POST', '/api/cms/_p/shop/orders/7/ship/')).toBe('admin')
    expect(pluginRouteAccess([plugin], 'POST', '/api/cms/_p/shop/orders/7/ship//?x=1')).toBe('admin')
    expect(pluginRouteAccess([plugin], 'GET', '/api/cms/_p/shop/next/')).toBe('public')
  })

  it('matches a ** route to everything below it', () => {
    expect(matchRoute('/files/**', '/files/a/b.png')).toBe(true)
    expect(matchRoute('/files/**', '/files')).toBe(true)
    expect(matchRoute('/files/**', '/other/a')).toBe(false)
  })

  it('has no opinion about the rest of the API', () => {
    expect(pluginRouteAccess([plugin], 'GET', '/api/cms/post')).toBeNull()
    expect(pluginRouteAccess([plugin], 'GET', '/api/content/_shop/next')).toBeNull()
  })
})

describe('the example plugin (playground)', () => {
  it('is a valid plugin that brings an entity, a page, routes and a step', () => {
    const p = eventsPlugin()
    expect(p.entities.map((e) => e.name)).toEqual(['events'])
    expect(p.adminPages).toHaveLength(1)
    expect(p.serverHandlers?.map((h) => h.access ?? 'user')).toEqual(['user', 'admin', 'public'])
    expect(pluginUpgradeSteps([p]).map((s) => s.id)).toEqual(['events:backfill-place'])
    expect(() => planPlugins([p])).not.toThrow()
  })
})

describe('the CLI reads the plugins of the site', () => {
  it('`tinyzoo up` and `status` get the steps of the registered plugins after tinyzoo\'s', async () => {
    const steps = await siteUpgradeSteps(playgroundDir)
    expect(steps.map((s) => s.id)).toEqual([...CORE_UPGRADE_STEPS.map((s) => s.id), 'events:backfill-place'])
    expect(() => assertValidSteps(steps)).not.toThrow()
  })

  it('a folder without a cms.config.ts gets tinyzoo\'s steps only', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cms-no-config-'))
    try {
      expect(await siteUpgradeSteps(dir)).toEqual(CORE_UPGRADE_STEPS)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('`status` says whose step is pending, with that owner\'s version', () => {
    const status: MigrationStatus = {
      freshInstall: false, applied: ['0000_init'], pending: [], outOfOrder: [], unknown: 0,
      steps: [
        { id: 'enable-pg-trgm', since: '0.2.0', description: 'Enable pg_trgm', phase: 'before', state: 'pending' },
        { id: 'events:backfill-place', since: '0.1.0', description: 'Events get a place', phase: 'after', state: 'pending' },
      ],
    }
    const { text, clean } = formatStatus(status)
    expect(clean).toBe(false)
    expect(text).toContain('pending  enable-pg-trgm (tinyzoo 0.2.0) — Enable pg_trgm')
    expect(text).toContain('pending  events:backfill-place (events 0.1.0) — Events get a place')
  })
})
