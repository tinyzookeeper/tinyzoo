/**
 * Puts the admin's look and language on <html> (data-cms-admin, data-cms-accent,
 * lang) and the title template. Used by both admin layouts.
 */
export function useCmsAdminHead() {
  const config = useCmsAdminConfig()
  const { t, tl, locale } = useCmsI18n()
  const productName = computed(() => tl(config.value.name, 'Content'))
  useHead(() => ({
    htmlAttrs: { 'lang': locale.value, 'data-cms-admin': '', 'data-cms-accent': config.value.accent },
    titleTemplate: (title?: string) => (title ? `${title} · ${productName.value}` : `${t('app.adminTitle')} · ${productName.value}`),
  }))
  return { productName }
}
