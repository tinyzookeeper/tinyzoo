import type { AccountView } from '#shared/api'

const EMPTY: AccountView = { user: null, sites: { used: 0, max: 3 }, requireVerifiedEmail: false, devVerifyUrl: null, siteHost: '.localhost' }

/** Who is signed in, and the few settings the pages need. Loaded once per page load (plugins/account.ts) and after signing in or out. */
export function useAccount() {
  const account = useState<AccountView>('account', () => ({ ...EMPTY }))
  const user = computed(() => account.value.user)
  const signedIn = computed(() => !!account.value.user)

  async function refresh(): Promise<AccountView> {
    // On the server, the browser's cookie travels along.
    const fetcher = import.meta.server ? useRequestFetch() : $fetch
    account.value = await fetcher<AccountView>('/api/account').catch(() => ({ ...EMPTY }))
    return account.value
  }

  async function signOut() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    await refresh()
    await navigateTo('/')
  }

  return { account, user, signedIn, refresh, signOut }
}
