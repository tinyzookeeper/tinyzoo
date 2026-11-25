// A website's address: the slug. It becomes a host name (<slug>.localhost, <slug>.pushbase.app),
// a database name (tzc_<slug>) and a folder name, so the rules are strict and the same everywhere:
// the browser checks as you type, the server checks again, and the hosting drivers refuse
// anything that does not pass before it reaches SQL or a path.

export const SLUG_MIN = 3
export const SLUG_MAX = 40

/** Names that mean something else on the platform, or would mislead as an address. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'www', 'admin', 'api', 'app', 'console', 'login', 'logout', 'signup', 'register', 'account',
  'mail', 'email', 'smtp', 'ftp', 'cloud', 'status', 'demo', 'docs', 'help', 'support', 'blog',
  'keeper', 'tinyzoo', 'tiny-zoo', 'pushbase', 'localhost', 'new', 'sites', 'site', 'static',
  'assets', 'cdn', 'media', 'files', 'test', 'staging', 'dev', 'root', 'system', 'internal',
  'billing', 'pay', 'shop-admin', 'dashboard', 'null', 'undefined',
])

export type SlugProblem = 'empty' | 'short' | 'long' | 'chars' | 'edges' | 'reserved'

/**
 * More reserved names, from a setting (NUXT_RESERVED_SLUGS): names separated by commas or
 * spaces. They are the names under the sites' domain that lead somewhere else: a website that
 * is not made here, or an address the service itself used. The list changes as such websites
 * come and go, so it is a setting of the deployment and not part of the code. The server checks
 * it (GET /api/slug, and again when a website is made); the browser learns it from there.
 */
export function parseReservedSlugs(value: unknown): ReadonlySet<string> {
  const parts = Array.isArray(value) ? value.map(String) : String(value ?? '').split(/[\s,]+/)
  return new Set(parts.map((name) => name.trim().toLowerCase()).filter(Boolean))
}

const SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * What is wrong with a slug, or null when it may be used (whether it is free is another question).
 * `alsoReserved`: the deployment's own reserved names (parseReservedSlugs), where they are known.
 */
export function slugProblem(slug: string, alsoReserved?: ReadonlySet<string>): SlugProblem | null {
  if (typeof slug !== 'string' || slug.length === 0) return 'empty'
  if (/[^a-z0-9-]/.test(slug)) return 'chars'
  if (slug.length < SLUG_MIN) return 'short'
  if (slug.length > SLUG_MAX) return 'long'
  // A dash only between letters or digits: never first, last or doubled.
  if (!SHAPE.test(slug)) return 'edges'
  if (RESERVED_SLUGS.has(slug) || alsoReserved?.has(slug)) return 'reserved'
  return null
}

export const isValidSlug = (slug: string): boolean => slugProblem(slug) === null

/** The slug, or an error: for code that is about to put it into SQL or a path. */
export function assertSlug(slug: string): string {
  const problem = slugProblem(slug)
  if (problem) throw new Error(`Not a valid site address: ${JSON.stringify(slug)} (${problem})`)
  return slug
}

/** Letters without their accents ("Pekařství U Žlutého koně" → "Pekarstvi U Zluteho kone"). */
function plain(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[łŁ]/g, 'l').replace(/[øØ]/g, 'o').replace(/[đĐ]/g, 'd')
}

/** Cut to the longest allowed length without ending in a dash. */
function fit(slug: string): string {
  return slug.slice(0, SLUG_MAX).replace(/-+$/, '')
}

/**
 * An address suggested from the site's name: lower-case, a–z, 0–9 and dashes. A name too short
 * for an address, or a reserved one, gets "-web" added; a name with nothing usable gives ''.
 */
export function suggestSlug(name: string): string {
  let slug = fit(plain(String(name ?? '')).toLowerCase().replace(/&/g, ' a ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
  if (!slug) return ''
  if (slug.length < SLUG_MIN || RESERVED_SLUGS.has(slug)) slug = fit(`${slug}-web`)
  return isValidSlug(slug) ? slug : ''
}

/** What someone types into the address field, tidied as they type (accents, capitals, spaces), never longer than allowed. */
export function tidySlugInput(text: string): string {
  return plain(String(text ?? '')).toLowerCase().replace(/[\s_.]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').replace(/^-+/, '').slice(0, SLUG_MAX)
}

/**
 * The first free address near `base`: itself, then base-2, base-3 … (cut so the number fits).
 * Null when `base` is not a usable address or nothing is free within `tries`.
 */
export async function firstFreeSlug(base: string, isTaken: (slug: string) => boolean | Promise<boolean>, tries = 20): Promise<string | null> {
  if (!isValidSlug(base)) return null
  if (!(await isTaken(base))) return base
  for (let n = 2; n < tries + 2; n++) {
    const suffix = `-${n}`
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '')}${suffix}`
    if (isValidSlug(candidate) && !(await isTaken(candidate))) return candidate
  }
  return null
}

export const DATABASE_PREFIX = 'tzc_'

/**
 * The site's database: tzc_<slug>, dashes as underscores (a slug has no underscore, so two
 * slugs never share one). `prefix` is for a second cloud app on the same Postgres server (the
 * scripts' own): it must start with tzc_ and stay short enough for a 63-character name.
 */
export function databaseNameFor(slug: string, prefix: string = DATABASE_PREFIX): string {
  if (!/^tzc_([a-z0-9]+_)?$/.test(prefix) || prefix.length > 16) throw new Error(`Not a usable database prefix: ${JSON.stringify(prefix)}`)
  return `${prefix}${assertSlug(slug).replace(/-/g, '_')}`
}

/** An SQL identifier in double quotes. Only for names made by databaseNameFor. */
export function quoteIdent(name: string): string {
  if (!/^[a-z0-9_]{1,63}$/.test(name)) throw new Error(`Not a safe identifier: ${JSON.stringify(name)}`)
  return `"${name}"`
}
