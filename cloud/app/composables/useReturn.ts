import { isServerPath, returnPath } from '#shared/account'

/**
 * Where the sign-in pages go afterwards: the `next` of the address when it is a path of this
 * app (never another website), else `fallback`. A website's sign-in through the account comes
 * back to /oauth/authorize, which the server answers: the browser asks for it for real.
 */
export function useReturn(fallback = '/sites') {
  const route = useRoute()
  const next = computed(() => returnPath(route.query.next))
  /** Whether the person came from a website's sign-in through the account. */
  const fromSite = computed(() => !!next.value && isServerPath(next.value))
  const go = () => {
    const to = next.value ?? fallback
    return navigateTo(to, { external: isServerPath(to) })
  }
  /** The website the person came from (its name and host), when they came from one. */
  const site = useState<{ name: string; host: string } | null>('return-site', () => null)
  async function loadSite() {
    if (!fromSite.value) { site.value = null; return }
    const fetcher = import.meta.server ? useRequestFetch() : $fetch
    site.value = (await fetcher<{ site: { name: string; host: string } | null }>('/api/auth/continue', { query: { next: next.value } }).catch(() => ({ site: null }))).site
  }
  /** `path` with the same `next`, for the links between the sign-in pages. */
  const withNext = (path: string) => (next.value ? { path, query: { next: next.value } } : path)
  return { next, fromSite, go, site, loadSite, withNext }
}
