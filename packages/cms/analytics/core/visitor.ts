import { createHash, randomBytes } from 'node:crypto'

/**
 * Who a visitor is, without a cookie: a hash of the day's salt, the site, the address and the
 * browser's user agent. The salt is random and replaced every day (the old one is deleted), so
 *  - the same browser gets the same id all day, which is what counting visitors and visits needs;
 *  - tomorrow it gets another, which cannot be linked to today's;
 *  - nobody can go back from the id to the address: the salt that made it no longer exists.
 * The address itself is never stored.
 */

/** Hex characters kept from the hash: 64 bits, plenty for a day of one site's visitors. */
const ID_LENGTH = 16

export function visitorHash(salt: string, site: string, ip: string, userAgent: string): string {
  return createHash('sha256').update(`${salt}\n${site}\n${ip}\n${userAgent}`).digest('hex').slice(0, ID_LENGTH)
}

/** A new random salt (32 bytes, hex). */
export function newSalt(): string {
  return randomBytes(32).toString('hex')
}

/** A random id for a visit (one per session; not derived from the visitor). */
export function newSessionId(): string {
  return randomBytes(9).toString('base64url')
}

/** The salt as it is kept in `cms_state` (key `analytics:salt`): one row, replaced every day. */
export interface StoredSalt {
  day: string
  salt: string
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The salt to use on `today` (`YYYY-MM-DD` in the site's time zone), given the one stored.
 * A salt of an earlier day is replaced, never reused (`changed`: write it, replacing the old
 * one). A salt already stored for a later day (another server whose clock passed midnight a
 * moment sooner) is used as it is: going back would delete the newer one.
 */
export function saltFor(stored: unknown, today: string, make: () => string = newSalt): { salt: StoredSalt; changed: boolean } {
  const s = stored as Partial<StoredSalt> | null | undefined
  const valid = !!s && typeof s.salt === 'string' && s.salt.length >= 32 && typeof s.day === 'string' && DAY.test(s.day)
  if (valid && s!.day! >= today) return { salt: { day: s!.day!, salt: s!.salt! }, changed: false }
  return { salt: { day: today, salt: make() }, changed: true }
}

const dayFormats = new Map<string, Intl.DateTimeFormat>()

/** The calendar day of `d` in `timeZone`, as `YYYY-MM-DD`. */
export function localDay(d: Date, timeZone: string): string {
  let f = dayFormats.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    dayFormats.set(timeZone, f)
  }
  return f.format(d)
}

/** Is `tz` a time zone this runtime knows? */
export function validTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  }
  catch {
    return false
  }
}
