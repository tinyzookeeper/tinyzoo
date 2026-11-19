/**
 * The banner's texts and its categories. The standard texts in Czech, English and German are
 * used wherever editors left a text of the consent settings empty. Pure: the server and the
 * tests read it; no `import`s of anything server-side.
 */
import type { LocalizedText } from '../../src/i18n'
import type { CmsConsentService, CmsConsentTexts } from '../../src/frontend'
import { CONSENT_COOKIE, NECESSARY } from './cookie'

/** A text in one language, or one per language (`{ cs: 'Statistické', en: 'Statistics' }`). */
export type ConsentText = LocalizedText

/** The texts of the banner and the settings dialog, in one language. */
export type ConsentTexts = CmsConsentTexts

/** A service and its cookies, in one language. */
export type ConsentService = CmsConsentService

/** The texts of the built-in categories, in one language. */
export interface CategoryTexts { label: string; description: string }

/** What the website gets for one category (the config endpoint); `useConsent()` adds whether it is granted. */
export interface ConsentCategory {
  key: string
  label: string
  description: string
  /** Always on (necessary): shown, not switchable. */
  required: boolean
  services: ConsentService[]
}

/**
 * A service (a tool, an embed, the site itself) and the cookies it sets, as a site lists it in
 * `consentPlugin({ services })`. Shown in the settings under its category.
 */
export interface ConsentServiceDef {
  /** `YouTube`, `Google Analytics`, `Shopping cart`. */
  name: string
  /** Who runs it: `Google Ireland Limited`. */
  provider?: string
  /** What it does, in plain words. */
  purpose: LocalizedText
  /** The names of the cookies it sets (`_ga`, `_ga_*`). */
  cookies?: string[]
  /** How long they are kept: `{ en: '2 years', cs: '2 roky' }`. */
  duration?: LocalizedText
  /** Its own privacy policy, a full address. */
  privacyUrl?: string
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
      services: 'Služby a cookies',
      provider: 'Poskytovatel',
      cookies: 'Cookies',
      duration: 'Doba uložení',
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
      services: 'Services and cookies',
      provider: 'Provider',
      cookies: 'Cookies',
      duration: 'Kept for',
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
      services: 'Dienste und Cookies',
      provider: 'Anbieter',
      cookies: 'Cookies',
      duration: 'Speicherdauer',
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

/** The keys of the consent settings' text fields (besides `<category>Label` / `<category>Text` for each category). */
export const TEXT_KEYS = ['title', 'body', 'acceptAll', 'rejectAll', 'settings', 'save', 'settingsTitle', 'privacyLabel', 'privacyUrl'] as const

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
  /** Its name; editors can change it in the admin (Settings → Cookie banner). */
  label: LocalizedText
  /** What it is for; editors can change it in the admin. */
  description?: LocalizedText
}

/** The consent settings' fields of a category's name and description: `analyticsLabel`, `videoText`. */
export const categoryField = (key: string, part: 'Label' | 'Text') => `${key}${part}`

/** `365 days` in a language of the standard texts. */
export function daysText(days: number, lang: keyof typeof DEFAULT_TEXTS): string {
  if (lang === 'cs') return `${days} ${days === 1 ? 'den' : days >= 2 && days <= 4 ? 'dny' : 'dní'}`
  if (lang === 'de') return `${days} ${days === 1 ? 'Tag' : 'Tage'}`
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

const THIS_SITE = { cs: 'Tento web', en: 'This website', de: 'Diese Website' } as const

/** The services the plugins describe by themselves: the consent cookie, and the analytics plugin with a banner. */
export function builtInServices(
  lang: keyof typeof DEFAULT_TEXTS,
  o: { cookieDays: number; analyticsMode?: string | null; asks: readonly string[] },
): Record<string, ConsentService[]> {
  const days = daysText(o.cookieDays, lang)
  const own = (name: Record<keyof typeof DEFAULT_TEXTS, string>, purpose: Record<keyof typeof DEFAULT_TEXTS, string>, cookies: string[]): ConsentService => ({
    name: name[lang], provider: THIS_SITE[lang], purpose: purpose[lang], cookies, duration: cookies.length ? days : '', privacyUrl: '',
  })
  const out: Record<string, ConsentService[]> = {
    [NECESSARY]: [own(
      { cs: 'Souhlas s cookies', en: 'Cookie consent', de: 'Cookie-Einwilligung' },
      {
        cs: 'Pamatuje si vaši volbu v této liště: které kategorie jste povolili, kdy a náhodný identifikátor souhlasu.',
        en: 'Remembers your choice in this banner: which categories you allowed, when, and a random identifier of your consent.',
        de: 'Merkt sich Ihre Auswahl in diesem Banner: welche Kategorien Sie erlaubt haben, wann, und eine zufällige Kennung Ihrer Einwilligung.',
      },
      [CONSENT_COOKIE],
    )],
  }
  const stats = { cs: 'Návštěvnost webu', en: 'Website statistics', de: 'Website-Statistik' }
  if (o.asks.includes('analytics') && o.analyticsMode === 'consent') {
    out.analytics = [own(stats, {
      cs: `Počítá návštěvy bez cookies. S vaším souhlasem ukládá k vašim návštěvám náhodný identifikátor souhlasu z cookie ${CONSENT_COOKIE}, abychom viděli, jak často se lidé vracejí.`,
      en: `Counts visits without cookies. With your consent, it keeps the random identifier of your consent from the cookie ${CONSENT_COOKIE} with your visits, so we can see how often people come back.`,
      de: `Zählt Besuche ohne Cookies. Mit Ihrer Einwilligung speichert sie die zufällige Kennung Ihrer Einwilligung aus dem Cookie ${CONSENT_COOKIE} zu Ihren Besuchen, damit wir sehen, wie oft Menschen zurückkommen.`,
    }, [CONSENT_COOKIE])]
  }
  else if (o.asks.includes('analytics') && o.analyticsMode === 'strict') {
    out.analytics = [own(stats, {
      cs: 'Počítá vaše návštěvy, až když statistiky povolíte. Vlastní cookie nenastavuje.',
      en: 'Counts your visits only once you allow statistics. It sets no cookie of its own.',
      de: 'Zählt Ihre Besuche erst, wenn Sie Statistik erlauben. Sie setzt kein eigenes Cookie.',
    }, [])]
  }
  return out
}

/** A service of the site's options in a language. */
export function resolveService(s: ConsentServiceDef, locale: string | null | undefined): ConsentService {
  return {
    name: s.name,
    provider: s.provider ?? '',
    purpose: pickText(s.purpose, locale),
    cookies: [...(s.cookies ?? [])],
    duration: pickText(s.duration, locale),
    privacyUrl: s.privacyUrl ?? '',
  }
}

export interface ResolveOptions {
  /** The site's services per category key (`consentPlugin({ services })`). */
  services?: Readonly<Record<string, readonly ConsentServiceDef[]>>
  /** Days a choice holds: the consent cookie's duration. Default 365. */
  cookieDays?: number
  /** The analytics plugin's mode, when it is registered: it describes its use of the cookie. */
  analyticsMode?: string | null
}

/**
 * The texts and categories in a language: what editors wrote (`saved`, the settings' values in
 * that language), else the standard text of that language (a category of the site's own: the
 * text of its options). Each category comes with its services: the ones the plugins describe by
 * themselves first, then the site's.
 */
export function resolveTexts(
  saved: Record<string, unknown> | null | undefined,
  categories: readonly (BuiltInCategory | ConsentCategoryDef)[],
  locale: string | null | undefined,
  opts: ResolveOptions = {},
): { texts: ConsentTexts; categories: ConsentCategory[] } {
  const lang = defaultsLanguage(locale)
  const d = DEFAULT_TEXTS[lang]
  const s = saved ?? {}
  const texts = { ...d.texts }
  for (const k of TEXT_KEYS) if (filled(s[k])) texts[k] = (s[k] as string).trim()
  const asks = categories.map((c) => (typeof c === 'string' ? c : c.key))
  const auto = builtInServices(lang, { cookieDays: opts.cookieDays ?? 365, analyticsMode: opts.analyticsMode, asks })
  const services = (key: string): ConsentService[] => [
    ...(auto[key] ?? []),
    ...(opts.services?.[key] ?? []).map((x) => resolveService(x, locale)),
  ]
  const make = (key: string, fallback: CategoryTexts): ConsentCategory => {
    const label = s[categoryField(key, 'Label')]
    const text = s[categoryField(key, 'Text')]
    return {
      key,
      label: filled(label) ? label.trim() : fallback.label,
      description: filled(text) ? text.trim() : fallback.description,
      required: key === NECESSARY,
      services: services(key),
    }
  }
  const list: ConsentCategory[] = [make(NECESSARY, d.categories.necessary)]
  for (const c of categories) {
    if (typeof c === 'string') list.push(make(c, d.categories[c]))
    else list.push(make(c.key, { label: pickText(c.label, locale), description: pickText(c.description, locale) }))
  }
  return { texts, categories: list }
}
