// The website's own words that every template needs (what is not content: "Menu", the empty
// site, the errors), per language. A template spreads them into its own words:
//
//   export const words = { ...KIT_WORDS.cs, …the template's own… }

export interface KitWords {
  menu: string
  close: string
  mainMenu: string
  mobileMenu: string
  footerMenu: string
  contact: string
  phone: string
  email: string
  sending: string
  draftPreview: string
  /** The preview's line when an owner's colour is shown lighter or darker than given; for the editor only. */
  ownColorShown: (given: string, shown: string) => string
  welcomeTitle: string
  welcomeBefore: string
  welcomeAdmin: string
  welcomeAfter: string
  notFoundTitle: string
  notFoundText: string
  errorTitle: string
  errorText: string
  goHome: string
  /** The site's name until its settings hold one. */
  defaultName: string
}

export const KIT_WORDS: Record<'cs' | 'en', KitWords> = {
  cs: {
    menu: 'Menu', close: 'Zavřít', mainMenu: 'Hlavní menu', mobileMenu: 'Mobilní menu', footerMenu: 'Menu v zápatí', contact: 'Kontakt',
    phone: 'Telefon', email: 'E-mail',
    sending: 'Odesílám…',
    draftPreview: 'Náhled nezveřejněné stránky',
    ownColorShown: (given, shown) => `Vaše barva ${given} je na tomto vzhledu zobrazena jako ${shown}, aby stránka zůstala čitelná a klidná.`,
    welcomeTitle: 'Založte úvodní stránku',
    welcomeBefore: 'Otevřete ', welcomeAdmin: 'administraci', welcomeAfter: ' a založte stránku s adresou „home“. Její obsah sestavíte z bloků.',
    notFoundTitle: 'Stránku jsme nenašli', notFoundText: 'Zkontrolujte adresu nebo se vraťte na úvodní stránku.',
    errorTitle: 'Stránku se nepodařilo načíst', errorText: 'Zkuste to prosím za chvíli znovu.',
    goHome: 'Na úvodní stránku', defaultName: 'Web',
  },
  en: {
    menu: 'Menu', close: 'Close', mainMenu: 'Main menu', mobileMenu: 'Mobile menu', footerMenu: 'Footer menu', contact: 'Contact',
    phone: 'Phone', email: 'E-mail',
    sending: 'Sending…',
    draftPreview: 'Preview of an unpublished page',
    ownColorShown: (given, shown) => `Your colour ${given} is shown as ${shown} on this look, so that the page stays readable and calm.`,
    welcomeTitle: 'Create the home page',
    welcomeBefore: 'Open the ', welcomeAdmin: 'admin', welcomeAfter: ' and create a page with the address “home”. You build its content from blocks.',
    notFoundTitle: 'We could not find this page', notFoundText: 'Check the address or go back to the home page.',
    errorTitle: 'The page could not be loaded', errorText: 'Please try again in a moment.',
    goHome: 'To the home page', defaultName: 'Website',
  },
}

/** The kit's words on the page of an entry of one of the site's own types (KitCustomEntry). */
export interface KitEntryWords {
  /** Before a file's name: "Stáhnout" */
  download: string
}

export const KIT_ENTRY_WORDS: Record<'cs' | 'en', KitEntryWords> = {
  cs: { download: 'Stáhnout' },
  en: { download: 'Download' },
}

/** The words of an entry's page in a language, Czech for a language the kit has no words in. */
export const kitEntryWords = (lang: string): KitEntryWords => KIT_ENTRY_WORDS[lang as 'cs' | 'en'] ?? KIT_ENTRY_WORDS.cs
