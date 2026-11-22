// Signed out: the start page, the wizard, signing in and the e-mail links are open; anything
// else leads to the sign-in page (and back afterwards). Signed in: the start page and the
// sign-in page lead to "My websites".
const OPEN = new Set(['/', '/new', '/login', '/forgot'])
const isOpen = (path: string) => OPEN.has(path) || path.startsWith('/reset/') || path.startsWith('/verify/')

export default defineNuxtRouteMiddleware((to) => {
  const { signedIn } = useAccount()
  if (signedIn.value) {
    if (to.path === '/' || to.path === '/login' || to.path === '/forgot') return navigateTo('/sites')
    return
  }
  if (!isOpen(to.path)) return navigateTo({ path: '/login', query: { next: to.fullPath } })
})
