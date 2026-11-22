import type { Locale } from '#shared/templates'
import { cs, type Dictionary } from '../i18n/cs'
import { en } from '../i18n/en'

// The pages speak Czech (the default) and English. A small dictionary and this composable are
// all there is: `t('new.title')`, `t('sites.limit', { max: 3 })`. The choice is kept in a
// cookie, and on the account once someone is signed in.

const DICTIONARIES: Record<Locale, Dictionary> = { cs, en }
export type TKey = keyof Dictionary
export const LOCALES: { code: Locale; label: string }[] = [{ code: 'cs', label: 'Čeština' }, { code: 'en', label: 'English' }]

/** A cookie of its own name: on localhost, cookies are shared across ports. */
export const useLocaleCookie = () => useCookie<Locale | undefined>('tz-cloud-locale', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/' })

export function useLocale() {
  const cookie = useLocaleCookie()
  const locale = computed<Locale>(() => (cookie.value === 'en' ? 'en' : 'cs'))
  async function setLocale(next: Locale) {
    cookie.value = next
    const { user, refresh } = useAccount()
    if (user.value && user.value.locale !== next) {
      await $fetch('/api/account', { method: 'PATCH', body: { locale: next } }).catch(() => {})
      await refresh()
    }
  }
  return { locale, setLocale }
}

export type Translate = (key: TKey, params?: Record<string, string | number>) => string

export function useT(): Translate {
  const { locale } = useLocale()
  return (key, params) => {
    const text = DICTIONARIES[locale.value][key] ?? cs[key] ?? key
    return params ? text.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? '')) : text
  }
}

/** One of two texts of a `{ cs, en }` pair (template names and the like). */
export function useL() {
  const { locale } = useLocale()
  return (pair: Record<Locale, string>) => pair[locale.value] ?? pair.cs
}

/**
 * An API error in the page's language: the server names what went wrong with a code
 * (`data.code`), the dictionary has the words (`error.<code>`).
 */
export function useErrorText() {
  const t = useT()
  const { locale } = useLocale()
  return (err: unknown, fallback: TKey = 'error.generic'): string => {
    const e = err as { data?: { data?: { code?: string; max?: number } }; statusCode?: number }
    const code = e?.data?.data?.code
    const key = code ? (`error.${code}` as TKey) : null
    if (key && key in DICTIONARIES[locale.value]) return t(key, { max: e?.data?.data?.max ?? '' })
    return t(fallback)
  }
}
