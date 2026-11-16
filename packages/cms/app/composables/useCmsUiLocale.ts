import * as uiLocales from '@nuxt/ui/locale'

// Nuxt UI's own words — "Close", "Open sidebar", "Previous month" — in the admin's
// language, not the website's. Nuxt UI reads them from this key (UApp sets it for the
// whole app; the admin's layouts set it again for everything inside them).
export function useCmsUiLocale() {
  const { locale } = useCmsI18n()
  const all = uiLocales as Record<string, any>
  provide(Symbol.for('nuxt-ui.locale-context'), computed(() => all[locale.value] ?? all[locale.value.split('-')[0]!] ?? uiLocales.en))
}
