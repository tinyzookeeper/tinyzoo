/**
 * Cookie consent, as a plugin (`tinyzoo/consent`): a banner that asks visitors which cookies
 * the website may use, a settings dialog with one switch per category, the choice kept in a
 * first-party cookie, and a log that shows a consent was given.
 *
 *   // cms.config.ts
 *   import { consentPlugin } from 'tinyzoo/consent'
 *
 *   export const plugins = [consentPlugin()]
 *   // app.vue: <CmsConsent />; anywhere: const { granted } = useConsent()
 *
 * What the plugin brings:
 *  - `<CmsConsent>`: the banner and the settings dialog, for the website (a component);
 *  - `useConsent()`: the visitor's choice for the site's own code: `granted('marketing')`,
 *    `open()` for a "Cookie settings" link, `onChange(cb)` (an auto-imported composable);
 *  - `GET /api/content/_consent/config` (the texts) and `POST /api/content/_consent/choice`
 *    (writes the log and sets the cookie);
 *  - the settings `consent_settings`, where editors write the banner's texts and ask everyone again;
 *  - the table `consent_log`, made by the site's next `tinyzoo generate` migration, kept `keepLogDays`;
 *  - the Cookie consent page in the admin: how visitors choose, in counts only.
 *
 * The docs: docs/consent.md.
 */
import { defineSingleton, type CmsEntity } from '../src/entity'
import { f } from '../src/fields'
import type { LocalizedText } from '../src/i18n'
import { defineCmsPlugin, pluginFile, type CmsPlugin } from '../src/plugin'
import pkg from '../package.json'
import { NECESSARY } from './core/cookie'
import type { BuiltInCategory } from './core/texts'
import { CONSENT_MESSAGES } from './messages'
import { type ConsentOptions, type ResolvedConsentOptions, resolveConsentOptions } from './options'
import { consentRetention } from './retention'
import { CONSENT_TABLES_SOURCE, consentLog } from './tables'

export type { ConsentOptions, ConsentCategoryDef } from './options'
export { consentLog } from './tables'

/** The consent settings' name. @internal */
export const CONSENT_SETTINGS = 'consent_settings'

/** Administrators and editors write the banner's texts (and roles built on them). */
const editors = ({ user }: { user: { base?: string | null; role?: string } }) => {
  const base = user?.base ?? user?.role
  return base === 'admin' || base === 'editor'
}

const EMPTY_HELP: LocalizedText = {
  en: 'Leave it empty for the standard text.',
  cs: 'Prázdné pole: použije se standardní text.',
  de: 'Leer lassen für den Standardtext.',
}

const CATEGORY_NAMES: Record<BuiltInCategory, LocalizedText> = {
  necessary: { en: 'Necessary', cs: 'Nezbytné', de: 'Notwendig' },
  analytics: { en: 'Statistics', cs: 'Statistické', de: 'Statistik' },
  marketing: { en: 'Marketing', cs: 'Marketingové', de: 'Marketing' },
}

/**
 * The consent settings: the banner's texts (empty ones use the standard text in the visitor's
 * language) and the version of the texts. Raising the version asks everyone again. Its text
 * fields follow the categories the site asks about, and are per language with `localized`.
 *
 * @internal
 */
export function consentSettingsEntity(opts: Pick<ResolvedConsentOptions, 'categories' | 'localized'>): CmsEntity {
  const text = (label: LocalizedText, o: { multiline?: boolean; link?: boolean; group: LocalizedText }) => {
    let d: any = f.text({ ...(o.multiline ? { multiline: true, max: 2000 } : { max: 200 }), ...(o.link ? { format: 'link' as const } : {}) })
      .optional().label(label).group(o.group)
    if (!o.link) d = d.help(EMPTY_HELP)
    return opts.localized ? d.localized() : d
  }
  const banner: LocalizedText = { en: 'Banner', cs: 'Lišta', de: 'Banner' }
  const buttons: LocalizedText = { en: 'Buttons', cs: 'Tlačítka', de: 'Schaltflächen' }
  const cats: LocalizedText = { en: 'Categories', cs: 'Kategorie', de: 'Kategorien' }
  const privacy: LocalizedText = { en: 'Privacy policy', cs: 'Ochrana osobních údajů', de: 'Datenschutz' }
  const fields: Record<string, any> = {
    title: text({ en: 'Heading', cs: 'Nadpis', de: 'Überschrift' }, { group: banner }),
    body: text({ en: 'Text', cs: 'Text', de: 'Text' }, { multiline: true, group: banner }),
    acceptAll: text({ en: '"Accept all" button', cs: 'Tlačítko „Přijmout vše“', de: 'Schaltfläche „Alle akzeptieren“' }, { group: buttons }),
    rejectAll: text({ en: '"Reject all" button', cs: 'Tlačítko „Odmítnout vše“', de: 'Schaltfläche „Alle ablehnen“' }, { group: buttons }),
    settings: text({ en: '"Settings" button', cs: 'Tlačítko „Nastavení“', de: 'Schaltfläche „Einstellungen“' }, { group: buttons }),
    save: text({ en: '"Save my choice" button', cs: 'Tlačítko „Uložit volbu“', de: 'Schaltfläche „Auswahl speichern“' }, { group: buttons }),
    settingsTitle: text({ en: 'Heading of the settings', cs: 'Nadpis nastavení', de: 'Überschrift der Einstellungen' }, { group: buttons }),
  }
  const builtIn = [NECESSARY, ...opts.categories.filter((c): c is BuiltInCategory => typeof c === 'string')] as BuiltInCategory[]
  for (const key of builtIn) {
    const name = CATEGORY_NAMES[key]
    const of = (en: string, cs: string, de: string): LocalizedText => ({
      en: `${en} (${(name as Record<string, string>).en})`, cs: `${cs} (${(name as Record<string, string>).cs})`, de: `${de} (${(name as Record<string, string>).de})`,
    })
    fields[`${key}Label`] = text(of('Name', 'Název', 'Name'), { group: cats })
    fields[`${key}Text`] = text(of('Description', 'Popis', 'Beschreibung'), { multiline: true, group: cats })
  }
  fields.privacyLabel = text({ en: 'Link text', cs: 'Text odkazu', de: 'Linktext' }, { group: privacy })
  fields.privacyUrl = text({ en: 'Address of the privacy policy', cs: 'Adresa zásad ochrany osobních údajů', de: 'Adresse der Datenschutzerklärung' }, { link: true, group: privacy })
    .help({ en: 'A page of this website (/privacy) or a full address. Empty: no link.', cs: 'Stránka tohoto webu (/ochrana-udaju) nebo celá adresa. Prázdné: bez odkazu.', de: 'Eine Seite dieser Website (/datenschutz) oder eine volle Adresse. Leer: kein Link.' })
  fields.version = f.number({ int: true, min: 1, max: 1_000_000 }).withDefault(1)
    .label({ en: 'Version of the texts', cs: 'Verze textů', de: 'Version der Texte' })
    .help({
      en: 'Raise it when what the cookies are used for changes: everyone is asked again. "Ask everyone again" on the Cookie consent page does it.',
      cs: 'Zvyšte ji, když se změní, k čemu cookies slouží: všech se web zeptá znovu. Udělá to i „Zeptat se všech znovu“ na stránce Souhlas s cookies.',
      de: 'Erhöhen Sie sie, wenn sich ändert, wofür Cookies verwendet werden: Alle werden erneut gefragt. „Alle erneut fragen“ auf der Seite Cookie-Einwilligung erledigt das.',
    })
  return defineSingleton(CONSENT_SETTINGS, {
    label: { en: 'Cookie banner', cs: 'Lišta cookies', de: 'Cookie-Banner' },
    description: {
      en: 'What the cookie banner says. Empty texts use the standard ones, in the visitor\'s language.',
      cs: 'Co říká lišta s cookies. Prázdné texty použijí standardní znění v jazyce návštěvníka.',
      de: 'Was das Cookie-Banner sagt. Leere Texte verwenden den Standardtext in der Sprache der Besucher.',
    },
    icon: 'i-lucide-cookie',
    titleField: 'title',
    fields,
    access: { read: editors as any, update: editors as any },
  } as any) as unknown as CmsEntity
}

/** The plugin, with its options for the server (`consentOptionsOf(reg)`). @internal */
export type ConsentPlugin = CmsPlugin & { readonly consent: ResolvedConsentOptions }

/** The plugin: the banner, `useConsent()`, the cookie, the log and its counts. */
export function consentPlugin(options: ConsentOptions = {}): CmsPlugin {
  const resolved = resolveConsentOptions(options)
  const file = (p: string) => pluginFile(import.meta.url, p)
  const plugin = defineCmsPlugin({
    name: 'consent',
    version: pkg.version,
    singletons: [consentSettingsEntity(resolved)],
    tables: [consentLog],
    tablesSource: CONSENT_TABLES_SOURCE,
    // <CmsConsent> for the website, useConsent() for the site's code.
    components: file('./components'),
    composables: file('./composables'),
    appPlugins: [{ src: file('./app/consent.ts'), mode: 'all' }],
    serverPlugins: [file('./server/startup.ts')],
    serverHandlers: [
      { method: 'get', contentPath: '_consent/config', handler: file('./server/config.get.ts') },
      { method: 'post', contentPath: '_consent/choice', handler: file('./server/choice.post.ts') },
      { method: 'get', route: '/stats', handler: file('./server/stats.get.ts') },
      { method: 'post', route: '/ask-again', handler: file('./server/askAgain.post.ts') },
    ],
    adminPages: [{ path: '', file: file('./pages/index.vue') }],
    navItems: [{ label: { en: 'Cookie consent', cs: 'Souhlas s cookies', de: 'Cookie-Einwilligung' }, icon: 'i-lucide-cookie', page: '', group: 'settings' }],
    hooks: { retention: consentRetention(resolved) },
    i18n: CONSENT_MESSAGES,
  })
  return Object.freeze({ ...plugin, consent: resolved }) as ConsentPlugin
}
