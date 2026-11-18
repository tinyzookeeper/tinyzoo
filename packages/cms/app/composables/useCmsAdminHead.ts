/**
 * Puts the admin's look and language on <html> (data-cms-admin, data-cms-accent,
 * lang) and the title template. Used by both admin layouts.
 */
export function useCmsAdminHead() {
  const config = useCmsAdminConfig()
  const { t, tl, locale } = useCmsI18n()
  const productName = computed(() => tl(config.value.name, cmsBrand.name))
  // No client name configured: the admin shows tinyzoo's own mark instead of an initial.
  const unbranded = computed(() => productName.value === cmsBrand.name)
  // The accent: a built-in one is drawn by cms-admin.css, a brand colour by the <style> below.
  const theme = useCmsAdminTheme()
  watchEffect(() => cmsShowThemeNotes(theme.value))
  useHead(() => ({
    htmlAttrs: { 'lang': locale.value, 'data-cms-admin': '', 'data-cms-accent': cmsAccentName(theme.value) },
    style: theme.value.accent.kind === 'brand' ? [{ key: 'cms-accent', innerHTML: cmsAccentCss(theme.value) }] : [],
    // The admin's tabs carry tinyzoo's mascot, so they stand apart from the website's.
    link: [{ rel: 'icon', type: 'image/svg+xml', href: cmsBrand.faviconUrl, key: 'cms-admin-icon', tagPriority: 'high' }],
    titleTemplate: (title?: string) => (title ? `${title} · ${productName.value}` : `${t('app.adminTitle')} · ${productName.value}`),
  }))
  return { productName, unbranded }
}
