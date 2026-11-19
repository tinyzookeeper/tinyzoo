/**
 * The banner's texts and its categories. The standard texts in Czech, English and German are
 * used wherever editors left a text of the consent settings empty. Pure: the server and the
 * tests read it; no `import`s of anything server-side.
 */
import type { LocalizedText } from '../../src/i18n'
import { NECESSARY } from './cookie'

/** A text in one language, or one per language (`{ cs: 'Statistické', en: 'Statistics' }`). */
export type ConsentText = LocalizedText

/** The texts of the banner and the settings dialog, in one language. */
export interface ConsentTexts {
  title: string
  body: string
  acceptAll: string
  rejectAll: string
  settings: string
  save: string
  settingsTitle: string
  privacyLabel: string
  /** The privacy policy's address ('' = no link). */
  privacyUrl: string
  /** Next to the switch that cannot be switched off. */
  alwaysOn: string
  close: string
}

/** The texts of the built-in categories, in one language. */
export interface CategoryTexts { label: string; description: string }

/** What the website gets for one category. */
export interface ConsentCategory {
  key: string
  label: string
  description: string
  /** Always on (necessary): shown, not switchable. */
  required: boolean
}

export const BUILT_IN_CATEGORIES = [NECESSARY, 'analytics', 'marketing'] as const
export type BuiltInCategory = (typeof BUILT_IN_CATEGORIES)[number]

interface LanguageDefaults { texts: ConsentTexts; categories: Record<BuiltInCategory, CategoryTexts> }

/**
 * The standard texts. Plain words, no legalese: what the cookies are for, that the visitor
 * chooses, and that they can change their mind.
 */
export const DEFAULT_TEXTS: Record<'cs' | 'en' | 'de', LanguageDefaults> = {
  cs: {
    texts: {
      title: 'Cookies na tomto webu',
      body: 'Některé cookies web potřebuje, aby fungoval. Ostatní používáme jen s vaším souhlasem. Které povolíte, vyberete v nastavení. Svou volbu můžete kdykoli změnit.',
      acceptAll: 'Přijmout vše',
      rejectAll: 'Odmítnout vše',
      settings: 'Nastavení',
      save: 'Uložit volbu',
      settingsTitle: 'Nastavení cookies',
      privacyLabel: 'Ochrana osobních údajů',
      privacyUrl: '',
      alwaysOn: 'Vždy zapnuté',
      close: 'Zavřít',
    },
    categories: {
      necessary: { label: 'Nezbytné', description: 'Bez nich web nefunguje. Pamatují si například tuto volbu.' },
      analytics: { label: 'Statistické', description: 'Pomáhají nám pochopit, jak se web používá, abychom ho mohli zlepšovat.' },
      marketing: { label: 'Marketingové', description: 'Slouží k zobrazování reklamy, která vás může zajímat, i na jiných webech, a k měření jejích výsledků.' },
    },
  },
  en: {
    texts: {
      title: 'Cookies on this website',
      body: 'The website needs some cookies to work. Others we only use if you agree. Choose which ones under Settings. You can change your mind at any time.',
      acceptAll: 'Accept all',
      rejectAll: 'Reject all',
      settings: 'Settings',
      save: 'Save my choice',
      settingsTitle: 'Cookie settings',
      privacyLabel: 'Privacy policy',
      privacyUrl: '',
      alwaysOn: 'Always on',
      close: 'Close',
    },
    categories: {
      necessary: { label: 'Necessary', description: 'The website does not work without them. They remember this choice, for example.' },
      analytics: { label: 'Statistics', description: 'Help us understand how the website is used, so we can make it better.' },
      marketing: { label: 'Marketing', description: 'Used to show you ads you may find interesting, also on other websites, and to measure how they work.' },
    },
  },
  de: {
    texts: {
      title: 'Cookies auf dieser Website',
      body: 'Einige Cookies braucht die Website, damit sie funktioniert. Andere verwenden wir nur mit Ihrer Zustimmung. Welche Sie erlauben, wählen Sie unter Einstellungen. Sie können Ihre Wahl jederzeit ändern.',
      acceptAll: 'Alle akzeptieren',
      rejectAll: 'Alle ablehnen',
      settings: 'Einstellungen',
      save: 'Auswahl speichern',
      settingsTitle: 'Cookie-Einstellungen',
      privacyLabel: 'Datenschutz',
      privacyUrl: '',
      alwaysOn: 'Immer aktiv',
      close: 'Schließen',
    },
    categories: {
      necessary: { label: 'Notwendig', description: 'Ohne sie funktioniert die Website nicht. Sie merken sich zum Beispiel diese Auswahl.' },
      analytics: { label: 'Statistik', description: 'Helfen uns zu verstehen, wie die Website genutzt wird, damit wir sie verbessern können.' },
      marketing: { label: 'Marketing', description: 'Dienen dazu, Ihnen Werbung zu zeigen, die Sie interessieren könnte, auch auf anderen Websites, und ihre Wirkung zu messen.' },
    },
  },
}

/** The language of the standard texts for a site language (`cs-CZ` → cs); English for one it has none in. */
export function defaultsLanguage(locale: string | null | undefined): keyof typeof DEFAULT_TEXTS {
  const lang = String(locale ?? '').toLowerCase().split(/[-_]/)[0]
  return lang === 'cs' || lang === 'de' ? lang : lang === 'sk' ? 'cs' : 'en'
}

/** The keys of the consent settings' text fields: `title`, …, and `<category>Label` / `<category>Text` for the built-in ones. */
export const TEXT_KEYS = ['title', 'body', 'acceptAll', 'rejectAll', 'settings', 'save', 'settingsTitle', 'privacyLabel', 'privacyUrl'] as const
export const categoryField = (key: BuiltInCategory, part: 'Label' | 'Text') => `${key}${part}`

const filled = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

/** A text of the site's options in a language: the language, its base (`cs` for `cs-CZ`), English, then any. */
export function pickText(text: ConsentText | undefined, locale: string | null | undefined): string {
  if (typeof text === 'string') return text
  if (!text) return ''
  const lang = String(locale ?? '').split(/[-_]/)[0]!
  return text[String(locale)] ?? text[lang] ?? text.en ?? Object.values(text)[0] ?? ''
}

/** A category of the site's own (`consentPlugin({ categories })`). */
export interface ConsentCategoryDef {
  /** Lowercase letters, digits and `_` (`preferences`, `video_embeds`). */
  key: string
  label: LocalizedText
  description?: LocalizedText
}

/**
 * The texts and categories in a language: what editors wrote (`saved`, the settings' values in
 * that language), else the standard text of that language.
 */
export function resolveTexts(
  saved: Record<string, unknown> | null | undefined,
  categories: readonly (BuiltInCategory | ConsentCategoryDef)[],
  locale: string | null | undefined,
): { texts: ConsentTexts; categories: ConsentCategory[] } {
  const d = DEFAULT_TEXTS[defaultsLanguage(locale)]
  const s = saved ?? {}
  const texts = { ...d.texts }
  for (const k of TEXT_KEYS) if (filled(s[k])) texts[k] = (s[k] as string).trim()
  const builtIn = (key: BuiltInCategory): ConsentCategory => {
    const label = s[categoryField(key, 'Label')]
    const text = s[categoryField(key, 'Text')]
    return {
      key,
      label: filled(label) ? label.trim() : d.categories[key].label,
      description: filled(text) ? text.trim() : d.categories[key].description,
      required: key === NECESSARY,
    }
  }
  const list: ConsentCategory[] = [builtIn(NECESSARY)]
  for (const c of categories) {
    if (typeof c === 'string') list.push(builtIn(c))
    else list.push({ key: c.key, label: pickText(c.label, locale), description: pickText(c.description, locale), required: false })
  }
  return { texts, categories: list }
}
