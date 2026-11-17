// A content language named with its state, the same words everywhere (the editor's bar, the language
// menu, the list, the home page, the search): "English · Draft", "Angličtina · Na webu".

/** The first letter in capitals, the way a language's name starts a line ("angličtina" → "Angličtina"). */
export function cmsCapitalize(s: string, locale?: string): string {
  return s ? s.charAt(0).toLocaleUpperCase(locale) + s.slice(1) : s
}

/** "English · Draft": a language and its state, for the start of a line. */
export function cmsLanguageState(lang: string, state: string, locale?: string): string {
  return lang ? `${cmsCapitalize(lang, locale)} · ${state}` : state
}
