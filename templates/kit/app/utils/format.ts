// Small helpers every template's looks use: addresses, prices, phones, dates, paragraphs.
// Nuxt auto-imports what is exported here. (No imports: the unit specs load this file outside Nuxt.)

/** An address from the content API as the website writes it: the home page (address `home`) is `/`. */
export function siteHref(path: string | null | undefined): string {
  if (!path) return '/'
  // ("/home#program" is "/#program")
  const home = /^\/home\/?([?#].*)?$/.exec(path)
  return home ? `/${home[1] ?? ''}` : path
}

/** Whether a link leaves the website (opens in a new tab). */
export const isExternal = (url: string | null | undefined): boolean => /^https?:\/\//i.test(url ?? '')

/** 19900 → "19 900" with a non-breaking space, the Czech way. */
export const formatPrice = (n: number | string | null | undefined): string => new Intl.NumberFormat('cs-CZ').format(Number(n ?? 0)).replace(/\s/g, '\u00A0')

/** "+420 731 482 906" → "tel:+420731482906" */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`

/** "https://www.instagram.com/johana.loudova/" → "@johana.loudova" */
export function socialHandle(url: string | null | undefined): string {
  const last = (url ?? '').replace(/[?#].*$/, '').split('/').filter(Boolean).pop() ?? ''
  return last && !last.includes('.com') ? `@${last.replace(/^@/, '')}` : 'Instagram'
}

/** A text's paragraphs: an empty line starts a new one. */
export const paragraphs = (text: string | null | undefined): string[] => (text ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

/** The admin's time zone: dates are stored as moments and written as that zone's wall clock. */
export const SITE_TIME_ZONE = 'Europe/Prague'

/** A date as Czech writes it: "22. srpna 2026" (`short`: "8/2026"). */
export function formatDate(iso: string | null | undefined, style: 'long' | 'short' = 'long'): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // (all-day dates are stored at 0:00 in the admin's time zone)
  const parts = new Intl.DateTimeFormat('cs-CZ', { timeZone: SITE_TIME_ZONE, day: 'numeric', month: style === 'long' ? 'long' : 'numeric', year: 'numeric' }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return style === 'long' ? `${get('day')}. ${get('month')} ${get('year')}` : `${get('month')}/${get('year')}`
}

/** The parts of a moment, for a look that sets each its own way. */
export interface DateParts {
  /** "sobota" */
  weekday: string
  /** "19" */
  day: string
  /** "června" (the month as it stands after a day) */
  month: string
  /** "6" */
  monthNumber: string
  /** "2027" */
  year: string
  /** "12.30", the Czech way; "" for midnight (a date without a time) */
  time: string
  /** "19. června 2027" */
  date: string
  /** "2027-06-19T12:30" in the site's time zone, for `<time datetime>` */
  iso: string
}

/** A moment taken apart in the site's language: "sobota", "19", "června", "2027", "12.30". Null when there is none. */
export function dateParts(iso: string | null | undefined, locale = 'cs-CZ'): DateParts | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat(locale, { timeZone: SITE_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const monthNumber = new Intl.DateTimeFormat(locale, { timeZone: SITE_TIME_ZONE, month: 'numeric' }).format(d)
  const hour = String(Number(get('hour')))
  const time = hour === '0' && get('minute') === '00' ? '' : `${hour}.${get('minute')}`
  const pad = (v: string) => v.padStart(2, '0')
  return {
    weekday: get('weekday'), day: get('day'), month: get('month'), monthNumber, year: get('year'), time,
    date: `${get('day')}. ${get('month')} ${get('year')}`,
    iso: `${get('year')}-${pad(monthNumber)}-${pad(get('day'))}${time ? `T${pad(hour)}:${get('minute')}` : ''}`,
  }
}

/** "11.30" → "11:30", for `<time datetime>`; "" when the text is not a time. */
export const timeAttr = (text: string | null | undefined): string => {
  const m = /^\s*(\d{1,2})[.:](\d{2})\s*$/.exec(text ?? '')
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : ''
}

/**
 * A class by the length of a text, for type so large that a long heading needs a smaller size:
 * `byLength(heading, [[12, 'text-[12vw]'], [30, 'text-[8vw]']], 'text-[6vw]')` gives the first
 * class whose limit the text fits, else the last one.
 */
export function byLength(text: string | null | undefined, steps: Array<[max: number, cls: string]>, otherwise: string): string {
  // (without the asterisks of a marked part)
  const n = (text ?? '').replace(/\*/g, '').trim().length
  return steps.find(([max]) => n <= max)?.[1] ?? otherwise
}
