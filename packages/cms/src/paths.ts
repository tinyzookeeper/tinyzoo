import type { LocalesDef } from './locales'

/**
 * An entry's address on the website, with `:field` placeholders: one template
 * ('/blog/:slug'), or one per language when the address itself is translated
 * ({ cs: '/aktuality/:slug', en: '/news/:slug' }). A language left out of the map
 * has no page for this collection.
 *
 * The language prefix (`defineLocales({ prefix })`, e.g. '/en') is added on top.
 */
export type PathTemplate = string | Record<string, string>

/** The address prefix of a language ('/en'), per `defineLocales({ prefix })`. */
export function sitePrefix(locales: LocalesDef | null, locale: string | null): string {
  if (!locales || !locale || locales.prefix === 'none') return ''
  if (locales.prefix === 'except-default' && locale === locales.default) return ''
  return `/${locale}`
}

/** The template for one language (null: that language has no page). */
export function pathTemplateFor(template: PathTemplate | undefined | null, locale: string | null, locales: LocalesDef | null): string | null {
  if (!template) return null
  if (typeof template === 'string') return template
  return template[locale ?? locales?.default ?? ''] ?? null
}

/** Placeholder keys of a template ('/blog/:slug' → ['slug']); for a map, of every language's. */
export function pathTemplateKeys(template: PathTemplate | undefined | null): string[] {
  if (!template) return []
  const all = typeof template === 'string' ? [template] : Object.values(template)
  return [...new Set(all.flatMap((t) => [...t.matchAll(/:(\w+)/g)].map((m) => m[1]!)))]
}

/** A template filled in from a row ('/blog/:slug' → '/blog/hello'), or null when a part is empty. */
export function fillPathTemplate(template: string, row: Record<string, any>): string | null {
  let ok = true
  const out = template.replace(/:(\w+)/g, (_m, key: string) => {
    const v = row[key]
    if (v === null || v === undefined || v === '') ok = false
    return encodeURIComponent(String(v ?? ''))
  })
  return ok ? out : null
}

/** The full address of a row in one language (prefix included), or null. */
export function sitePath(locales: LocalesDef | null, template: PathTemplate | undefined | null, locale: string | null, row: Record<string, any>): string | null {
  const t = pathTemplateFor(template, locale, locales)
  const filled = t ? fillPathTemplate(t, row) : null
  return filled === null ? null : sitePrefix(locales, locale) + filled
}

/**
 * Per-language templates with the prefix already in front, for the admin's preview:
 * { cs: '/aktuality/:slug', en: '/en/news/:slug' }; without languages, { '': '/blog/:slug' }.
 */
export function prefixedTemplates(template: PathTemplate | undefined | null, locales: LocalesDef | null): Record<string, string> | null {
  if (!template) return null
  if (!locales) return typeof template === 'string' ? { '': template } : null
  const out: Record<string, string> = {}
  for (const l of locales.locales) {
    const t = pathTemplateFor(template, l, locales)
    if (t) out[l] = sitePrefix(locales, l) + t
  }
  return out
}

/** Configuration errors of a template: a map needs languages, and only known ones. */
export function pathTemplateProblem(template: PathTemplate | undefined | null, locales: LocalesDef | null): string | null {
  if (!template || typeof template === 'string') return null
  if (!locales) return 'has an address per language, but no languages are defined (defineLocales)'
  const unknown = Object.keys(template).filter((l) => !locales.locales.includes(l))
  if (unknown.length) return `has an address for unknown language${unknown.length > 1 ? 's' : ''} ${unknown.join(', ')}`
  if (!template[locales.default]) return `needs an address for the default language "${locales.default}"`
  for (const t of Object.values(template)) if (typeof t !== 'string' || !t.startsWith('/')) return `has an address that does not start with "/" (${String(t)})`
  return null
}
