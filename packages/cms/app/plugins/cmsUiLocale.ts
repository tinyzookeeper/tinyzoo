import * as uiLocales from '@nuxt/ui/locale'

// Nuxt UI's own words ("Close", "Notifications", "Previous month") in the admin's
// language on admin pages. Nuxt UI keeps one language for all its components in the
// browser, taken by the first one that asks — the notifications area in the site's
// <UApp>, outside the admin — so the admin layout alone cannot set it (see
// useCmsUiLocale). <UApp> takes the app's language from here when the site sets none
// of its own; on the website's pages this stays empty and the site's choice holds.
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const all = uiLocales as Record<string, any>
  const { locale } = useCmsI18n()
  nuxtApp.vueApp.provide(Symbol.for('nuxt-ui.locale-context'), computed(() => {
    if (!router.currentRoute.value.path.startsWith('/admin')) return undefined
    const code = locale.value
    return all[code] ?? all[code.split('-')[0]!] ?? uiLocales.en
  }))
})
