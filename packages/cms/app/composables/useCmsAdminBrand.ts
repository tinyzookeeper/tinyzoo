/**
 * The client's brand as the admin shows it: the theme (useCmsAdminTheme), the client's
 * name in the admin's language, and whether the admin is tinyzoo's own (no client name
 * and no logo: then tinyzoo's mascot stands where the client's brand would).
 */
export function useCmsAdminBrand() {
  const theme = useCmsAdminTheme()
  const { tl } = useCmsI18n()
  const productName = computed(() => tl(theme.value.name, cmsBrand.name) || cmsBrand.name)
  const unbranded = computed(() => productName.value === cmsBrand.name && !theme.value.logo.full && !theme.value.logo.mark)
  return { theme, productName, unbranded }
}
