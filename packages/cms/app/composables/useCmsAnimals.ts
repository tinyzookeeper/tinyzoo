/**
 * Whether the admin shows tinyzoo's animals at its moments (`cms.admin.animals`, default true).
 * `false` leaves every animal out (sign-in, welcome, empty places, success, first-run setup), and
 * each place closes up around it. CmsAnimal draws one; this decides whether there is one at all.
 */
export function useCmsAnimals() {
  const theme = useCmsAdminTheme()
  return computed(() => theme.value.animals !== false)
}
