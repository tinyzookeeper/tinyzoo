// Signed out: to the sign-in page (or to the first-run setup while there is no account).
// Signed in: away from the sign-in and setup pages. An invitation (/invite/<token>) opens
// either way: it makes the account, or adds the one you are signed in with.
const PUBLIC = new Set(['/login', '/setup'])
const isInvite = (path: string) => path.startsWith('/invite/')

export default defineNuxtRouteMiddleware(async (to) => {
  if (isInvite(to.path)) return
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
