import { resolveAdminTheme, type CmsAdminTheme } from '../../src/theme'

/**
 * The admin's theme (src/theme.ts), resolved on the server at runtime and fetched once:
 * the server render puts it in the page's payload, later pages reuse it. Until it arrives
 * (a page rendered only in the browser) the admin resolves `cms.admin` from app.config
 * itself, which is what the server does today too (one site per server, its app.config).
 * That fallback has no logo file versions (`theme.logo.files`), so its icon addresses carry
 * no `v` until the server's theme arrives.
 *
 * A hosted version that serves several sites from stored settings must not rely on this
 * fallback: app.config would not be the site's theme there. It would wait for the server's.
 * The one such part today is the name: with `cms.admin.nameFrom` it comes from the site's
 * content, which only the server knows, so the fallback carries no name (the admin then says
 * tinyzoo) until the server's theme arrives: never the name compiled into the build.
 */
export function useCmsAdminTheme() {
  const appConfig = useAppConfig()
  const { data } = useAsyncData<CmsAdminTheme>('cms-admin-theme', () => $fetch<CmsAdminTheme>('/api/cms/_theme'), { dedupe: 'defer' })
  const local = computed(() => {
    const admin = ((appConfig.cms as any)?.admin ?? {}) as Record<string, any>
    return resolveAdminTheme({ name: admin.nameFrom ? '' : admin.name, accent: admin.accent, logo: admin.logo, signature: admin.signature, animals: admin.animals })
  })
  return computed<CmsAdminTheme>(() => data.value ?? local.value)
}
