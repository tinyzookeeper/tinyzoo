/**
 * After an auth endpoint signed someone in: refresh the client session, switch to
 * their saved interface language, and continue to `redirect` (only same-site admin
 * paths — never an absolute URL from the query string).
 */
export function useCmsSignedIn() {
  const { fetch: refreshSession } = useUserSession()
  const { setLocale } = useCmsI18n()
  const route = useRoute()
  return async (user?: { locale?: string | null }) => {
    await refreshSession()
    if (user?.locale) setLocale(user.locale)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    const safe = redirect.startsWith('/admin') && !redirect.startsWith('//') ? redirect : '/admin'
    await navigateTo(safe)
  }
}

/** The message to show for a failed auth request: the server's, or a generic one. */
export function cmsErrorMessage(err: any, fallback: string): string {
  return err?.data?.statusMessage || err?.statusMessage || fallback
}
