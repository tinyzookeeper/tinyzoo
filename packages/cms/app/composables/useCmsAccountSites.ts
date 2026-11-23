/**
 * The signed-in person's websites, when the site lets people sign in with the tinyzoo
 * account (GET /api/cms/_auth/account/sites): for the switcher at the top of the menu and
 * the line on the account page. Asked once per page load, in the browser, after the page is
 * shown; nothing is asked on a site without the account (`enabled` comes with `_auth/me`).
 */
export interface CmsAccountSiteItem { id: string; name: string; url: string; role: string; current: boolean }
interface AccountSitesState { loaded: boolean; linked: boolean; sites: CmsAccountSiteItem[]; account: string | null }

export function useCmsAccountSites() {
  const state = useState<AccountSitesState>('cms-account-sites', () => ({ loaded: false, linked: false, sites: [], account: null }))
  const loading = useState('cms-account-sites-loading', () => false)

  async function load() {
    if (state.value.loaded || loading.value) return
    loading.value = true
    try {
      const res = await $fetch<Omit<AccountSitesState, 'loaded'>>('/api/cms/_auth/account/sites')
      state.value = { loaded: true, linked: !!res.linked, sites: Array.isArray(res.sites) ? res.sites : [], account: res.account ?? null }
    }
    catch {
      // Not there, or not now: the menu stays the site's name.
      state.value = { loaded: true, linked: false, sites: [], account: null }
    }
    finally {
      loading.value = false
    }
  }

  /** The other websites: with at least one, the site's name becomes a menu. */
  const others = computed(() => state.value.sites.filter((s) => !s.current))
  return { state, others, load }
}

/** Where choosing a website leads: its own start of the sign-in, which asks nothing when the account already knows the browser. */
export function cmsAccountSiteAddress(url: string): string {
  return url.replace(/\/+$/, '') + '/api/cms/_auth/account/start?next=%2Fadmin&silent=1'
}
