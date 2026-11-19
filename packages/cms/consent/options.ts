import type { CmsAccessUser } from '../src/roles'
import type { CmsRegistry } from '../src/entity'
import type { LocalizedText } from '../src/i18n'
import { CATEGORY_KEY, MAX_COOKIE_DAYS, NECESSARY } from './core/cookie'
import { BUILT_IN_CATEGORIES, categoryField, TEXT_KEYS, type BuiltInCategory, type ConsentCategoryDef, type ConsentServiceDef } from './core/texts'

export type { ConsentCategoryDef, ConsentServiceDef } from './core/texts'

export interface ConsentOptions {
  /**
   * What the banner asks about, besides `necessary` (always on). Default: `['analytics', 'marketing']`.
   * Leave out what the site does not use: a site without ads asks `['analytics']` only. Add
   * categories of your own with a key and localized texts:
   *
   *   categories: ['analytics', { key: 'video', label: { cs: 'Videa', en: 'Videos' }, description: { … } }]
   *
   * Editors can change a category's name and description in the admin; these are the defaults.
   */
  categories?: ('analytics' | 'marketing' | ConsentCategoryDef)[]
  /**
   * The services and cookies behind each category, shown in the settings under it. Keyed by the
   * category: `necessary`, a built-in one or one of the site's own.
   *
   *   services: {
   *     marketing: [{ name: 'Meta Pixel', provider: 'Meta Platforms Ireland Ltd.', purpose: { en: '…' }, cookies: ['_fbp'], duration: { en: '3 months' } }],
   *   }
   *
   * The consent cookie itself (necessary), and the analytics plugin in `consent` or `strict`
   * mode (analytics), are described by the plugins.
   */
  services?: Partial<Record<string, ConsentServiceDef[]>>
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
  /** The site's services per category key. */
  services: Readonly<Record<string, readonly ConsentServiceDef[]>>
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
      // Its texts are fields of the consent settings (`videoLabel`, `videoText`): none may take another's name.
      if (TEXT_KEYS.some((t) => t === categoryField(key!, 'Label') || t === categoryField(key!, 'Text'))) fail(`the category key "${key}" is taken by a text of the banner; choose another.`)
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
    services: resolveServices(opts.services, keys),
    cookieDays,
    keepLogDays,
    localized: !!opts.localized,
    access: opts.access ?? consentReadAccess,
  }
}

const SERVICE_KEYS = new Set(['name', 'provider', 'purpose', 'cookies', 'duration', 'privacyUrl'])
const short = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim() !== '' && v.length <= max

/** `consentPlugin({ services })`, checked: a list per category the site asks about (or necessary), each service complete. */
function resolveServices(input: ConsentOptions['services'], keys: readonly string[]): Record<string, readonly ConsentServiceDef[]> {
  if (input === undefined) return {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('services takes a list of services per category: { marketing: [{ name, purpose, … }] }.')
  const out: Record<string, readonly ConsentServiceDef[]> = {}
  for (const [cat, list] of Object.entries(input!)) {
    if (cat !== NECESSARY && !keys.includes(cat)) fail(`services: "${cat}" is not a category the banner asks about (${[NECESSARY, ...keys].join(', ')}).`)
    if (!Array.isArray(list)) fail(`services.${cat} is a list of services: [{ name, purpose, … }].`)
    out[cat] = Object.freeze(list!.map((s, i) => {
      const at = `services.${cat}[${i}]`
      if (!s || typeof s !== 'object' || Array.isArray(s)) fail(`${at} is { name, purpose, provider?, cookies?, duration?, privacyUrl? }.`)
      for (const k of Object.keys(s)) if (!SERVICE_KEYS.has(k)) fail(`${at}: unknown "${k}" (it takes name, provider, purpose, cookies, duration, privacyUrl).`)
      if (!short(s.name, 100)) fail(`${at} needs a name (up to 100 characters).`)
      if (!isText(s.purpose) || !filledText(s.purpose)) fail(`${at} ("${s.name}") needs a purpose: what it does, a text or one per language.`)
      if (s.provider !== undefined && !short(s.provider, 200)) fail(`${at} ("${s.name}"): provider is a text, up to 200 characters.`)
      if (s.duration !== undefined && !isText(s.duration)) fail(`${at} ("${s.name}"): duration is a text, or one per language ('2 years').`)
      if (s.cookies !== undefined && (!Array.isArray(s.cookies) || !s.cookies.every((c) => short(c, 200) && !/[\s;,]/.test(c)))) {
        fail(`${at} ("${s.name}"): cookies is a list of cookie names (['_ga', '_ga_*']), without spaces, commas or semicolons.`)
      }
      if (s.privacyUrl !== undefined && !(typeof s.privacyUrl === 'string' && /^https?:\/\/[^\s]+$/.test(s.privacyUrl))) fail(`${at} ("${s.name}"): privacyUrl is a full address (https://…).`)
      return Object.freeze({ ...s, ...(s.cookies ? { cookies: Object.freeze([...s.cookies]) as string[] } : {}) })
    }))
  }
  return out
}

const filledText = (v: LocalizedText): boolean => (typeof v === 'string' ? v.trim() !== '' : Object.values(v).some((x) => typeof x === 'string' && x.trim() !== ''))

/** The options of the registered consent plugin, or null when the site does not use it. @internal */
export function consentOptionsOf(reg: Pick<CmsRegistry, 'plugins'>): ResolvedConsentOptions | null {
  const p = reg.plugins.find((x) => x.name === 'consent') as { consent?: ResolvedConsentOptions } | undefined
  return p?.consent ?? null
}
