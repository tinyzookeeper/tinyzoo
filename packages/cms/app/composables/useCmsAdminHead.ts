import { adminIconLinks } from '../../src/themeLogo'

/**
 * Puts the admin's look and language on <html> (data-cms-admin, data-cms-accent,
 * lang), the title template and the tab icons. Used by both admin layouts.
 */
export function useCmsAdminHead() {
  const config = useCmsAdminConfig()
  const { t, locale } = useCmsI18n()
  // The client's name and logos (useCmsAdminBrand); without them the admin is tinyzoo's.
  const { theme, productName, unbranded } = useCmsAdminBrand()
  useHead(() => ({
    htmlAttrs: { 'lang': locale.value, 'data-cms-admin': '', 'data-cms-accent': config.value.accent },
    // The tab and home-screen icons: the client's mark, else tinyzoo's mascot (src/themeLogo.ts).
    link: adminIconLinks(theme.value, cmsBrand.faviconUrl).map((l) => ({ ...l, tagPriority: 'high' as const })),
    titleTemplate: (title?: string) => (title ? `${title} · ${productName.value}` : `${t('app.adminTitle')} · ${productName.value}`),
  }))
  return { productName, unbranded, signature: computed(() => theme.value.signature) }
}
