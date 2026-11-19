/**
 * The visitor's choice, as the consent cookie keeps it. Pure: the browser (useConsent, the
 * banner), the consent plugin's endpoint and the analytics plugin's endpoint all read it with
 * these functions, so they cannot disagree. No `import`s of anything server-side.
 *
 *   tz_consent=1.q8Kf2mZ0Ls9xWc4RbT7nYe.3.2026-11-19.analytics:1|marketing:0
 *              │ │                      │ │          └ each category the visitor was asked about: 1 yes, 0 no
 *              │ │                      │ └ the day of the choice (UTC)
 *              │ │                      └ the version of the texts it was given under
 *              │ └ the consent id: 16 random bytes, base64url (the log's key, nothing else)
 *              └ the format of this value
 *
 * `necessary` is never in it: it is always on. Only characters a cookie value may hold
 * (RFC 6265: no comma, semicolon, space or quote), so it needs no encoding.
 */

/** The cookie's name. */
export const CONSENT_COOKIE = 'tz_consent'

/** The format written in front of the value; a value of another format is not read. */
export const CONSENT_FORMAT = '1'

/** The category that is always on. */
export const NECESSARY = 'necessary'

/** 22 characters of base64url: 16 random bytes. */
export const CONSENT_ID = /^[A-Za-z0-9_-]{22}$/

/** A category's key: lowercase letters, digits and `_`, starting with a letter. */
export const CATEGORY_KEY = /^[a-z][a-z0-9_]{0,31}$/

/** The longest a choice is kept: 13 months, what European regulators accept for a consent cookie. */
export const MAX_COOKIE_DAYS = 395

/** What the visitor chose, per category they were asked about (necessary left out). */
export type ConsentChoice = Record<string, boolean>

export interface ConsentCookie {
  id: string
  /** The version of the texts the choice was given under (the consent settings' `version`). */
  version: number
  /** `YYYY-MM-DD`, UTC. */
  date: string
  choice: ConsentChoice
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_VERSION = 1_000_000

/** The cookie's value. */
export function encodeConsent(c: ConsentCookie): string {
  const cats = Object.keys(c.choice).filter((k) => CATEGORY_KEY.test(k) && k !== NECESSARY).sort()
    .map((k) => `${k}:${c.choice[k] ? 1 : 0}`).join('|')
  return [CONSENT_FORMAT, c.id, String(c.version), c.date, cats].join('.')
}

/** The choice in a cookie's value, or null when there is none or it is not one this format reads. */
export function decodeConsent(raw: string | null | undefined): ConsentCookie | null {
  if (typeof raw !== 'string' || raw.length > 1024) return null
  let value = raw
  // A value someone (or a framework) URL-encoded on the way.
  if (value.includes('%')) {
    try { value = decodeURIComponent(value) }
    catch { return null }
  }
  const parts = value.split('.')
  if (parts.length !== 5 || parts[0] !== CONSENT_FORMAT) return null
  const [, id, ver, date, cats] = parts as [string, string, string, string, string]
  if (!CONSENT_ID.test(id) || !/^\d{1,7}$/.test(ver) || !DATE.test(date)) return null
  const version = Number(ver)
  if (version < 1 || version > MAX_VERSION) return null
  const choice: ConsentChoice = {}
  if (cats) {
    for (const item of cats.split('|')) {
      const m = /^([a-z][a-z0-9_]{0,31}):([01])$/.exec(item)
      if (!m || m[1] === NECESSARY) return null
      choice[m[1]!] = m[2] === '1'
    }
  }
  return { id, version, date, choice }
}

/** A new consent id: 16 random bytes as base64url (22 characters). */
export function newConsentId(random: (bytes: Uint8Array) => Uint8Array = (b) => globalThis.crypto.getRandomValues(b)): string {
  const bytes = random(new Uint8Array(16))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** `YYYY-MM-DD` (UTC) of `d`. */
export const consentDate = (d: Date): string => d.toISOString().slice(0, 10)

/** The cookie's `Max-Age` in seconds. */
export const cookieMaxAge = (days: number): number => Math.round(days * 86_400)

/**
 * The `Set-Cookie` header (or `document.cookie` string) for a choice: the whole site, sent on
 * links from elsewhere (Lax) so a visitor arriving from a search is not asked again, and only
 * over HTTPS when `secure`. Readable by the page's script: the banner and `useConsent()` read it.
 */
export function consentCookieString(value: string, opts: { days: number; secure: boolean }): string {
  return `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${cookieMaxAge(opts.days)}; SameSite=Lax${opts.secure ? '; Secure' : ''}`
}

/** The cookie's value in a `Cookie` header (or `document.cookie`), raw. */
export function readConsentCookie(header: string | null | undefined): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const at = part.indexOf('=')
    if (at < 0) continue
    if (part.slice(0, at).trim() === CONSENT_COOKIE) return part.slice(at + 1).trim()
  }
  return null
}

export interface CurrentOptions {
  /** The consent settings' version now: a choice under an older one is asked again. */
  version: number
  /** The categories the site asks about now (necessary left out): a choice without one of them is asked again. */
  categories: readonly string[]
  /** How many days a choice holds. */
  days: number
  now?: Date
}

/**
 * Whether a choice still holds: given under the current texts (or later ones), about every
 * category the site asks about now, and not older than `days`.
 */
export function isCurrent(c: ConsentCookie | null | undefined, opts: CurrentOptions): c is ConsentCookie {
  if (!c) return false
  if (c.version < opts.version) return false
  for (const k of opts.categories) if (k !== NECESSARY && !(k in c.choice)) return false
  const given = Date.parse(`${c.date}T00:00:00Z`)
  const now = (opts.now ?? new Date()).getTime()
  // A day's grace: the date is the day, not the hour, of the choice.
  return Number.isFinite(given) && now - given < (opts.days + 1) * 86_400_000
}

/** Whether a category is allowed by a choice: necessary always, the others when the visitor said yes. */
export function grantedIn(choice: ConsentChoice | null | undefined, category: string): boolean {
  if (category === NECESSARY) return true
  return !!choice && choice[category] === true
}

/**
 * A choice as the browser sends it, checked: one yes or no for each category the site asks
 * about. A category it leaves out is a no; one the site does not ask about is refused (null).
 */
export function normalizeChoice(input: unknown, categories: readonly string[]): ConsentChoice | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const out: ConsentChoice = {}
  const known = new Set(categories.filter((k) => k !== NECESSARY))
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (k === NECESSARY) continue
    if (!known.has(k) || typeof v !== 'boolean') return null
  }
  for (const k of known) out[k] = (input as Record<string, unknown>)[k] === true
  return out
}

export type ConsentAction = 'given' | 'changed' | 'withdrawn'

/** The categories a later choice takes back. */
export function withdrawnFrom(previous: ConsentChoice | null | undefined, next: ConsentChoice): string[] {
  if (!previous) return []
  return Object.keys(previous).filter((k) => previous[k] === true && next[k] !== true).sort()
}

/**
 * What a choice is, for the log:
 *  - `withdrawn`: it takes back at least one category and allows nothing new;
 *  - `given`: the first answer under this consent id, or the answer to being asked again (new texts);
 *  - `changed`: any other later answer.
 */
export function actionOf(previous: { choice: ConsentChoice; version: number } | null | undefined, next: ConsentChoice, version: number): ConsentAction {
  if (!previous) return 'given'
  const taken = withdrawnFrom(previous.choice, next)
  const added = Object.keys(next).some((k) => next[k] === true && previous.choice[k] !== true)
  if (taken.length && !added) return 'withdrawn'
  if (version !== previous.version) return 'given'
  return 'changed'
}

/** How a choice reads in the counts: everything allowed, nothing allowed, or some. */
export function outcomeOf(choice: ConsentChoice): 'all' | 'none' | 'custom' {
  const values = Object.values(choice)
  if (!values.length || values.every(Boolean)) return 'all'
  if (!values.some(Boolean)) return 'none'
  return 'custom'
}
