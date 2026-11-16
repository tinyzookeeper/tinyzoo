import * as uiLocales from '@nuxt/ui/locale'

/**
 * Nuxt UI's own words — "Close", "Previous month", "Show password" — in the admin's
 * language on admin pages. Hand it to the site's `<UApp>`:
 *
 *   <script setup>const uiLocale = useCmsUiLocale()</script>
 *   <UApp :locale="uiLocale">…</UApp>
 *
 * It follows the admin language (the account menu's switch) on /admin pages and is
 * `undefined` on the website's pages, where the site's own choice (or Nuxt UI's English)
 * holds. It has to be `<UApp>`'s prop: Nuxt UI keeps one language for all its components
 * and takes it from the first one that asks — the notifications area inside `<UApp>`,
 * above every layout — so a provider set lower down (in a layout) is never read.
 */
export function useCmsUiLocale() {
  const route = useRoute()
  const { locale } = useCmsI18n()
  const all = uiLocales as Record<string, any>
  return computed(() => {
    if (!route.path.startsWith('/admin')) return undefined
    return all[locale.value] ?? all[locale.value.split('-')[0]!] ?? uiLocales.en
  })
}
