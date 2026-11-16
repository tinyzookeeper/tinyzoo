import { resolveText, type LocalizedText } from '../../src/i18n'
import en from '../i18n/en'
import cs from '../i18n/cs'
import de from '../i18n/de'
import type { AdminMessages, MessageKey, PluralMessage } from '../i18n/types'

/**
 * Admin interface language (not content localization).
 *
 * Deliberately not @nuxtjs/i18n: the CMS runs inside the host's app, which may
 * have its own i18n setup with its own routes and locales. This stays out of its way.
 *
 * Locale: the `cms_admin_locale` cookie → the browser's Accept-Language →
 * `cms.admin.defaultLocale` (app.config) → the first available locale.
 */
const catalogs: Record<string, AdminMessages> = { en, cs, de }
export const CMS_ADMIN_LOCALES: Record<string, string> = { cs: 'Čeština', en: 'English', de: 'Deutsch' }

type Params = Record<string, string | number>

function lookup(messages: unknown, key: string): string | PluralMessage | undefined {
  let node: any = messages
  for (const part of key.split('.')) node = node?.[part]
  return typeof node === 'string' || (node && typeof node.other === 'string') ? node : undefined
}

function interpolate(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m))
}

export function useCmsAdminConfig() {
  const appConfig = useAppConfig()
  return computed(() => {
    const admin = ((appConfig.cms as any)?.admin ?? {}) as Record<string, any>
    const locales = ((admin.locales as string[] | undefined) ?? Object.keys(catalogs)).filter((l) => catalogs[l])
    return {
      name: (admin.name as LocalizedText | undefined) ?? 'tinyzoo',
      siteUrl: (admin.siteUrl as string | undefined) ?? '/',
      accent: (admin.accent as string | undefined) ?? 'mono',
      locales: locales.length ? locales : ['en'],
      defaultLocale: (admin.defaultLocale as string | undefined) ?? 'en',
      timeZone: (admin.timeZone as string | undefined) ?? 'Europe/Prague',
    }
  })
}

export function useCmsI18n() {
  const config = useCmsAdminConfig()
  const cookie = useCookie<string | null>('cms_admin_locale', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/' })
  const acceptLanguage = import.meta.server ? useRequestHeaders(['accept-language'])['accept-language'] : undefined

  const locale = useState<string>('cms-admin-locale', () => {
    const { locales, defaultLocale } = config.value
    if (cookie.value && locales.includes(cookie.value)) return cookie.value
    const header = acceptLanguage ?? (import.meta.client ? navigator.languages.join(',') : '')
    for (const part of header.split(',')) {
      const lang = part.split(';')[0]!.trim().toLowerCase().split('-')[0]!
      if (locales.includes(lang)) return lang
    }
    return locales.includes(defaultLocale) ? defaultLocale : locales[0]!
  })

  function setLocale(next: string) {
    if (!config.value.locales.includes(next)) return
    cookie.value = next
    locale.value = next
  }

  /** Translate an interface message. Falls back to English, then to the key itself. */
  function t(key: MessageKey, params?: Params): string {
    const msg = lookup(catalogs[locale.value], key) ?? lookup(en, key)
    if (msg === undefined) return key
    if (typeof msg === 'string') return interpolate(msg, params)
    const count = Number(params?.count ?? 0)
    const category = new Intl.PluralRules(locale.value).select(count) as keyof PluralMessage
    return interpolate(msg[category] ?? msg.other, { ...params, count: formatNumber(count) })
  }

  /** Resolve text a developer wrote in cms.config.ts (string or per-locale map). */
  function tl(text: LocalizedText | undefined | null, fallback = ''): string {
    return resolveText(text, locale.value, [config.value.defaultLocale, 'en']) ?? fallback
  }

  function formatNumber(n: number): string {
    return new Intl.NumberFormat(locale.value).format(n)
  }

  /**
   * Date (and time) in the admin's time zone. A fixed zone — not the server's or the
   * browser's — so the server render and the hydrated page agree.
   */
  function formatDate(value: string | number | Date | null | undefined, opts: { time?: boolean } = { time: true }): string {
    if (value === null || value === undefined || value === '') return ''
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      ...(opts.time ? { timeStyle: 'short' } : {}),
      timeZone: config.value.timeZone,
    }).format(d)
  }

  /** Any part of a date (`{ month: 'short' }`, `{ timeStyle: 'short' }`…) in the admin's time zone. */
  function formatDateWith(value: string | number | Date | null | undefined, options: Intl.DateTimeFormatOptions): string {
    if (value === null || value === undefined || value === '') return ''
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat(locale.value, { ...options, timeZone: config.value.timeZone }).format(d)
  }

  /** "3 hours ago" / "před 3 hodinami". Only call on the client (depends on now). */
  function formatRelative(value: string | number | Date): string {
    const d = value instanceof Date ? value : new Date(value)
    const diff = (d.getTime() - Date.now()) / 1000
    const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
    const steps: [Intl.RelativeTimeFormatUnit, number][] = [['second', 60], ['minute', 60], ['hour', 24], ['day', 7], ['week', 4.35], ['month', 12], ['year', Infinity]]
    let amount = diff
    for (const [unit, size] of steps) {
      if (Math.abs(amount) < size) return rtf.format(Math.round(amount), unit)
      amount /= size
    }
    return formatDate(d)
  }

  /** Admin label of a field from the graph: its `.label()`, else the humanized key. */
  function fieldLabel(field: { key: string; meta?: Record<string, any> } | undefined): string {
    if (!field) return ''
    return tl(field.meta?.label) || humanizeKey(field.key)
  }
  const fieldHelp = (field: { meta?: Record<string, any> } | undefined) => tl(field?.meta?.help) || undefined
  /** Plural / singular names of an entity from the graph. */
  const entityLabel = (e: { name: string; label?: any } | undefined) => (e ? tl(e.label, humanizeKey(e.name)) : '')
  const entitySingular = (e: { name: string; label?: any; labelSingular?: any } | undefined) => (e ? tl(e.labelSingular ?? e.label, humanizeKey(e.name)) : '')

  return {
    locale: readonly(locale), locales: computed(() => config.value.locales), setLocale,
    t, tl, formatNumber, formatDate, formatDateWith, formatRelative,
    fieldLabel, fieldHelp, entityLabel, entitySingular,
  }
}

/** "publishedAt" → "Published at", "hero_image" → "Hero image". */
export function humanizeKey(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
}
