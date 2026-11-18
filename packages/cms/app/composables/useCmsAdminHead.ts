import { adminIconLinks } from '../../src/themeLogo'

/**
 * Puts the admin's look and language on <html> (data-cms-admin, data-cms-accent,
 * lang), the title template and the tab icons. Used by both admin layouts.
 */
export function useCmsAdminHead() {
  const { t, locale } = useCmsI18n()
  // The client's name and logos (useCmsAdminBrand); without them the admin is tinyzoo's.
  const { theme, productName, unbranded } = useCmsAdminBrand()
  // What the theme's checks found, once in the browser console in development.
  watchEffect(() => cmsShowThemeNotes(theme.value))
  useHead(() => ({
    // The accent: a built-in one is drawn by cms-admin.css, a brand colour by the <style> below.
    htmlAttrs: { 'lang': locale.value, 'data-cms-admin': '', 'data-cms-accent': cmsAccentName(theme.value) },
    style: theme.value.accent.kind === 'brand' ? [{ key: 'cms-accent', innerHTML: cmsAccentCss(theme.value) }] : [],
    // The tab and home-screen icons: the client's mark, else tinyzoo's mascot (src/themeLogo.ts).
    link: adminIconLinks(theme.value, cmsBrand.faviconUrl).map((l) => ({ ...l, tagPriority: 'high' as const })),
    titleTemplate: (title?: string) => (title ? `${title} · ${productName.value}` : `${t('app.adminTitle')} · ${productName.value}`),
  }))
  return { productName, unbranded, signature: computed(() => theme.value.signature) }
}
