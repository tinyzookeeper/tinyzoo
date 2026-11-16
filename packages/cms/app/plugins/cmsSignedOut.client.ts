// The admin stays open while the account changes under it — disabled, removed, its role or
// password changed elsewhere, the session expired. Every list and page then fails with a 401
// ("Authentication required") and "Try again" can never help. Instead: the first read the server
// refuses sends the person to sign-in with "You were signed out", and after signing in they come
// back to the page they were on.
//
// Only reads (GET) of the admin's own API (`/api/cms/…`, not the sign-in calls) while an admin
// page is open: a save that is refused keeps the page and says so (the editor holds the unsaved
// text), and the website's own requests are never touched.
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  const base = globalThis.$fetch
  let leaving = false
  globalThis.$fetch = base.create({
    onResponseError({ request, options, response }) {
      if (response.status !== 401 || leaving) return
      const url = typeof request === 'string' ? request : (request as Request).url
      const path = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0]!
      const method = String(options.method ?? (request as Request).method ?? 'GET').toUpperCase()
      const here = router.currentRoute.value
      if (method !== 'GET' || !path.startsWith('/api/cms/') || path.startsWith('/api/cms/_auth/')) return
      if (!here.path.startsWith('/admin') || /^\/admin\/(login|setup|forgot|reset|invite)/.test(here.path)) return
      leaving = true
      void nuxtApp.runWithContext(async () => {
        const { clear } = useUserSession()
        try { await clear() } catch { /* the cookie is gone or invalid anyway */ }
        await navigateTo({ path: '/admin/login', query: { redirect: here.fullPath, reason: 'signedOut' } })
      }).finally(() => { leaving = false })
    },
  }) as typeof $fetch
})
