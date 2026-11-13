import type { LocalizedText } from './i18n'

/**
 * The languages content is written in (not the admin interface language).
 *
 *   export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en', 'de'] })
 *
 * The default language lives in each entry's own row; the others are translations
 * of the fields marked `.localized()`, falling back to the default when missing.
 */
export interface LocalesDef {
  __cms: 'locales'
  default: string
  locales: string[]
  /** How each language is named in the admin, e.g. { cs: 'Čeština', en: 'English' }. */
  labels: Record<string, LocalizedText>
}

const KNOWN: Record<string, string> = {
  cs: 'Čeština', sk: 'Slovenčina', en: 'English', de: 'Deutsch', pl: 'Polski', hu: 'Magyar',
  fr: 'Français', it: 'Italiano', es: 'Español', nl: 'Nederlands', uk: 'Українська', ru: 'Русский',
}
const CODE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/

export function defineLocales(def: { default: string; locales: string[]; labels?: Record<string, LocalizedText> }): LocalesDef {
  const locales = [...new Set(def.locales)]
  for (const l of locales) if (!CODE.test(l)) throw new Error(`Invalid locale code "${l}" (use e.g. "cs", "en", "pt-BR").`)
  if (!locales.includes(def.default)) throw new Error(`The default locale "${def.default}" must be one of the locales.`)
  // Default first, the rest in the order given.
  const ordered = [def.default, ...locales.filter((l) => l !== def.default)]
  const labels: Record<string, LocalizedText> = {}
  for (const l of ordered) labels[l] = def.labels?.[l] ?? KNOWN[l.split('-')[0]!] ?? l
  return { __cms: 'locales', default: def.default, locales: ordered, labels }
}
