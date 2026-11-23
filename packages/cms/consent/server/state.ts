import { decodeConsent, CONSENT_COOKIE, isCurrent, type ConsentCookie } from '../core/cookie'
import { resolveTexts, type ConsentCategory, type ConsentTexts } from '../core/texts'
import { consentOptionsOf, type ResolvedConsentOptions } from '../options'
import { analyticsOptionsOf } from '../../analytics/options'

/**
 * What the consent plugin's routes (and the analytics plugin's endpoint) share on one server:
 * the options, and the consent settings (the version and the texts), kept 30 seconds and
 * forgotten when an editor saves them.
 */

const SETTINGS = 'consent_settings'
const SETTINGS_MS = 30_000

/** The plugin's options; 404 when the site does not use it (its routes are not there then anyway). */
export function consentOptions(): ResolvedConsentOptions {
  const opts = consentOptionsOf(useCms().reg)
  if (!opts) throw createError({ statusCode: 404, statusMessage: 'Cookie consent is not set up' })
  return opts
}

interface Cached {
  at: number
  version: number
  row: Record<string, unknown> | null
  translations: Map<string, Record<string, unknown> | null>
}
const cache = siteScoped<{ cached: Cached | null; loading: Promise<Cached> | null }>(() => ({ cached: null, loading: null }))

export function forgetConsentSettings(): void {
  cache().cached = null
}

async function settings(): Promise<Cached> {
  const state = cache()
  if (state.cached && Date.now() - state.cached.at < SETTINGS_MS) return state.cached
  state.loading ??= (async () => {
    const { db, reg } = useCms()
    const e = reg.byName.get(SETTINGS)
    let row: Record<string, unknown> | null = null
    if (e) [row = null] = await db.select().from(e.table).orderBy(e.table.createdAt).limit(1)
    const version = Number(row?.version)
    const fresh: Cached = { at: Date.now(), version: Number.isInteger(version) && version >= 1 ? version : 1, row, translations: new Map() }
    state.cached = fresh
    return fresh
  })().finally(() => { state.loading = null })
  return state.loading
}

/** The version of the texts now: a choice given under an older one is asked again. */
export async function currentConsentVersion(): Promise<number> {
  return (await settings()).version
}

/** What editors wrote in a language: the row's own values (the default language) or that language's translation. */
async function savedIn(locale: string | null): Promise<Record<string, unknown> | null> {
  const s = await settings()
  const { db, reg } = useCms()
  const opts = consentOptions()
  // One language for the whole site, or texts that are not per language: the row speaks for
  // the default language only, and other languages get the standard texts.
  if (!reg.locales || locale === null) return s.row
  if (locale === reg.locales.default) return s.row
  if (!opts.localized || !s.row) return null
  if (!s.translations.has(locale)) {
    const e = reg.byName.get(SETTINGS)!
    const byParent = await translationRows(db, e, [String(s.row.id)], locale, { shown: true })
    s.translations.set(locale, byParent.get(String(s.row.id)) ?? null)
  }
  return s.translations.get(locale) ?? null
}

export interface ConsentConfig {
  version: number
  /** How many days a choice holds. */
  cookieDays: number
  /** The site language the texts are in (null on a site in one language). */
  locale: string | null
  texts: ConsentTexts
  categories: ConsentCategory[]
}

/** The banner's texts and categories for the language a page asks for (`cs`, `en-GB`, or nothing). */
export async function consentConfig(asked: string): Promise<ConsentConfig> {
  const opts = consentOptions()
  const { reg } = useCms()
  const s = await settings()
  const wanted = asked.trim().slice(0, 35)
  let locale: string | null = null
  if (reg.locales) locale = (wanted && closestLocale(reg.locales.locales, wanted)) || reg.locales.default
  const saved = await savedIn(locale)
  // The standard texts follow the site's language, else what the page says its language is.
  // The analytics plugin with a banner describes what it keeps under "analytics".
  const { texts, categories } = resolveTexts(saved, opts.categories, locale ?? (wanted || null), {
    services: opts.services, cookieDays: opts.cookieDays, analyticsMode: analyticsOptionsOf(reg)?.mode ?? null,
  })
  return { version: s.version, cookieDays: opts.cookieDays, locale, texts, categories }
}

/** The visitor's choice in a request's cookie, when it still holds (current texts, every category, not too old). */
export async function currentChoiceOf(event: any): Promise<ConsentCookie | null> {
  const opts = consentOptionsOf(useCms().reg)
  if (!opts) return null
  const cookie = decodeConsent(getCookie(event, CONSENT_COOKIE))
  if (!cookie) return null
  const version = await currentConsentVersion()
  return isCurrent(cookie, { version, categories: opts.keys, days: opts.cookieDays }) ? cookie : null
}

/** Who may see the counts and ask everyone again (the plugin's `access`); 403 for anyone else. */
export function requireConsentReader(event: any) {
  const opts = consentOptions()
  const user = requireCmsUser(event)
  const role = roleOf(user)
  const accessUser = { ...user, email: user.email ?? '', name: user.name ?? user.email ?? '', locale: user.locale ?? null, base: role?.legacy ? null : role?.base ?? null }
  if (!opts.access({ user: accessUser as any })) {
    throw createError({ statusCode: 403, statusMessage: 'The consent counts are for administrators and editors', data: { code: 'consent-access' } })
  }
  return { opts, user }
}
