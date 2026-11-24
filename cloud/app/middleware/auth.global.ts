import { isServerPath, returnPath } from '#shared/account'

// Signed out: the start page, the wizard, signing in, making an account and the e-mail links are
// open; anything else leads to the sign-in page (and back afterwards). Signed in: the start page
// and the sign-in page lead on: to where they were asked to go (`next`, a path of this app
// only), else to "My websites". The page that makes an account stays open for somebody signed
// in whose e-mail is not confirmed yet: it is where they wait for the confirmation.
const OPEN = new Set(['/', '/new', '/login', '/signup', '/forgot'])
const isOpen = (path: string) => OPEN.has(path) || path.startsWith('/reset/') || path.startsWith('/verify/')

export default defineNuxtRouteMiddleware((to) => {
  // An error page is being shown (a website's sign-in that cannot go on, say): it stays where
  // it is. Leading the browser to the sign-in page from here would turn a refusal into a redirect.
  if (useError().value) return
  const { signedIn, user } = useAccount()
  if (signedIn.value) {
    const next = returnPath(to.query.next)
    if (to.path === '/login' || (to.path === '/signup' && (user.value?.emailVerified || !next))) {
      return navigateTo(next ?? '/sites', { external: !!next && isServerPath(next) })
    }
    if (to.path === '/' || to.path === '/forgot') return navigateTo('/sites')
    return
  }
  if (!isOpen(to.path)) return navigateTo({ path: '/login', query: { next: to.fullPath } })
})
