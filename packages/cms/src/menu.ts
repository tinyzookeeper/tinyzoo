// The admin's menu: what sits where. Three layers, each on top of the one before:
//  1. where things go by themselves (the forms' messages and plugins' pages beside Home; collections
//     under "Content"; pages, the site's globals and the media library under "Website"; plugins'
//     settings, redirects, the team, privacy and "About" behind "Settings"),
//  2. what the site says in cms.config.ts (`defineAdminMenu`),
//  3. what an administrator arranged in the admin, for everyone (kept in cms_state).
// Whatever a layer does not mention keeps the place the layer before gave it, so a collection
// added later never goes missing.
import type { LocalizedText } from './i18n'

/**
 * Rows that are not a collection or a global: the forms' messages, the media library, the team, privacy, "About".
 *
 * @internal
 */
export const CMS_ADMIN_MENU_BUILTINS: readonly CmsAdminMenuBuiltin[] = ['@forms', '@media', '@team', '@privacy', '@about']
/** A built-in row of the admin's menu, as `defineAdminMenu` names it. */
export type CmsAdminMenuBuiltin = '@forms' | '@media' | '@team' | '@privacy' | '@about'

/**
 * The groups whose names the admin brings itself.
 *
 * @internal
 */
export const CMS_ADMIN_MENU_GROUPS = ['content', 'website'] as const

/**
 * One row of the menu in `defineAdminMenu`: a collection or global (what `defineEntity`,
 * `defineSingleton`, `definePages`… return, or its name), one of the built-in rows
 * (`'@forms'`, `'@media'`, `'@team'`, `'@privacy'`, `'@about'`), or the admin address of a
 * plugin's page (`'/admin/p/analytics'`).
 */
export type CmsAdminMenuItem = { name: string } | CmsAdminMenuBuiltin | (string & {})

export interface CmsAdminMenuInput {
  /** The rows beside "Home", above the groups. By default the forms' messages, then plugins' pages. */
  home?: CmsAdminMenuItem[]
  /**
   * The groups, in this order. `content` and `website` have their names built in; any other
   * group brings its `label`.
   */
  groups?: Record<string, CmsAdminMenuItem[] | { label: LocalizedText; items: CmsAdminMenuItem[] }>
  /** The rows behind "Settings". */
  settings?: CmsAdminMenuItem[]
  /** The order of the forms on the messages page (`defineForm`). Forms not listed follow, by name. */
  forms?: CmsAdminMenuItem[]
}

/** What `defineAdminMenu` returns (export it from cms.config.ts). */
export interface CmsAdminMenuDef {
  /** @internal */
  __cms: 'adminMenu'
  home: string[] | null
  groups: { id: string; label: LocalizedText | null; items: string[] }[] | null
  settings: string[]
  forms: string[]
}

/**
 * The menu as it is drawn: every row's key, in its place.
 *
 * @internal
 */
export interface CmsAdminMenuLayout {
  home: string[]
  groups: { id: string; label: LocalizedText | null; items: string[] }[]
  settings: string[]
  /** The forms (their collections' names), in the order of the messages page. */
  forms: string[]
}

/**
 * An arrangement an administrator saved: the rows of each place, by key.
 *
 * @internal
 */
export interface CmsAdminMenuSaved {
  home: string[]
  groups: Record<string, string[]>
  settings: string[]
}

/**
 * A row the site has, and where it goes when nobody says otherwise.
 *
 * @internal
 */
export interface CmsAdminMenuSource {
  key: string
  place: 'home' | 'content' | 'website' | 'settings'
}

const keyOf = (item: CmsAdminMenuItem, where: string): string => {
  const key = typeof item === 'string' ? item : item?.name
  if (typeof key !== 'string' || !key) throw new Error(`defineAdminMenu: ${where} holds something that is not a collection, a global, a built-in row or an admin address.`)
  return key
}

/**
 * The admin's menu for this site: which rows sit beside Home, the groups and their order, and
 * what goes behind "Settings". Export the result from cms.config.ts. Rows it does not mention
 * keep their usual place, and an administrator can still rearrange the menu in the admin.
 *
 *   export const menu = defineAdminMenu({
 *     groups: {
 *       content: [News, Album, Course],
 *       website: [Page, Navigation, SiteSettings, '@media'],
 *     },
 *     settings: [Redirect],
 *     forms: [EnrolmentForm, ContactForm],
 *   })
 */
export function defineAdminMenu(input: CmsAdminMenuInput): CmsAdminMenuDef {
  const seen = new Map<string, string>()
  const keys = (items: CmsAdminMenuItem[] | undefined, where: string) => (items ?? []).map((item) => {
    const key = keyOf(item, where)
    const before = seen.get(key)
    if (before) throw new Error(`defineAdminMenu: "${key}" is listed twice (${before === where ? where : `${before} and ${where}`}).`)
    seen.set(key, where)
    return key
  })
  const groups = input.groups
    ? Object.entries(input.groups).map(([id, value]) => {
        if (!/^[a-z][a-zA-Z0-9]*$/.test(id)) throw new Error(`defineAdminMenu: the group "${id}" needs a simple name (letters and digits, starting with a lowercase letter).`)
        const builtin = (CMS_ADMIN_MENU_GROUPS as readonly string[]).includes(id)
        const label = Array.isArray(value) ? null : value.label ?? null
        if (!builtin && !label) throw new Error(`defineAdminMenu: the group "${id}" needs a label: { label: { en: '…' }, items: […] }. Only "content" and "website" have theirs built in.`)
        return { id, label, items: keys(Array.isArray(value) ? value : value.items, `groups.${id}`) }
      })
    : null
  const home = input.home ? keys(input.home, 'home') : null
  const settings = keys(input.settings, 'settings')
  // The forms' order is its own list: a form may be named there and nowhere else.
  const formsSeen = new Set<string>()
  const forms = (input.forms ?? []).map((item) => {
    const key = keyOf(item, 'forms')
    if (formsSeen.has(key)) throw new Error(`defineAdminMenu: "${key}" is listed twice (forms).`)
    formsSeen.add(key)
    return key
  })
  return { __cms: 'adminMenu', home, groups, settings, forms }
}

/** @internal */
export function isAdminMenu(v: unknown): v is CmsAdminMenuDef {
  return !!v && typeof v === 'object' && (v as any).__cms === 'adminMenu'
}

/**
 * Checks a site's `defineAdminMenu` against what the site has. Throws with what to change.
 *
 * @internal
 */
export function checkAdminMenu(def: CmsAdminMenuDef, entities: { name: string; preset?: string | null }[]): void {
  const byName = new Map(entities.map((e) => [e.name, e]))
  const builtins = CMS_ADMIN_MENU_BUILTINS as readonly string[]
  const check = (key: string, where: string) => {
    // A plugin's page (an admin address) is checked when the menu is drawn: the pages are known to the app, not here.
    if (key.startsWith('/')) return
    if (key.startsWith('@')) {
      if (!builtins.includes(key)) throw new Error(`defineAdminMenu: ${where} names "${key}", which is not a built-in row. The built-in rows are ${builtins.join(', ')}.`)
      return
    }
    const e = byName.get(key)
    if (!e) throw new Error(`defineAdminMenu: ${where} names "${key}", which the site does not have.`)
    if (e.preset === 'form') throw new Error(`defineAdminMenu: ${where} names the form "${key}". The forms share one row, '@forms'; list them under "forms" to set their order.`)
  }
  for (const key of def.home ?? []) check(key, 'home')
  for (const g of def.groups ?? []) for (const key of g.items) check(key, `groups.${g.id}`)
  for (const key of def.settings) check(key, 'settings')
  for (const key of def.forms) {
    const e = byName.get(key)
    if (!e) throw new Error(`defineAdminMenu: forms names "${key}", which the site does not have.`)
    if (e.preset !== 'form') throw new Error(`defineAdminMenu: forms names "${key}", which is not a form (defineForm).`)
  }
}

/**
 * The rows a site has, each with the place it takes by itself, in the order they take there.
 * `entities`: the admin graph's entries. `pages`: the pages plugins add to the menu.
 *
 * @internal
 */
export function menuSources(
  entities: { name: string; singleton?: boolean; preset?: string | null; plugin?: string | null; tree?: unknown }[],
  pages: { to: string; group: 'content' | 'settings' }[] = [],
): { sources: CmsAdminMenuSource[]; forms: string[] } {
  const forms = entities.filter((e) => !e.singleton && e.preset === 'form').map((e) => e.name)
  // Settings: what a plugin brought to configure itself, the forms' settings, redirects.
  const toSettings = (e: (typeof entities)[number]) => (e.singleton ? !!e.plugin || e.preset === 'formSettings' : e.preset === 'redirects')
  const toWebsite = (e: (typeof entities)[number]) => !!e.singleton || !!e.tree || e.name === 'page'
  const rest = entities.filter((e) => e.preset !== 'form')
  const sources: CmsAdminMenuSource[] = [
    ...(forms.length ? [{ key: '@forms', place: 'home' as const }] : []),
    ...pages.filter((p) => p.group === 'content').map((p) => ({ key: p.to, place: 'home' as const })),
    ...rest.filter((e) => !toSettings(e) && !toWebsite(e)).map((e) => ({ key: e.name, place: 'content' as const })),
    ...rest.filter((e) => !toSettings(e) && toWebsite(e)).sort((a, b) => Number(!!a.singleton) - Number(!!b.singleton)).map((e) => ({ key: e.name, place: 'website' as const })),
    { key: '@media', place: 'website' },
    ...rest.filter(toSettings).map((e) => ({ key: e.name, place: 'settings' as const })),
    ...pages.filter((p) => p.group === 'settings').map((p) => ({ key: p.to, place: 'settings' as const })),
    { key: '@team', place: 'settings' },
    { key: '@privacy', place: 'settings' },
    { key: '@about', place: 'settings' },
  ]
  return { sources, forms }
}

/**
 * The menu of a site: its rows by themselves, then the site's `defineAdminMenu`, then an
 * administrator's saved arrangement. Rows that no longer exist are dropped, a row named twice
 * keeps its first place, and every row the site has ends up somewhere.
 *
 * @internal
 */
export function resolveMenu(
  site: { sources: CmsAdminMenuSource[]; forms: string[] },
  def?: CmsAdminMenuDef | null,
  saved?: CmsAdminMenuSaved | null,
): CmsAdminMenuLayout {
  const known = new Map(site.sources.map((s) => [s.key, s]))
  const forms = [...new Set([...(def?.forms ?? []).filter((k) => site.forms.includes(k)), ...site.forms])]

  // Layers 1 + 2: the site's own layout, everything unmentioned in its usual place.
  const placed = new Set<string>()
  const take = (keys: string[]) => keys.filter((k) => known.has(k) && !placed.has(k) && !!placed.add(k))
  const base: CmsAdminMenuLayout = {
    home: take(def?.home ?? []),
    groups: (def?.groups ?? []).map((g) => ({ id: g.id, label: g.label, items: take(g.items) })),
    settings: take(def?.settings ?? []),
    forms,
  }
  const group = (layout: CmsAdminMenuLayout, id: string) => {
    let g = layout.groups.find((x) => x.id === id)
    if (!g) {
      g = { id, label: null, items: [] }
      // "Content" goes before "Website" when the site named neither.
      const at = id === 'content' ? layout.groups.findIndex((x) => x.id === 'website') : -1
      if (at < 0) layout.groups.push(g)
      else layout.groups.splice(at, 0, g)
    }
    return g
  }
  for (const s of site.sources) {
    if (placed.has(s.key)) continue
    placed.add(s.key)
    if (s.place === 'home') base.home.push(s.key)
    else if (s.place === 'settings') base.settings.push(s.key)
    else group(base, s.place).items.push(s.key)
  }
  if (!saved) return base

  // Layer 3: the administrator's arrangement, in the site's groups. What it does not hold
  // (a new collection, a group the site no longer has) stays where the site's layout has it.
  const moved = new Set<string>()
  const pick = (keys: unknown) => (Array.isArray(keys) ? keys : []).filter((k): k is string => typeof k === 'string' && known.has(k) && !moved.has(k) && !!moved.add(k))
  const out: CmsAdminMenuLayout = {
    home: pick(saved.home),
    groups: base.groups.map((g) => ({ id: g.id, label: g.label, items: pick(saved.groups?.[g.id]) })),
    settings: pick(saved.settings),
    forms,
  }
  for (const key of base.home) if (!moved.has(key)) out.home.push(key)
  for (const g of base.groups) for (const key of g.items) if (!moved.has(key)) group(out, g.id).items.push(key)
  for (const key of base.settings) if (!moved.has(key)) out.settings.push(key)
  return out
}
