import type { CmsAccessUser } from '../src/roles'
import type { CmsRegistry } from '../src/entity'
import type { LocalizedText } from '../src/i18n'
import { CATEGORY_KEY, MAX_COOKIE_DAYS, NECESSARY } from './core/cookie'
import { BUILT_IN_CATEGORIES, type BuiltInCategory, type ConsentCategoryDef } from './core/texts'

export type { ConsentCategoryDef } from './core/texts'

export interface ConsentOptions {
  /**
   * What the banner asks about, besides `necessary` (always on). Default: `['analytics', 'marketing']`.
   * Leave out what the site does not use: a site without ads asks `['analytics']` only. Add
   * categories of your own with a key and localized texts:
   *
   *   categories: ['analytics', { key: 'video', label: { cs: 'Videa', en: 'Videos' }, description: { … } }]
   */
  categories?: ('analytics' | 'marketing' | ConsentCategoryDef)[]
  /**
   * Days a visitor's choice holds before they are asked again (default 365, at most 395:
   * 13 months, what European regulators accept for a consent cookie).
   */
  cookieDays?: number
  /**
   * Days the consent log keeps a record (default 1095: three years). See docs/consent.md for
   * why; set it to what the site's privacy policy says.
   */
  keepLogDays?: number
  /**
   * The banner's texts per language, in the admin. Set it on a site with `defineLocales`, so
   * editors write each language's texts; a site in one language leaves it out.
   */
  localized?: boolean
  /** Who sees the consent counts and may ask everyone again. Default: administrators and editors. */
  access?: (ctx: { user: CmsAccessUser }) => boolean
}

/** The options with their defaults, as the server reads them. @internal */
export interface ResolvedConsentOptions {
  categories: readonly (BuiltInCategory | ConsentCategoryDef)[]
  /** The keys of the categories the visitor chooses (necessary left out). */
  keys: readonly string[]
  cookieDays: number
  keepLogDays: number
  localized: boolean
  access: (ctx: { user: CmsAccessUser }) => boolean
}

/** @internal */
export const consentReadAccess = ({ user }: { user: CmsAccessUser }): boolean => {
  const base = user?.base ?? user?.role
  return base === 'admin' || base === 'editor'
}

const fail = (message: string): never => {
  throw new Error(`Plugin "consent": ${message}`)
}

const isText = (v: unknown): v is LocalizedText => typeof v === 'string'
  || (!!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'string'))

/** @internal */
export function resolveConsentOptions(opts: ConsentOptions = {}): ResolvedConsentOptions {
  const categories = opts.categories ?? ['analytics', 'marketing']
  if (!Array.isArray(categories) || !categories.length) fail('categories needs at least one category to ask about (necessary is always on and not asked).')
  const keys: string[] = []
  for (const c of categories) {
    const key = typeof c === 'string' ? c : c?.key
    if (key === NECESSARY) fail('necessary is always on; it is not listed.')
    if (typeof c === 'string' && !(BUILT_IN_CATEGORIES as readonly string[]).includes(c)) fail(`"${c}" is not a built-in category (analytics, marketing); give your own as { key, label, description }.`)
    if (typeof c !== 'string') {
      if (!c || typeof c !== 'object') fail(`categories takes 'analytics', 'marketing' or { key, label, description }, got ${JSON.stringify(c)}.`)
      if (typeof key !== 'string' || !CATEGORY_KEY.test(key)) fail(`category key ${JSON.stringify(key)}: lowercase letters, digits and _, starting with a letter.`)
      if ((BUILT_IN_CATEGORIES as readonly string[]).includes(key!)) fail(`the category "${key}" is built in: list it as '${key}'.`)
      if (!isText(c.label)) fail(`category "${key}" needs a label (a text, or one per language).`)
      if (c.description !== undefined && !isText(c.description)) fail(`category "${key}": description is a text, or one per language.`)
    }
    if (keys.includes(key!)) fail(`the category "${key}" is listed twice.`)
    keys.push(key!)
  }
  const cookieDays = opts.cookieDays ?? 365
  if (!Number.isInteger(cookieDays) || cookieDays < 1 || cookieDays > MAX_COOKIE_DAYS) fail(`cookieDays must be a whole number of days from 1 to ${MAX_COOKIE_DAYS} (13 months), got ${JSON.stringify(opts.cookieDays)}.`)
  const keepLogDays = opts.keepLogDays ?? 1095
  if (!Number.isInteger(keepLogDays) || keepLogDays < cookieDays || keepLogDays > 3650) {
    fail(`keepLogDays must be a whole number of days from cookieDays (${cookieDays}: a record must outlive the choice it proves) to 3650, got ${JSON.stringify(opts.keepLogDays)}.`)
  }
  if (opts.access !== undefined && typeof opts.access !== 'function') fail('access must be a function ({ user }) => boolean.')
  return {
    categories: categories.map((c) => (typeof c === 'string' ? c : Object.freeze({ ...c }))) as ResolvedConsentOptions['categories'],
    keys,
    cookieDays,
    keepLogDays,
    localized: !!opts.localized,
    access: opts.access ?? consentReadAccess,
  }
}

/** The options of the registered consent plugin, or null when the site does not use it. @internal */
export function consentOptionsOf(reg: Pick<CmsRegistry, 'plugins'>): ResolvedConsentOptions | null {
  const p = reg.plugins.find((x) => x.name === 'consent') as { consent?: ResolvedConsentOptions } | undefined
  return p?.consent ?? null
}
