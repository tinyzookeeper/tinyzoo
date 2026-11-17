// The website's languages and the words it draws itself (headings, buttons, the addresses
// of the news list and the search page). The content is in the CMS; these are the few
// texts that are not. Nuxt auto-imports everything exported here, the seed imports it too.
//
// Add a language: put its code in LANGUAGES (and in `defineLocales` in cms.config.ts), then
// give it an entry in WORDS. A language without one shows the English words.

/** The site's languages as in `defineLocales` of cms.config.ts. The first one is the default: its addresses have no prefix (/o-nas), the others get one (/en/about). */
export const LANGUAGES: string[] = ['cs', 'en']

export interface Words {
  /** The news list: its title, and its address (/aktuality, /en/news) */
  news: string
  newsPath: string
  allNews: string
  noNews: string
  /** The search page: its title, address, field and messages */
  search: string
  searchPath: string
  searchHint: string
  searchPlaceholder: string
  searchTooShort: string
  searchNothing: (q: string) => string
  searchResults: (n: number) => string
  // landmarks, the menu button, the language switcher
  language: string
  mainMenu: string
  footerMenu: string
  breadcrumbs: string
  menu: string
  // pages the CMS has nothing for
  draftPreview: string
  welcomeTitle: string
  welcomeBefore: string
  welcomeAdmin: string
  welcomeAfter: string
  notFoundTitle: string
  notFoundText: string
  errorTitle: string
  errorText: string
  goHome: string
  /** The site's name until the settings have one */
  defaultName: string
}

export const WORDS: Record<string, Words> = {
  cs: {
    news: 'Aktuality', newsPath: 'aktuality', allNews: 'Všechny aktuality', noNews: 'Zatím tu nic není.',
    search: 'Hledat', searchPath: 'hledat', searchHint: 'Hledání', searchPlaceholder: 'Co hledáte?',
    searchTooShort: 'Napište aspoň dvě písmena.',
    searchNothing: (q) => `Na „${q}“ jsme nic nenašli.`,
    searchResults: (n) => `Výsledků: ${n}`,
    language: 'Jazyk', mainMenu: 'Hlavní menu', footerMenu: 'Menu v patičce', breadcrumbs: 'Drobečková navigace', menu: 'Menu',
    draftPreview: 'Náhled konceptu · zatím není na webu',
    welcomeTitle: 'Web je připravený.',
    welcomeBefore: 'V ', welcomeAdmin: 'administraci', welcomeAfter: ' založte stránku s adresou home a poskládejte ji z bloků. Objeví se tady.',
    notFoundTitle: 'Stránka nenalezena', notFoundText: 'Možná se přesunula, nebo je v adrese překlep.',
    errorTitle: 'Něco se pokazilo', errorText: 'Zkuste to prosím za chvíli znovu.',
    goHome: 'Na úvodní stránku', defaultName: 'Web',
  },
  en: {
    news: 'News', newsPath: 'news', allNews: 'All news', noNews: 'No news yet.',
    search: 'Search', searchPath: 'search', searchHint: 'Search', searchPlaceholder: 'What are you looking for?',
    searchTooShort: 'Type at least two letters.',
    searchNothing: (q) => `Nothing found for “${q}”.`,
    searchResults: (n) => `Results: ${n}`,
    language: 'Language', mainMenu: 'Main menu', footerMenu: 'Footer menu', breadcrumbs: 'Breadcrumbs', menu: 'Menu',
    draftPreview: 'Draft preview · not on the website yet',
    welcomeTitle: 'The website is ready.',
    welcomeBefore: 'In the ', welcomeAdmin: 'admin', welcomeAfter: ' create a page with the address home and build it from blocks. It will show up here.',
    notFoundTitle: 'Page not found', notFoundText: 'It may have moved, or the address has a typo.',
    errorTitle: 'Something went wrong', errorText: 'Please try again in a moment.',
    goHome: 'Go to the home page', defaultName: 'Website',
  },
  de: {
    news: 'Neuigkeiten', newsPath: 'neuigkeiten', allNews: 'Alle Neuigkeiten', noNews: 'Noch keine Neuigkeiten.',
    search: 'Suchen', searchPath: 'suche', searchHint: 'Suche', searchPlaceholder: 'Wonach suchen Sie?',
    searchTooShort: 'Geben Sie mindestens zwei Buchstaben ein.',
    searchNothing: (q) => `Zu „${q}“ wurde nichts gefunden.`,
    searchResults: (n) => `Ergebnisse: ${n}`,
    language: 'Sprache', mainMenu: 'Hauptmenü', footerMenu: 'Menü im Fußbereich', breadcrumbs: 'Brotkrumennavigation', menu: 'Menü',
    draftPreview: 'Vorschau eines Entwurfs · noch nicht auf der Website',
    welcomeTitle: 'Die Website ist bereit.',
    welcomeBefore: 'Legen Sie im ', welcomeAdmin: 'Admin-Bereich', welcomeAfter: ' eine Seite mit der Adresse home an und bauen Sie sie aus Blöcken. Sie erscheint hier.',
    notFoundTitle: 'Seite nicht gefunden', notFoundText: 'Sie wurde vielleicht verschoben, oder die Adresse hat einen Tippfehler.',
    errorTitle: 'Etwas ist schiefgelaufen', errorText: 'Bitte versuchen Sie es gleich noch einmal.',
    goHome: 'Zur Startseite', defaultName: 'Website',
  },
}

/** The words of a language (English for one without an entry). */
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS.en!

export const DEFAULT_LANGUAGE: string = LANGUAGES[0]!

/** The language an address is in: its first part when that is one of the other languages (/en/about), else the default. */
export function languageOf(path: string): string {
  const first = path.split('/')[1] ?? ''
  return LANGUAGES.includes(first) && first !== DEFAULT_LANGUAGE ? first : DEFAULT_LANGUAGE
}

/** An address in a language: the default language has none in front, the others have their code (/en/about). */
export const inLanguage = (code: string, path: string): string =>
  code === DEFAULT_LANGUAGE ? path : `/${code}${path === '/' ? '' : path}`

/** The news list in a language (/aktuality, /en/news), and the search page (/hledat, /en/search). */
export const newsPathOf = (code: string): string => inLanguage(code, `/${wordsOf(code).newsPath}`)
export const searchPathOf = (code: string): string => inLanguage(code, `/${wordsOf(code).searchPath}`)

/** How a language is named in its own words (Čeština, English, Deutsch). */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code)
    return name ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : code
  }
  catch { return code }
}

/** An address from the content API as the website writes it: the home page (address `home`) is `/`, or `/en`. */
export function siteHref(path: string): string {
  const others = LANGUAGES.filter((l) => l !== DEFAULT_LANGUAGE).join('|')
  const home = new RegExp(`^((?:/(?:${others}))?)/home$`)
  return (others ? path.replace(home, '$1') : path.replace(/^\/home$/, '')) || '/'
}
