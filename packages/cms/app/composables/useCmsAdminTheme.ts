import { resolveAdminTheme, type CmsAdminTheme } from '../../src/theme'

/**
 * The admin's theme (src/theme.ts), resolved on the server at runtime and fetched once:
 * the server render puts it in the page's payload, later pages reuse it. Until it arrives
 * (a page rendered only in the browser) the admin resolves `cms.admin` from app.config
 * itself, which is what the server does today too.
 */
export function useCmsAdminTheme() {
  const appConfig = useAppConfig()
  const { data } = useAsyncData<CmsAdminTheme>('cms-admin-theme', () => $fetch<CmsAdminTheme>('/api/cms/_theme'), { dedupe: 'defer' })
  const local = computed(() => {
    const admin = ((appConfig.cms as any)?.admin ?? {}) as Record<string, any>
    return resolveAdminTheme({ name: admin.name, accent: admin.accent, logo: admin.logo, signature: admin.signature })
  })
  return computed<CmsAdminTheme>(() => data.value ?? local.value)
}
