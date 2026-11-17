/**
 * Text shown in the admin that a developer writes in `cms.config.ts` (entity and
 * field labels, help, descriptions). Either one string for every admin language,
 * or one string per locale code:
 *
 *   label: 'Posts'
 *   label: { en: 'Posts', cs: 'Články' }
 *
 * This is the *admin interface* language — not content localization.
 */
export type LocalizedText = string | Readonly<Record<string, string>>

/**
 * Resolve a LocalizedText for a locale: exact locale → its language ('cs-CZ' → 'cs')
 * → each fallback in order → the first value present. Undefined in, undefined out.
 *
 * @internal
 */
export function resolveText(text: LocalizedText | undefined | null, locale: string, fallbacks: readonly string[] = ['en']): string | undefined {
  if (text == null) return undefined
  if (typeof text === 'string') return text
  const lang = locale.split('-')[0]!
  for (const key of [locale, lang, ...fallbacks]) {
    const v = text[key]
    if (v) return v
  }
  return Object.values(text).find(Boolean)
}
