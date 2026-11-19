// Signed out: to the sign-in page (or to the first-run setup while there is no account).
// Signed in: away from the sign-in and setup pages.
const PUBLIC = new Set(['/login', '/setup'])

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn } = useUserSession()
  if (loggedIn.value) {
    if (PUBLIC.has(to.path)) return navigateTo('/')
    return
  }
  const state = await $fetch<{ needsSetup: boolean; needsToken: boolean }>('/api/auth/state').catch(() => null)
  if (state?.needsSetup) return to.path === '/setup' ? undefined : navigateTo('/setup')
  if (to.path === '/setup') return navigateTo('/login')
  if (!PUBLIC.has(to.path)) return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { next: to.fullPath } : {} })
})
